import {Scope,toMeshData,type ManifoldToplevel,type CrossSection,type Manifold,type Part,type Vec2} from '@bdl/geometry';
import {extent,LAT_METRES,lonMetres,polygons,buildingHeight,metres,type Area,type Element,type Point} from './data.ts';
import {groundSurface} from './terrain.ts';
import type {Elevation} from './elevation.ts';
import {outline,type Form} from './forms.ts';
import {DEFAULT_MAGNET,MARKER_PEG_LENGTH,MARKER_SOCKET_RADIUS,MARKER_SOCKET_DEPTH,markerMesh,pins,rearMount} from './accessories.ts';
import {pisaBaptistery,baptisteryMesh} from './landmarks.ts';
import {makeCaption,type Captions,type TextShape} from './caption.ts';
export const modelDefaults={
  trayThickness:2.4,
  buildings:true,paths:true,terrainScale:1,roadHeight:.32,waterMode:'flat',waterDepth:.8,
  style:'precise',form:'rect' as Form,frame:false,label:'',subtitle:'',font:'Russo One',
  wallText:false,captionPosition:'auto',coordinateOrder:'front',coordinates:false,north:false,scaleBar:false,keyring:false,marker:false,markerPosition:'',markerShape:'star',markerInitial:'A',stand:false,
  frameColor:'#252729',captionColor:'#ffffff',simple:false,highlight:false,rail:true,bridges:true,trees:false,
  extraPins:'',mount:'none',magnetCode:DEFAULT_MAGNET as string,colorMode:'free',palette:'classic',bandCount:2,cut1:0,cut2:0,cut3:0,
  groundColor:'#e4d9c5',buildingColor:'#fff3dc',roadColor:'#676e75',
  pathColor:'#a99e8e',waterColor:'#4387a3',greenColor:'#7f9969'
};
export interface Settings extends Partial<typeof modelDefaults> {
  size:number;base:number;relief:number;fallback:number;roads:boolean;water:boolean;green:boolean;
}
export interface Result {
  parts:Part[];solid:Part;markers?:Part;placedMarkers?:Part;tray?:Part;trayPreview?:Part[];trayFloor:number;stand?:Part;mount?:Part;changes:number[];width:number;depth:number;counts:{height:number;levels:number;estimate:number;omitted:number;detached:number}
}
export function build(M:ManifoldToplevel,area:Area,data:Element[],settings:Settings,elevation?:Elevation,label?:Captions|TextShape,route:Point[][]=[]):Result {
  const p={...modelDefaults,...settings};
  const cube=p.form==='cube';
  if(cube)p.base=p.size*.8;
  const scope=new Scope(),t=<T extends {delete():void}>(o:T)=>scope.t(o),C=M.CrossSection;
  try {
    const mapArea=p.form==='rect'?area:{...area,aspect:'square' as const};
    const scale=p.size/area.span,[wm,dm]=extent(mapArea),width=wm*scale,depth=dm*scale;
    const frame=outline(M,scope,p.form,width,depth);
    const framed=p.frame||p.style==='miniature'||cube||p.coordinates||p.north||p.scaleBar||p.keyring||p.stand;
    const surface=groundSurface(elevation,width,depth,p.base,scale*p.terrainScale);
    const terrainSolid=elevation?t(surface.solid(M)):undefined;
    const ground=terrainSolid?t(terrainSolid.intersect(t(frame.extrude(p.base+surface.max+1)))):t(frame.extrude(p.base));
    if(ground.status()!=='NoError')throw new Error('Superficie del terreno non valida.');

    const project=(a:Point):Vec2=>[(a.lon-area.lon)*lonMetres(area.lat)*scale,(a.lat-area.lat)*LAT_METRES*scale];
    const mapPins:Vec2[]=[];
    for(const pin of [...(p.marker?[pins(p.markerPosition)[0]??area]:[]),...pins(p.extraPins)]){
      const point=project(pin);
      const footprint=t(t(C.circle(MARKER_SOCKET_RADIUS+.4,24)).translate(point));
      if(t(footprint.subtract(frame)).area()<.001&&
        !mapPins.some(([x,y])=>Math.hypot(point[0]-x,point[1]-y)<3.2))mapPins.push(point);
    }
    const centre=t(C.circle(.24,16));
    const rings=(paths:Point[][])=>t(C.union(paths.map(path=>t(C.ofPolygons([path.slice(0,-1).map(project)],'EvenOdd')))));
    const polygon=(e:Element,clip=true)=>{
      const {outer,inner}=polygons(e);
      const section=t(rings(outer).subtract(rings(inner)));
      return clip?t(section.intersect(frame)):section;
    };
    const stroke=(e:Element,mm:number):CrossSection=>{
      const path=e.geometry??[],pieces:CrossSection[]=[];
      for(let i=1;i<path.length;i++) {
        const a=path[i-1],b=path[i];
        if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))continue;
        const [x,y]=project(a),[u,v]=project(b),length=Math.hypot(u-x,v-y);
        if(length<.001)continue;
        const core=t(C.square([length,mm/2],true));
        const shape=t(core.offset(mm/4,'Round',2,8));
        pieces.push(t(t(shape.rotate(Math.atan2(v-y,u-x)*180/Math.PI)).translate([(u+x)/2,(v+y)/2])));
      }
      return t(t(C.union(pieces)).intersect(frame));
    };
    const members=new Set<number>();
    for(const e of data)if(e.type==='relation'&&(e.tags?.building||e.tags?.['building:part'])&&polygons(e).outer.length)
      for(const m of e.members??[])if(m.type==='way'&&m.role!=='inner')members.add(m.ref);
    const footprints:CrossSection[]=[],buildings:Manifold[]=[],featured:Manifold[]=[],streets:CrossSection[]=[],paths:CrossSection[]=[],rails:CrossSection[]=[],bridgeWays:CrossSection[]=[],waters:CrossSection[]=[],parks:CrossSection[]=[];
    const counts={height:0,levels:0,estimate:0,omitted:0,detached:0};
    const usable=(shape:CrossSection)=>{
      if(shape.isEmpty())return false;
      const b=shape.bounds();
      return shape.area()>=.3&&Math.min(b.max[0]-b.min[0],b.max[1]-b.min[1])>=.55;
    };
    const buildingParts=new Map<Element,CrossSection>();
    for(const e of data)if(p.buildings&&!p.simple&&e.tags?.['building:part']&&e.tags['building:part']!=='no'&&(e.type!=='way'||!members.has(e.id))){
      const section=polygon(e);
      if(usable(section))buildingParts.set(e,section);
    }
    const detailedArea=t(C.union([...buildingParts.values()]));
    const extrude=(shape:CrossSection,height:number,z:number)=>t(t(shape.extrude(height)).translate([0,0,z]));
    const roofed=(shape:CrossSection,height:number,roofHeight:number,profile:string)=>{
      const body=extrude(shape,height-roofHeight,p.base);
      const b=shape.bounds(),x=(b.min[0]+b.max[0])/2,y=(b.min[1]+b.max[1])/2;
      const centred=t(shape.translate([-x,-y]));
      const layers:Manifold[]=[body];
      const slices=profile==='dome'?16:1;
      const radius=(u:number)=>profile==='dome'?Math.sqrt(Math.max(0,1-u*u)):1-u;
      for(let i=0;i<slices;i++){
        const from=radius(i/slices),to=radius((i+1)/slices)/from;
        const layer=t(t(centred.scale(from)).extrude(roofHeight/slices+.035,0,0,[to,to]));
        layers.push(t(layer.translate([x,y,p.base+height-roofHeight+roofHeight*i/slices-.035])));
      }
      return t(t(M.Manifold.union(layers)).intersect(extrude(shape,height+.01,p.base)));
    };
    for(const e of data) {
      const tags=e.tags??{};
      const part=buildingParts.get(e);
      if(p.buildings&&(part||(tags.building&&tags.building!=='no'&&(e.type!=='way'||!members.has(e.id))))) {
        const mapped=part??polygon(e);
        if(mapped.isEmpty())continue;
        const detailed=part?mapped:t(mapped.subtract(detailedArea));
        const shape=p.simple&&!detailed.isEmpty()?t(t(C.hull([detailed])).intersect(frame)):detailed;
        if(shape.isEmpty())continue;
        if(!usable(shape)){counts.omitted++;continue;}
        const h=buildingHeight(tags,p.fallback),start=metres(tags.min_height);
        const total=h.kind!=='height'&&h.metres<=start?start+h.metres:h.metres;
        const b=shape.bounds();
        const lift=surface.at((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2);
        const emphasise=p.highlight&&!t(shape.intersect(centre)).isEmpty();
        const height=Math.max(.45,total*scale*p.relief*(emphasise?1.2:1))+lift;
        const profile=tags['roof:shape'];
        const roofLevels=Number(tags['roof:levels']);
        const knownRoof=profile==='dome'||profile==='pyramidal'||profile==='cone'||profile==='conical';
        const roofMetres=metres(tags['roof:height'])||(roofLevels>0?roofLevels*3:knownRoof?total*.28:0);
        const roof=Math.min(height-lift-.25,roofMetres*scale*p.relief);
        counts[h.kind]++;
        footprints.push(shape);
        let solid:Manifold;
        if(!p.simple&&pisaBaptistery(e)){
          const full=polygon(e,false).bounds();
          const center:Vec2=[(full.min[0]+full.max[0])/2,(full.min[1]+full.max[1])/2];
          const monument=baptisteryMesh(M,scope,center,p.base,scale,height);
          const clipped=t(monument.intersect(extrude(frame,height+.01,p.base)));
          solid=t(clipped.add(extrude(shape,Math.min(height,2.4*scale+lift),p.base)));
        }else solid=!p.simple&&roof>=.3&&knownRoof?roofed(shape,height,roof,profile):extrude(shape,height,p.base);
        (emphasise?featured:buildings).push(solid);
      } else if((p.roads||p.paths||p.bridges)&&tags.highway&&tags.tunnel!=='yes'&&tags.highway!=='proposed'&&tags.highway!=='construction') {
        const footway=/^(footway|path|steps|cycleway|pedestrian|bridleway)$/.test(tags.highway);
        const bridge=!!tags.bridge&&tags.bridge!=='no';
        if(bridge?!p.bridges:footway?!p.paths:!p.roads)continue;
        const lanes=Number(tags.lanes);
        const metres=Number.isFinite(lanes)&&lanes>0?Math.min(30,lanes*3):/motorway|trunk|primary/.test(tags.highway)?9:/footway|path|steps|cycleway/.test(tags.highway)?2:5;
        (bridge?bridgeWays:footway?paths:streets).push(tags.area==='yes'?polygon(e):stroke(e,Math.max(.65,metres*scale)));
      } else if(p.rail&&/^(rail|light_rail|tram|narrow_gauge)$/.test(tags.railway??'')&&tags.tunnel!=='yes'){
        rails.push(stroke(e,Math.max(.75,3*scale)));
      } else if(p.water&&(tags.natural==='water'||tags.waterway==='riverbank'))waters.push(polygon(e));
      else if(p.water&&tags.waterway&&e.type==='way'&&tags.tunnel!=='yes')waters.push(stroke(e,Math.max(.85,(tags.waterway==='river'?12:3)*scale)));
      else if(p.green&&(tags.leisure==='park'||tags.landuse||tags.natural==='wood'))parks.push(polygon(e));
    }
    const cover=t(C.union(footprints));
    const water=t(t(C.union(waters)).subtract(cover));
    const roads=t(t(C.union(streets)).subtract(t(cover.add(water))));
    const lanes=t(t(C.union(paths)).subtract(t(t(cover.add(water)).add(roads))));
    const tracks=t(t(C.union(rails)).subtract(t(C.union([cover,water,roads,lanes]))));
    const occupied=t(C.union([cover,water,roads,lanes,tracks]));
    const green=t(t(C.union(parks)).subtract(occupied));
    const solids:{id:string;name:string;color:string;mesh:Manifold}[]=[];
    const shift=(solid:Manifold,z:number)=>t(solid.translate([0,0,z]));
    const column=(shape:CrossSection)=>extrude(shape,p.base+surface.max+8,0);
    const raised=(shape:CrossSection,height:number)=>{
      if(!elevation)return extrude(shape,height,p.base);
      const layer=t(shift(ground,height).subtract(ground));
      return t(layer.intersect(column(shape)));
    };
    const incised=p.waterMode==='incised'&&!water.isEmpty();
    const depthCut=Math.min(p.waterDepth,p.base-.8);
    const cut=incised?t(t(ground.subtract(shift(ground,-depthCut))).intersect(column(water))):undefined;
    const base=cut?t(ground.subtract(cut)):ground;
    solids.push({id:'base',name:'Terreno e base',color:p.groundColor,mesh:base});
    const captions=Array.isArray(label)?{title:label}:label;
    const wallCaption=p.captionPosition==='wall'||(p.captionPosition!=='top'&&(p.wallText||p.form!=='rect'));
    const rim=framed?(p.form==='rect'?t(t(C.square([width+8,depth+18],true)).translate([0,-5])):
      cube?frame:t(frame.offset(5,'Round',2,64))):undefined;
    const rimTop=Math.min(2,p.base),trayFloor=p.trayThickness;
    const trayMeshes:Manifold[]=[];
    let trayWriting:Manifold|undefined;
    let ring:CrossSection|undefined;
    if(rim&&!cube){
      ring=t(rim.subtract(t(frame.offset(.25,'Round',2,24))));
      trayMeshes.push(extrude(rim,trayFloor,-trayFloor),extrude(ring,rimTop+.04,-.04));
    }
    if(rim&&p.keyring&&!cube){
      const north=rim.bounds().max[1];
      const probe=t(t(C.circle(.6,12)).translate([0,north-.8]));
      const apex=rim.toPolygons().flat().reduce((a,b)=>a[1]>b[1]?a:b);
      const x=t(probe.intersect(rim)).isEmpty()?apex[0]:0;
      const y=north+2.5;
      const outer=t(t(C.circle(4.5,56)).translate([x,y]));
      const hole=t(t(C.circle(2.4,48)).translate([x,y]));
      const loop=t(t(outer.subtract(hole)).subtract(rim));
      if(!loop.isEmpty())trayMeshes.push(extrude(loop,rimTop,0));
    }
    const add=(id:string,name:string,color:string,section:CrossSection,height:number)=>{
      if(!section.isEmpty())solids.push({id,name,color,mesh:raised(section,height)});
    };
    add('parks','Verde',p.greenColor,green,.24);
    if(incised){
      const low=shift(ground,-depthCut);
      const inlay=t(t(shift(low,Math.min(.22,depthCut/2)).subtract(low)).intersect(column(water)));
      solids.push({id:'water',name:'Acqua incisa',color:p.waterColor,mesh:inlay});
    }else add('water','Acqua',p.waterColor,water,.24);
    add('roads','Strade',p.roadColor,roads,p.roadHeight);
    add('paths','Sentieri',p.pathColor,lanes,Math.min(.24,p.roadHeight));
    add('rails','Ferrovie',p.roadColor,tracks,.45);
    const buildingsSolid=t(M.Manifold.union(buildings)),featureSolid=t(M.Manifold.union(featured));
    const normal=t(buildingsSolid.subtract(featureSolid));
    const buildLayer=(solid:Manifold,id:string,name:string,color:string)=>{
      const above=elevation?t(solid.subtract(ground)):solid;
      if(!above.isEmpty())solids.push({id,name,color,mesh:above});
    };
    buildLayer(normal,'buildings','Edifici',p.buildingColor);
    buildLayer(featureSolid,'highlight','Edificio al centro','#ff771f');
    const addDistinct=(id:string,name:string,color:string,solid:Manifold)=>{
      if(solid.isEmpty())return;
      const existing=t(M.Manifold.union(solids.map(layer=>layer.mesh)));
      const layer=t(solid.subtract(existing));
      if(!layer.isEmpty())solids.push({id,name,color,mesh:layer});
    };
    if(bridgeWays.length){
      const decks:Manifold[]=[];
      for(const way of bridgeWays){
        const section=t(way.subtract(cover));
        const dry=t(section.subtract(water));
        if(section.isEmpty()||dry.area()<.15)continue;
        if(t(section.intersect(water)).isEmpty()){decks.push(raised(section,Math.max(.65,p.roadHeight)));continue;}
        const b=section.bounds(),h=p.base+Math.max(...[b.min[0],b.max[0]].flatMap(x=>[b.min[1],b.max[1]].map(y=>surface.at(x,y))))+.8;
        const deck=extrude(section,.75,h-.75),abutment=extrude(dry,h,0);
        decks.push(t(deck.add(abutment)));
      }
      addDistinct('bridges','Ponti',p.roadColor,t(M.Manifold.union(decks)));
    }
    if(p.trees&&!green.isEmpty()){
      const trees:Manifold[]=[],b=green.bounds();
      const spacing=Math.max(6,Math.sqrt(green.area()/95));
      for(let y=b.min[1]+spacing/2;y<b.max[1]&&trees.length<95;y+=spacing)
        for(let x=b.min[0]+spacing/2;x<b.max[0]&&trees.length<95;x+=spacing){
          const foot=t(t(C.circle(.72,14)).translate([x,y]));
          if(t(foot.subtract(green)).area()>.01)continue;
          const height=p.base+surface.at(x,y);
          const trunk=extrude(foot,2.5,height-.3);
          const crown=t(t(M.Manifold.sphere(1.6,14)).translate([x,y,height+2.7]));
          trees.push(t(trunk.add(crown)));
        }
      addDistinct('trees','Alberi 3D','#3f6848',t(M.Manifold.union(trees)));
    }
    if(route.length){
      const ribbon=t(C.union(route.map((geometry,i)=>stroke({type:'way',id:-i,geometry},1.6))));
      if(!ribbon.isEmpty())addDistinct('route','Percorso GPX','#d75d22',raised(ribbon,.8));
    }
    if(rim&&captions){
      const writing=makeCaption(M,scope,rim,ring??rim,cube?p.base:rimTop,captions,wallCaption,cube,cube?0:-trayFloor,p.coordinateOrder==='back');
      if(writing&&!writing.isEmpty()){
        if(cube)solids.push({id:'caption',name:'Scritta',color:p.captionColor,mesh:writing});
        else trayWriting=writing;
      }
    }
    if(rim&&ring&&p.north){
      const y=rim.bounds().max[1]-2.7;
      const arrow=t(C.ofPolygons([[[0,y+2],[-1.45,y-.8],[-.38,y-.4],[-.38,y-1.8],[.38,y-1.8],[.38,y-.4],[1.45,y-.8]]]));
      const clipped=t(arrow.intersect(ring));
      if(!clipped.isEmpty())trayMeshes.push(extrude(clipped,.64,rimTop-.04));
    }
    if(rim&&ring&&p.scaleBar){
      const y=rim.bounds().min[1]+1.2;
      const length=(p.size/area.span)*(area.span<600?50:100);
      const mark=t(t(C.square([length,.7],true)).translate([0,y]));
      if(t(mark.subtract(ring)).area()<.01){
        let scaleMark=extrude(mark,.59,rimTop-.04);
        if(captions?.scale?.length){
          const glyph=t(C.union(captions.scale.map(shape=>t(C.ofPolygons(shape,'EvenOdd')))));
          if(!glyph.isEmpty()){
            const b=glyph.bounds(),factor=Math.min(1.6/(b.max[1]-b.min[1]),length/(b.max[0]-b.min[0]));
            const scaled=t(t(glyph.translate([-(b.min[0]+b.max[0])/2,-(b.min[1]+b.max[1])/2])).scale(factor));
            const text=t(t(scaled.translate([0,y+1.7])).intersect(ring));
            if(!text.isEmpty())scaleMark=t(scaleMark.add(extrude(text,.59,rimTop-.04)));
          }
        }
        trayMeshes.push(scaleMark);
      }
    }
    const part=(id:string,name:string,color:string,mesh:Manifold):Part=>{
      if(mesh.status()!=='NoError'||mesh.isEmpty())throw new Error('Geometria non valida per '+name.toLowerCase()+'. Prova a restringere l’area.');
      return {id,name,color,mesh:toMeshData(mesh)};
    };
    const combined=t(M.Manifold.union(solids.map(s=>s.mesh)));
    if(combined.status()!=='NoError')throw new Error('Non è stato possibile unire i livelli della mappa.');
    // The printable body must contain the base. Clear floating fragments from both exports.
    const pieces=combined.decompose().map(t).filter(piece=>Math.abs(piece.volume())>1e-5);
    pieces.sort((a,b)=>Math.abs(b.volume())-Math.abs(a.volume()));
    let [model,...detached]=pieces;
    if(!model||model.volume()<base.volume()*.99)throw new Error('Non è stato possibile costruire una base continua.');
    counts.detached=detached.length;
    const debris=detached.length?t(M.Manifold.union(detached)):undefined;
    const sockets:Manifold[]=[],markerPositions:Array<[number,number,number]>=[];
    const modelTop=model.boundingBox().max[2]+1;
    for(const [x,y] of mapPins){
      const hit=model.rayCast([x,y,modelTop],[x,y,-1])[0];
      if(!hit)continue;
      const z=hit.position[2],bottom=Math.max(.18,z-MARKER_SOCKET_DEPTH);
      if(z-bottom<MARKER_PEG_LENGTH)continue;
      sockets.push(extrude(t(t(C.circle(MARKER_SOCKET_RADIUS,48)).translate([x,y])),modelTop-bottom,bottom));
      markerPositions.push([x,y,z]);
    }
    const socketCuts=sockets.length?t(M.Manifold.union(sockets)):undefined;
    if(socketCuts)model=t(model.subtract(socketCuts));
    const remove=[debris,socketCuts].filter((mesh):mesh is Manifold=>!!mesh);
    const excluded=remove.length?t(M.Manifold.union(remove)):undefined;
    const printableLayers=excluded?solids.flatMap(layer=>{
      const mesh=t(layer.mesh.subtract(excluded));
      return mesh.isEmpty()?[]:[{...layer,mesh}];
    }):solids;
    let markers:Part|undefined,placedMarkers:Part|undefined;
    if(markerPositions.length){
      const marker=markerMesh(M,scope,p.markerShape,captions?.marker);
      const forPrint=t(t(marker.rotate([180,0,0])).translate([0,0,marker.boundingBox().max[2]]));
      const count=markerPositions.length,columns=Math.min(4,count);
      const packed=markerPositions.map((_,i)=>t(forPrint.translate([14*(i%columns),14*Math.floor(i/columns),0])));
      markers=part('markers','Segnaposti separati','#ff4b16',t(M.Manifold.union(packed)));
      placedMarkers=part('placed-markers','Segnaposti montati','#ff4b16',
        t(M.Manifold.union(markerPositions.map(point=>t(marker.translate(point))))));
    }
    const trayWithoutWriting=trayMeshes.length?shift(t(M.Manifold.union(trayMeshes)),trayFloor):undefined;
    const lettering=trayWriting?shift(trayWriting,trayFloor):undefined;
    const trayBody=trayWithoutWriting&&lettering?t(trayWithoutWriting.add(lettering)):trayWithoutWriting;
    const tray=trayBody?part('tray','Base a vassoio',p.frameColor,trayBody):undefined;
    const trayPreview=trayWithoutWriting&&lettering?[
      part('tray','Base a vassoio',p.frameColor,trayWithoutWriting),
      part('tray-writing','Scritta sul vassoio',p.captionColor,lettering),
    ]:undefined;
    let stand:Part|undefined;
    if(rim&&p.stand&&!cube){
      const w=Math.max(30,width*.68);
      const foot=t(M.Manifold.cube([w,40,11],true));
      const blank=shift(foot,5.5);
      const slot=t(M.Manifold.cube([w+2,Math.min(24,trayFloor+Math.max(p.base,rimTop)+.55),12],true));
      const angled=t(slot.rotate([12,0,0]));
      const cutter=t(angled.translate([0,-4,12]));
      stand=part('stand','Supporto da scrivania',p.groundColor,t(blank.subtract(cutter)));
    }
    const box=model.boundingBox();
    const mount=p.mount!=='none'?part('mount','Fissaggio posteriore',p.frameColor,rearMount(M,scope,p.mount,p.size,p.magnetCode)):undefined;
    const changes:number[]=[];
    let parts:Part[];
    if(p.colorMode==='height'){
      const count=Math.min(4,Math.max(2,p.bandCount)),height=box.max[2];
      const cuts=[p.cut1,p.cut2,p.cut3].slice(0,count-1).map((value,i)=>{
        const automatic=i===0?Math.min(height-.4,p.base+surface.max+p.roadHeight):height*(i+1)/count;
        return Math.max(.2,Math.min(height-.2,value||automatic));
      }).sort((a,b)=>a-b);
      changes.push(...new Set(cuts));
      const colors=[p.groundColor,p.buildingColor,p.waterColor,p.captionColor];
      let top=model;
      parts=[];
      for(const [i,cut] of changes.entries()){
        const [above,below]=top.splitByPlane([0,0,1],cut).map(t);
        if(!below.isEmpty())parts.push(part('band-'+i,'Fascia '+(i+1),colors[i],below));
        top=above;
      }
      if(!top.isEmpty())parts.push(part('band-top','Fascia superiore',colors[changes.length],top));
    }else{
      const surfaceIds=new Set(['base','frame','eyelet']);
      const detailIds=new Set(['roads','paths','rails','bridges']);
      const buildingIds=new Set(['buildings','caption','highlight','north','scale']);
      parts=printableLayers.map(s=>{
        let color=s.color;
        if(p.colorMode==='ams4')color=surfaceIds.has(s.id)?p.groundColor:detailIds.has(s.id)||s.id==='marker'?p.roadColor:
          buildingIds.has(s.id)?p.buildingColor:p.waterColor;
        if(p.colorMode==='ams8'){
          if(detailIds.has(s.id))color=p.roadColor;
          else if(s.id==='trees')color=p.greenColor;
          else if(s.id==='north'||s.id==='scale'||s.id==='caption')color=p.captionColor;
          else if(s.id==='highlight'||s.id==='route'||s.id==='marker')color='#ff4b16';
        }
        return part(s.id,s.name,color,s.mesh);
      });
    }
    const trayBox=trayBody?.boundingBox()??box;
    return {parts,solid:part('map','Mappa urbana',p.groundColor,model),markers,placedMarkers,tray,trayPreview,trayFloor:tray?trayFloor:0,stand,mount,changes,
      width:Math.max(box.max[0],trayBox.max[0])-Math.min(box.min[0],trayBox.min[0]),
      depth:Math.max(box.max[1],trayBox.max[1])-Math.min(box.min[1],trayBox.min[1]),counts};
  } finally {scope.free();}
}
