import {Scope,toMeshData,type ManifoldToplevel,type Part,type CrossSection,type Vec2} from '@bdl/geometry';
import {artworkSection} from '../../shared/artwork-geometry.ts';
import {sanitize,type Params} from './params.ts';
import {roundedLetter} from './rounded.ts';
import {balancedMagnets,hiddenStand} from './mount-placement.ts';
import {adhesiveSeats,adhesiveSection,type AdhesiveSeat} from './adhesive.ts';
import type {Glyph} from './lettering.ts';
export interface LetterInfo {id:string;char:string;width:number;height:number;depth:number;volume:number;stand?:string;slot?:Vec2;standHeight?:number;standLength?:number;standThickness?:number;tongueHeight?:number;magnetPositions?:Vec2[];adhesiveSeats?:AdhesiveSeat[];bottom:number}
export interface Result {parts:Part[];warnings:string[];letters:LetterInfo[]}
export function build(M:ManifoldToplevel,input:Params,glyphs:Glyph[]):Result {
  const p=sanitize(input),scope=new Scope(),t=<T extends {delete():void}>(obj:T)=>scope.t(obj);
  const parts:Part[]=[],warnings:string[]=[],letters:LetterInfo[]=[];
  const colors=p.colors.split(',');
  try {
    if(glyphs.length>32)throw new Error('Massimo 32 caratteri.');
    for(const [index,glyph] of glyphs.entries()){
      const original=artworkSection(M,scope,glyph.artwork);
      const b=original.bounds(),h=b.max[1]-b.min[1];
      const height=p.height*glyph.heightRatio;
      const shape=t(original.scale([height/h*(p.style==='wide'?1.2:1),height/h]));
      const polygons=shape.toPolygons();
      const exteriors=polygons.filter(ring=>signedArea(ring)>0).map(ring=>t(M.CrossSection.ofPolygons([ring],'EvenOdd')));
      // These glyphs have no counters. Rounded joins can enclose tiny raster
      // pockets, which must not be promoted into enlarged through-holes.
      const solidGlyph=/^[CEFGHIJKLMNSTUVWXYZcfhijklmnrstuvwxyz12357]$/.test(glyph.char);
      const voids=polygons.filter(ring=>!solidGlyph&&signedArea(ring)<0).map(ring=>{
        let hole=t(M.CrossSection.ofPolygons([ring],'EvenOdd'));
        const bounds=hole.bounds(),smallest=Math.min(bounds.max[0]-bounds.min[0],bounds.max[1]-bounds.min[1]);
        const minimum=Math.max(2.4,p.height*.11);
        if(smallest<minimum)hole=t(hole.offset((minimum-smallest)/2,'Round',2,64));
        return hole;
      });
      const radius=p.height*.075*p.inflate/100;
      const outer=t(t(M.CrossSection.union(exteriors)).offset(radius,'Round',2,96));
      let outline:CrossSection=voids.length?t(outer.subtract(t(M.CrossSection.union(voids)))):outer;
      if(solidGlyph){
        const filled=outline.toPolygons().filter(ring=>signedArea(ring)>0)
          .map(ring=>t(M.CrossSection.ofPolygons([ring],'EvenOdd')));
        outline=t(M.CrossSection.union(filled));
      }
      outline=t(outline.simplify(.035));
      const box=outline.bounds(),width=box.max[0]-box.min[0],actualHeight=box.max[1]-box.min[1];
      const depth=p.thickness+p.height*.14*p.inflate/100;
      let solid=roundedLetter(M,scope,outline,voids,p,solidGlyph);
      const id='letter-'+index;
      const cuts:ReturnType<typeof M.Manifold.cube>[]=[];
      const angle=p.mount==='stand'?p.lean:0,cosine=Math.cos(angle*Math.PI/180);
      const standing=t(solid.rotate([90-angle,0,0]));
      const baseline=standing.boundingBox().min[2]/cosine;
      const info:LetterInfo={id,char:glyph.char,width,height:actualHeight,depth:solid.boundingBox().max[2],volume:0,bottom:baseline};
      const required=p.mount==='magnet'?p.magnetThickness+1.2:p.mount==='stand'?Math.min(6,depth-1.2)+1.2:p.mount==='keyhole'?4.3:p.mount==='sawtooth'?3.7:1.8;
      let mountingRegion=t(M.CrossSection.square([0,0]));
      if(p.mount!=='none'&&required<solid.boundingBox().max[2]-.1){
        const slices=Array.from({length:7},(_,i)=>t(solid.slice(.02+(required-.02)*i/6)));
        mountingRegion=t(slices.reduce((area,slice)=>t(area.intersect(slice))).simplify(.02));
      }
      const silhouette=t(solid.project().simplify(.025));
      const fits=(section:CrossSection)=>t(section.subtract(mountingRegion)).area()<.001;
      const rectangle=(w:number,h:number,at:Vec2)=>t(t(M.CrossSection.square([w,h],true)).translate(at));
      const candidates=(w:number,h:number,count:number)=>{
        const found:Vec2[]=[];
        for(let row=0;row<18&&found.length<count;row++)for(let col=0;col<19&&found.length<count;col++){
          const at:Vec2=[(box.min[0]+box.max[0])/2+(col===0?0:(col%2?1:-1)*Math.ceil(col/2)*width/20),box.min[1]+actualHeight*(p.mount==='stand'?.22+.025*row:.8-.035*row)];
          if(found.some(v=>Math.hypot(at[0]-v[0],at[1]-v[1])<Math.max(w,h)+2))continue;
          if(fits(rectangle(w+1.6,h+1.6,at)))found.push(at);
        }
        return found;
      };
      const cut=(section:CrossSection,cutDepth:number)=>{
        cuts.push(t(t(section.extrude(cutDepth+.01)).translate([0,0,-.01])));
      };
      if(p.mount==='magnet'){
        const r=p.magnetDiameter/2+p.tolerance;
        const at=balancedMagnets(M,scope,mountingRegion,r,p.magnets);
        info.magnetPositions=at;
        for(const center of at)cut(t(t(M.CrossSection.circle(r,48)).translate(center)),p.magnetThickness);
        if(at.length<p.magnets)warnings.push(glyph.char+': '+at.length+' sedi magnete su '+p.magnets+'; aumenta la lettera o riduci diametro e spessore del magnete.');
      }
      if(p.mount==='adhesive'){
        const seats=adhesiveSeats(mountingRegion);
        info.adhesiveSeats=seats;
        for(const seat of seats)cut(adhesiveSection(M,scope,seat),.6);
        if(!seats.length)warnings.push(glyph.char+': superficie utile troppo piccola per una sede adesiva. Aumenta la lettera.');
      }
      if(p.mount==='keyhole'||p.mount==='sawtooth'){
        const w=p.mount==='keyhole'?9:Math.min(16,Math.max(8,p.height*.18));
        const h=p.mount==='keyhole'?15:7;
        const count=p.mount==='keyhole'?(p.keyholes|| (width>height*.7?2:1)):1;
        const at=candidates(w,h,count);
        for(const center of at){
          if(p.mount==='keyhole'){
            const circle=t(t(M.CrossSection.circle(4.5,48)).translate([center[0],center[1]-3]));
            const slot=rectangle(4.4,10,[center[0],center[1]+2]);
            const opening=t(circle.add(slot));
            cut(opening,1.5);
            const chamber=rectangle(9,13,center);
            cuts.push(t(t(chamber.extrude(1.7)).translate([0,0,1.4])));
          }else if(p.mount==='sawtooth'){
            const profile:Vec2[]=[[-8,-3.5],[8,-3.5],[8,1.5]];
            for(let x=8;x>=-8;x-=2)profile.push([x,x%4===0?3.5:1.5]);
            cut(t(t(M.CrossSection.ofPolygons([profile.map(([x,y]):Vec2=>[x*w/16,y])])).translate(center)),2.5);
          }
        }
        if(at.length<count)warnings.push(glyph.char+': fissaggio troppo grande per i tratti. Aumenta la lettera o riduci la sede.');
      }
      if(p.mount==='stand'){
        const standThickness=Math.min(p.standThickness,Math.max(1.6,actualHeight*.07));
        const tongueHeight=Math.max(4,Math.min(12,actualHeight*.11));
        const slotWidth=standThickness+2*p.tolerance;
        const placement=hiddenStand(M,scope,silhouette,standThickness,p.tolerance,p.lean,mountingRegion,baseline,tongueHeight);
        if(placement){
          const at=placement.at;
          info.slot=at;
          cut(rectangle(slotWidth,tongueHeight+2*p.tolerance,at),Math.min(6,depth-1.2));
          const slotHeight=at[1]-baseline;
          const length=placement.depth,standHeight=placement.height;
          info.standHeight=standHeight;
          info.standLength=length;
          info.standThickness=standThickness;
          info.tongueHeight=tongueHeight;
          const lean=p.lean*Math.PI/180;
          const outerStand=t(M.CrossSection.ofPolygons([[[0,0],[length,0],[Math.tan(lean)*standHeight,standHeight]]]));
          const rim=Math.max(1.2,Math.min(2.4,Math.min(length,standHeight)*.13));
          const opening=t(outerStand.offset(-rim,'Round',2,24));
          const triangle=opening.area()>4?t(outerStand.subtract(opening)):outerStand;
          const tongueDepth=Math.min(5,Math.max(1.8,actualHeight*.065),Math.min(6,depth-1.2)-.6),insertion=tongueDepth/2-.05;
          const tab=t(t(t(M.CrossSection.square([tongueDepth,tongueHeight],true)).rotate(-p.lean)).translate([
            slotHeight*Math.sin(lean)-insertion*Math.cos(lean),
            slotHeight*Math.cos(lean)+insertion*Math.sin(lean),
          ]));
          const stand=t(t(triangle.add(tab)).extrude(standThickness));
          const standId='stand-'+index;
          parts.push({id:standId,name:'Piedistallo '+(index+1)+' · '+glyph.char,color:colors[index%colors.length]||'#ff4b16',mesh:toMeshData(stand)});
          info.stand=standId;
        }else warnings.push(glyph.char+': tratto insufficiente per il piedistallo. Aumenta la lettera.');
      }
      if(cuts.length)solid=t(solid.subtract(t(M.Manifold.union(cuts))));
      if(solid.isEmpty()||solid.status()!=='NoError')throw new Error('Geometria non valida per '+glyph.char+'. Riduci il gonfiaggio o cambia stile.');
      const islands=solid.decompose().map(piece=>t(piece));
      if(islands.length>1)warnings.push(glyph.char+': '+islands.length+' elementi distinti (per esempio punti o accenti).');
      info.depth=solid.boundingBox().max[2];
      info.volume=solid.volume();
      const mesh=toMeshData(solid);
      for(let vertex=2;vertex<mesh.positions.length;vertex+=3)if(Math.abs(mesh.positions[vertex])<.000001)mesh.positions[vertex]=0;
      parts.push({id,name:'Lettera '+(index+1)+' · '+glyph.char,color:colors[index%colors.length]||'#ff4b16',mesh});
      letters.push(info);
    }
    return {parts,warnings:[...new Set(warnings)],letters};
  } finally {scope.free();}
}
function signedArea(ring:Vec2[]) {return ring.reduce((sum,p,i)=>{const next=ring[(i+1)%ring.length];return sum+p[0]*next[1]-next[0]*p[1];},0)/2;}
