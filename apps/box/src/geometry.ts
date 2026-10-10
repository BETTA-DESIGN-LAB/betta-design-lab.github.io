import type {SvgArtwork} from '../../coaster/src/svg.ts';
import { Scope, toMeshData, type ManifoldToplevel, type Part, type CrossSection } from '@bdl/geometry';
import { FACE_ROTATION, FACES, validateDecorations, type Decoration } from './decoration.ts';
import { buildGrid, gridFoot, FOOT_HEIGHT, GRID_FLOOR, GRID_HEIGHT } from './gridfinity.ts';
import { sanitize, type Params } from './params.ts';
/** Scatola con guide e coperchio scorrevole indipendente; tutto in millimetri. */
export function buildBox(M: ManifoldToplevel, input: Params, decorationInput: readonly Decoration[] = [], labelArtwork?:SvgArtwork): { parts: Part[]; warnings: string[] } {
  const p = sanitize(input), s = new Scope();
  try {
    if(p.gridfinity && p.gridOutput==='grid')return {parts:buildGrid(M,p),warnings:[]};
    const sliding=p.model==='sliding', drawer=p.model==='drawer';
    const hasLid=sliding || (p.model==='stackable' && p.stackLid);
    const C = M.CrossSection;
    const rect = (w: number, d: number) => s.t(C.square([w, d], true));
    const extrude = (cs: CrossSection, h: number, z = 0) => s.t(s.t(cs.extrude(h)).translate([0, 0, z]));
    const rounded=(w:number,d:number,r:number)=>r>0?s.t(rect(w-2*r,d-2*r).offset(r,'Round',2,64)):rect(w,d);
    const outer = rounded(p.width,p.depth,p.radius);
    const trayOuter=drawer?s.t(rounded(p.width-2*p.wall-2*p.clearance,p.depth-p.wall-p.clearance,Math.max(0,p.radius-p.wall)).translate([0,-p.wall/2])):outer;
    const trayInner=s.t(trayOuter.offset(-p.wall,'Round',2,64));
    const trayWidth=drawer?p.width-2*p.wall-2*p.clearance:p.width, trayDepth=drawer?p.depth-p.wall-p.clearance:p.depth;
    const trayHeight=drawer?p.height-2*p.wall-p.clearance:p.height;
    const track = s.t(outer.offset(-p.wall + 0.8, 'Round', 2, 64));
    const trackZ = p.height - 3.8;
    let body = s.t(extrude(trayOuter, trayHeight).subtract(extrude(trayInner, trayHeight, p.floor)));
    // Guide profonde 0.8 mm, alte 2.4 mm; il tetto resta spesso 1.4 mm.
    if(sliding) body = s.t(body.subtract(extrude(track, 2.4, trackZ)));
    const entry = s.t(rect(2 * (p.radius + p.wall + 2), p.depth - 2 * p.wall + 1.6).translate([p.width / 2, 0]));
    if(sliding) body = s.t(body.subtract(extrude(entry, 5, trackZ)));
    if (p.ribbed && !drawer) {
      const ribs = [];
      for (let x = -p.width / 2 + p.radius + 3; x <= p.width / 2 - p.radius - 3; x += 7) {
        for (const sign of [-1, 1]) ribs.push(extrude(s.t(rect(2, 1.2).translate([x, sign * (p.depth / 2 + 0.3)])), p.height - 4, 0));
      }
      if (ribs.length) body = s.t(body.add(s.t(M.Manifold.union(ribs))));
    }
    const dividerHeight = (sliding?trackZ:trayHeight-3) - p.floor - 0.8;
    for (let i = 1; i < (p.dividers ? p.columns : 1); i++) {
      const x = -trayWidth / 2 + p.wall + i * (trayWidth - 2 * p.wall) / p.columns;
      const section = s.t(s.t(rect(p.wall, p.depth).translate([x, 0])).intersect(trayInner));
      body = s.t(body.add(extrude(section, dividerHeight + 0.2, p.floor - 0.2)));
    }
    for (let i = 1; i < (p.dividers ? p.rows : 1); i++) {
      const y = -trayDepth / 2 + p.wall + i * (trayDepth - 2 * p.wall) / p.rows - (drawer?p.wall/2:0);
      const section = s.t(s.t(rect(p.width, p.wall).translate([0, y])).intersect(trayInner));
      body = s.t(body.add(extrude(section, dividerHeight + 0.2, p.floor - 0.2)));
    }
    let sleeve = extrude(outer,p.height);
    if(drawer) {
      const cavity=s.t(rounded(p.width-2*p.wall,p.depth-p.wall+2,p.radius>0?Math.max(0,p.radius-p.wall):0).translate([0,-p.wall/2-1]));
      sleeve=s.t(sleeve.subtract(extrude(cavity,p.height-2*p.wall,p.wall)));
      body=s.t(body.translate([0,0,p.wall+p.clearance]));
      // Presa frontale nel cassetto; evita una maniglia sporgente.
      const notch=s.t(rect(Math.min(28,p.width/3),p.wall+3).translate([0,-p.depth/2]));
      body=s.t(body.subtract(extrude(notch,Math.min(6,trayHeight-p.floor-2),p.height-p.wall-Math.min(6,trayHeight-p.floor-2))));
    }
    if(p.model==='stackable') {
      const recess=s.t(outer.offset(-(p.gridfinity?Math.min(p.wall,2.4):p.wall)+0.8,'Round',2,64));
      body=s.t(body.subtract(extrude(recess,p.gridfinity?4.75:2.5,p.height-(p.gridfinity?4.75:2.5))));
      if(!p.gridfinity) {
        const plug=s.t(recess.offset(-p.clearance,'Round',2,64));
        const ring=s.t(plug.subtract(s.t(plug.offset(-1.2,'Round',2,64))));
        body=s.t(s.t(body.add(extrude(ring,2.5,-2.3))).translate([0,0,2.3]));
      }
    }
    if(drawer && p.ribbed) { const ribs=[];for(let x=-p.width/2+p.radius+p.wall+3;x<p.width/2-p.radius-p.wall-3;x+=7)ribs.push(extrude(s.t(rect(2,1.2).translate([x,-p.depth/2+p.clearance/2-0.3])),trayHeight-6,p.wall+p.clearance));if(ribs.length)body=s.t(body.add(s.t(M.Manifold.union(ribs))));}
    if(drawer) {const notch=s.t(rect(Math.min(28,p.width/3),p.wall+3).translate([0,-p.depth/2]));const nh=Math.min(6,trayHeight-p.floor-2);body=s.t(body.subtract(extrude(notch,nh,p.height-p.wall-nh)));}
    // L'interfaccia d'impilamento appartiene all'involucro, non al cassetto.
    const drawerLift=drawer&&!p.gridfinity?2.3:0;
    if(drawer){
      if(p.gridfinity){
        const sockets=[],socket=gridFoot(M,s,true);
        for(let y=0;y<p.gridRows;y++)for(let x=0;x<p.gridColumns;x++)sockets.push(s.t(socket.translate([(x+.5-p.gridColumns/2)*42,(y+.5-p.gridRows/2)*42,p.height+GRID_FLOOR])));
        const cap=s.t(extrude(outer,GRID_HEIGHT+.2,p.height-.2).subtract(s.t(M.Manifold.union(sockets))));
        sleeve=s.t(sleeve.add(cap));
      }else{
        const recess=s.t(outer.offset(-p.wall+.8,'Round',2,64));
        const topRing=s.t(outer.subtract(recess));
        const plug=s.t(recess.offset(-p.clearance,'Round',2,64));
        const bottomRing=s.t(plug.subtract(s.t(plug.offset(-1.2,'Round',2,64))));
        sleeve=s.t(s.t(sleeve.add(extrude(topRing,2.7,p.height-.2))).add(extrude(bottomRing,2.5,-2.3)));
        sleeve=s.t(sleeve.translate([0,0,drawerLift]));body=s.t(body.translate([0,0,drawerLift]));
      }
    }
    const bodyLift=(p.model==='stackable'&&!p.gridfinity?2.3:0)+drawerLift;
    const lidZ = sliding?trackZ+p.clearance:p.height+bodyLift;
    const lidOutline = sliding?s.t(track.offset(-p.clearance,'Round',2,64)):outer;
    let lid = extrude(lidOutline, 1.8, lidZ);
    if(sliding) {
      const tab = s.t(rect(p.wall + 6, 18).translate([p.width / 2 + 0.5, 0]));
      lid = s.t(lid.add(extrude(tab, 1.8, lidZ)));
    } else if(hasLid) {
      const plug=s.t(outer.offset(-(p.gridfinity?Math.min(p.wall,2.4):p.wall)+0.8-p.clearance,'Round',2,64));
      const ring=s.t(plug.subtract(s.t(plug.offset(-1.2,'Round',2,64))));
      lid=s.t(lid.add(extrude(ring,2.5,lidZ-2.3)));
    }
    const artworkParts: Part[] = [], warnings: string[] = [];
    for (const d of validateDecorations(decorationInput)) {
      const onLid = d.face === 'lid';
      if(onLid && !hasLid && !drawer){warnings.push('Decorazione del coperchio conservata: attiva un coperchio per mostrarla.');continue;}
      const onSleeve=drawer && d.face!=='front';
      const faceWidth = onLid || d.face === 'front' || d.face === 'back' ? p.width : p.depth;
      const marginX = onLid ? p.radius + p.wall : p.radius + 1;
      const loY = onLid ? -p.depth / 2 + p.radius + p.wall : -p.height / 2 + p.floor + 1 + (drawer && d.face==='front'?p.wall+p.clearance:0);
      const hiY = onLid ? p.depth / 2 - p.radius - p.wall : p.height / 2 - 5;
      const cs = s.t(C.union(d.artwork.shapes.map((rings) => s.t(C.ofPolygons(rings, 'EvenOdd')))));
      const positioned = s.t(s.t(s.t(cs.scale(d.size)).rotate(d.angle)).translate([d.u, d.v]));
      let safe = s.t(rect(faceWidth - 2 * marginX, hiY - loY).translate([0, (hiY + loY) / 2]));
      if(drawer&&d.face==='front'&&p.labelText.trim()){
        const lh=Math.min(p.labelHeight,trayHeight-p.floor-8);
        if(lh>=5){
          const labelY=p.wall+p.clearance+p.floor+2+lh/2-p.height/2;
          const reserved=s.t(rounded(Math.min(p.labelWidth,trayWidth-4)+1.2,lh+1.2,1.8).translate([0,labelY]));
          if(!s.t(positioned.intersect(reserved)).isEmpty())warnings.push('Frontale: spazio riservato alla targhetta; la decorazione resta visibile intorno.');
          safe=s.t(safe.subtract(reserved));
        }
      }
      const clipped = s.t(positioned.intersect(safe));
      if (clipped.isEmpty()) {if(drawer&&d.face==='front'&&p.labelText.trim()){warnings.push('Decorazione frontale conservata: rimuovi la targhetta o sposta il disegno per mostrarla.');continue;}throw new Error(`Decorazione fuori dalla superficie: ${FACES[d.face]}.`);}
      if (positioned.area() - clipped.area() > 0.05) warnings.push(`${FACES[d.face]}: disegno ritagliato entro i bordi.`);
      const at: [number,number,number] = onLid ? [0,0,drawer?p.height+drawerLift+(p.gridfinity?GRID_HEIGHT:0):lidZ + 1.8] : d.face === 'front' ? [0,-p.depth/2+(drawer?p.clearance/2:0),p.height/2+bodyLift] : d.face === 'back' ? [0,p.depth/2,p.height/2+bodyLift] : d.face === 'left' ? [-p.width/2,0,p.height/2+bodyLift] : [p.width/2,0,p.height/2+bodyLift];
      const place = (solid: import('@bdl/geometry').Manifold) => s.t(s.t(solid.rotate(FACE_ROTATION[d.face])).translate(at));
      // Una zona piana locale evita che le nervature coprano il disegno.
      if (p.ribbed && (d.face === 'front' || (!drawer && d.face === 'back'))) {
        const patch = s.t(clipped.offset(1, 'Round', 2, 32));
        body = s.t(body.subtract(place(extrude(patch, 2, 0))));
      }
      const ink = place(extrude(clipped, d.depth, d.mode === 'relief' ? 0 : -d.depth));
      const target = onSleeve ? sleeve : onLid ? lid : body;
      if (d.mode !== 'relief') {
        const cavity = d.mode === 'inlay' ? place(extrude(s.t(clipped.offset(0.1, 'Round', 2, 32)), d.depth + 0.05, -d.depth - 0.05)) : ink;
        const cut = s.t(target.subtract(cavity));
        if(onSleeve) sleeve=cut; else if (onLid) lid = cut; else body = cut;
      }
      if (d.mode !== 'engrave') {
        let visible = d.mode === 'inlay' ? s.t(ink.intersect(target)) : ink;
        if(drawer&&p.gridfinity&&onLid){visible=s.t(visible.intersect(s.t(target.translate([0,0,d.mode==='relief'?d.depth:0]))));warnings.push('Le decorazioni sul tetto devono lasciare libere le sedi Gridfinity per impilare.');}
        // Decorazioni precedenti sullo stesso lato hanno la precedenza.
        for (const part of artworkParts) {
          if (!part.id.startsWith(`art-${d.face}-`)) continue;
          const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices }); mesh.merge();
          visible = s.t(visible.subtract(s.t(new M.Manifold(mesh))));
        }
        const pieces = visible.decompose(); pieces.forEach((m) => s.t(m));
        pieces.forEach((m,i) => { if (!m.isEmpty()) artworkParts.push({ id: `art-${d.face}-${d.id}-${i+1}`, name: `${FACES[d.face]} · ${d.artwork.name.slice(0,40)} · ${d.id}.${i+1}`, color: d.color, mesh: toMeshData(m) }); });
      }
    }
    if(drawer&&p.labelText.trim()){
      if(!labelArtwork)throw new Error('La targhetta richiede un testo valido.');
      const lw=Math.min(p.labelWidth,trayWidth-4),lh=Math.min(p.labelHeight,trayHeight-p.floor-8);
      if(lh<5)warnings.push('Targhetta conservata: aumenta l’altezza della scatola per mostrarla.');
      else {
        const faceY=-p.depth/2+p.clearance/2;
        const faceZ=p.wall+p.clearance+drawerLift+p.floor+2+lh/2;
        const placeLabel=(m:import('@bdl/geometry').Manifold)=>s.t(s.t(m.rotate([90,0,0])).translate([0,faceY,faceZ]));
        const outline=rounded(lw,lh,1.2);
        const cavity=placeLabel(extrude(s.t(outline.offset(.15,'Round',2,32)),.65,-.65));
        // Appiattimento delle nervature intorno alla targhetta; il frontale resta spesso.
        body=s.t(body.subtract(placeLabel(extrude(s.t(outline.offset(.6,'Round',2,32)),2,0))));
        body=s.t(body.subtract(cavity));
        let plaque=extrude(outline,.8,-.6);
        const ink=s.t(C.union(labelArtwork.shapes.map(r=>s.t(C.ofPolygons(r,'EvenOdd')))));
        const ib=ink.bounds(),iw=ib.max[0]-ib.min[0],ih=ib.max[1]-ib.min[1];
        const scale=Math.min((lw-4)/iw,(lh-3)/ih);
        const letters=s.t(s.t(ink.scale(scale)).translate([-(ib.min[0]+ib.max[0])*scale/2,-(ib.min[1]+ib.max[1])*scale/2]));
        const text=extrude(letters,.4,-.2);
        plaque=s.t(plaque.subtract(extrude(letters,.5,-.25)));
        artworkParts.push({id:'art-front-label-plate',name:'Targhetta · '+p.labelText,color:p.lidColor,mesh:toMeshData(placeLabel(plaque))});
        const pieces=text.decompose();pieces.forEach(m=>{s.t(m);});
        pieces.forEach((m,i)=>artworkParts.push({id:`art-front-label-text-${i+1}`,name:'Scritta targhetta · '+p.labelText+' · '+(i+1),color:p.bodyColor,mesh:toMeshData(placeLabel(m))}));
      }
    }
    const gridLift=p.gridfinity?FOOT_HEIGHT+GRID_FLOOR:0;
    if(p.gridfinity) {
      const foot=gridFoot(M,s),feet=[];
      for(let y=0;y<p.gridRows;y++)for(let x=0;x<p.gridColumns;x++)feet.push(s.t(foot.translate([(x+0.5-p.gridColumns/2)*42,(y+0.5-p.gridRows/2)*42,GRID_FLOOR])));
      const base=s.t(M.Manifold.union(feet));
      if(drawer)sleeve=s.t(s.t(sleeve.translate([0,0,gridLift])).add(base));
      else body=s.t(s.t(body.translate([0,0,gridLift])).add(base));
      if(drawer)body=s.t(body.translate([0,0,gridLift]));
      lid=s.t(lid.translate([0,0,gridLift]));
      for(const part of artworkParts)for(let i=2;i<part.mesh.positions.length;i+=3)part.mesh.positions[i]+=gridLift;
    }
    const solids=[body,...(drawer?[sleeve]:[]),...(hasLid?[lid]:[])];
    for(const solid of solids)if(solid.status()!=='NoError'||solid.isEmpty())throw new Error('Geometria non valida: modifica le misure.');
    const parts:Part[]=[{id:'body',name:drawer?'Cassetto estraibile':'Corpo scatola',color:p.bodyColor,mesh:toMeshData(body)},
      ...(drawer?[{id:'case',name:'Involucro del cassetto',color:p.lidColor,mesh:toMeshData(sleeve)}]:[]),
      ...(hasLid?[{id:'lid',name:sliding?'Coperchio scorrevole':'Coperchio impilabile',color:p.lidColor,mesh:toMeshData(lid)}]:[]),...artworkParts];
    if(p.gridfinity && p.gridOutput==='both')parts.push(...buildGrid(M,p));
    return {parts,warnings};
  } finally { s.free(); }
}
