import {Scope,toMeshData,type ManifoldToplevel,type Manifold,type MeshData,type Part} from '@bdl/geometry';
import {sanitize,type Params} from './params.ts';
/** LED Kit-001: nominal Ø59 × 8 mm; adhesive mounting, no screw holes assumed. */
export const LED={diameter:59,height:8,seatDiameter:60.4,seatHeight:8.4,neckRadius:35,fit:.2,cableSlotWidth:8,floor:3,baseHeight:14.4};
export function build(M:ManifoldToplevel,input:Params,mesh?:MeshData):{parts:Part[],warnings:string[]}{
 const p=sanitize(input),s=new Scope();try{
 const cyl=(h:number,r:number,z=0)=>s.t(s.t(M.Manifold.cylinder(h,r,r,96)).translate([0,0,z]));
 const cube=(x:number,y:number,z:number,at:[number,number,number])=>s.t(s.t(M.Manifold.cube([x,y,z],true)).translate(at));
 let base=s.t(cyl(11.4,38).subtract(cyl(8.6,LED.seatDiameter/2,3)));
 // Il cavo completo si appoggia dall’alto insieme al LED: nessun connettore deve attraversare un foro.
 base=s.t(base.add(s.t(cyl(3,35,11.4).subtract(cyl(3.2,LED.seatDiameter/2,11.3)))));
 // Scanalatura continua dal piano della sede fino oltre il collare:
 // un tunnel chiuso non permette il montaggio del Kit-001 già cablato.
 const slotHeight=LED.baseHeight-LED.floor+1;
 base=s.t(base.subtract(cube(LED.cableSlotWidth,45,slotHeight,[0,-32,LED.floor+slotHeight/2])));
 for(const x of [-25,25])base=s.t(base.subtract(cube(5,10,4,[x,0,1.5])));
 let shade:Manifold,warnings=['LED Bambu Lab Kit-001 · prova l’incastro con il campione prima della lampada completa.'];
 if(p.source==='parametric'){
  const profile:[number,number][]=[[37.2,0],[37.2,4]];const inside:[number,number][]=[[35.2,0],[35.2,4]];
  for(let i=1;i<=80;i++){
    const z=4+(p.height-4)*i/80,t=(z-4)/(p.height-4);
    const f=p.shape==='bulb'?.74+.26*Math.sin(Math.PI*t):p.shape==='waist'?1-.25*Math.sin(Math.PI*t):1;
    const target=p.diameter/2*f;
    const r=37.2+(target-37.2)*Math.min(1,(z-4)/18);
    profile.push([r,z]);inside.push([r-p.wall,z]);
  }
  const polygon=[...profile,...inside.reverse()];
  if(p.height<p.diameter*.7)warnings.push('Questa forma larga e bassa può richiedere supporti: controlla lo slicer o aumenta l’altezza.');
  shade=s.t(s.t(M.CrossSection.ofPolygons([polygon])).revolve(192));
  if(p.texture!=='smooth')shade=s.t(shade.warp(v=>{const r=Math.hypot(v[0],v[1]);if(r<.001)return;const angle=Math.atan2(v[1],v[0]),z=v[2],fade=Math.min(1,Math.max(0,(z-4)/12));const shift=p.amplitude*Math.sin(p.waves*(angle-(p.texture==='spiral'?z/p.height*p.twist*Math.PI/180:0)))*fade*Math.min(1,r/30);v[0]*=(r+shift)/r;v[1]*=(r+shift)/r;}));
 }else{
  if(!mesh)throw Error('Carica un file STL per creare la lampada.');
  if(mesh.indices.length/3>6000)throw Error('STL troppo dettagliato per lo svuotamento: riducilo a 6.000 triangoli o meno prima di caricarlo.');
  const raw=new M.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices});raw.merge();let solid=s.t(new M.Manifold(raw));
  if(solid.status()!=='NoError'||solid.isEmpty()||solid.volume()<=0)throw Error('Serve uno STL chiuso con normali corrette. Ripara il modello prima di importarlo.');
  const rotations={z:[0,0,0],x:[0,-90,0],y:[90,0,0],flip:[180,0,0]} as const;solid=s.t(solid.rotate(rotations[p.orientation]));const b=solid.boundingBox(),h=b.max[2]-b.min[2];if(h<.001)throw Error('Lo STL non ha un’altezza valida.');
  solid=s.t(s.t(solid.translate([-(b.min[0]+b.max[0])/2,-(b.min[1]+b.max[1])/2,-b.min[2]])).scale(p.height/h));solid=s.t(solid.translate([-p.holeX,-p.holeY,0]));
  const box=solid.boundingBox();if(box.max[0]-box.min[0]>350||box.max[1]-box.min[1]>350)throw Error('STL troppo largo: riduci l’altezza o cambia orientamento.');
  const cut=p.height*p.cut/100;
  // Morphological erosion makes a true internal shell, preserving the external STL.
  const inner=s.t(solid.minkowskiDifference(s.t(M.Manifold.sphere(p.wall,12))));
  if(inner.isEmpty()||inner.status()!=='NoError')throw Error('Non riesco a svuotare questo STL: riduci lo spessore o semplifica il modello.');
  const aperture=s.t(M.CrossSection.circle(35.3,96));const innerSlice=s.t(inner.slice(cut));
  if(s.t(aperture.subtract(innerSlice)).area()>.05)throw Error('Spazio insufficiente per il LED: cambia il piano di apertura, sposta l’attacco o aumenta l’altezza. Serve una zona interna libera di Ø70,6 mm.');
  shade=s.t(s.t(s.t(solid.subtract(inner)).trimByPlane([0,0,1],cut)).translate([0,0,-cut]));
  const footprint=s.t(s.t(solid.slice(cut)).subtract(s.t(M.CrossSection.circle(35.2,96))));
  shade=s.t(shade.add(s.t(footprint.extrude(2))));
  const collar=s.t(cyl(4,37.2).subtract(cyl(4.2,35.2,-.1)));shade=s.t(shade.add(collar));
  warnings.push('STL svuotato; i dettagli sottili possono restare pieni. Controlla pareti e supporti nell’anteprima dello slicer.');
 }
 const one=(m:Manifold,label:string)=>{const pieces=m.decompose();pieces.forEach(x=>s.t(x));if(m.status()!=='NoError'||m.volume()<=0||pieces.length!==1)throw Error(label+': la geometria genera parti scollegate. Cambia forma, taglio o posizione.');};one(base,'Base');one(shade,'Paralume');
 // Collar starts at shoulder height: fit=.2 mm per side, no pressure on LED lens.
 const mounted=s.t(shade.translate([0,0,11.4]));if(s.t(base.intersect(mounted)).volume()>.05)throw Error('Il modello invade la base: sposta il taglio o l’attacco.');
 return{parts:[{id:'base',name:'Base LED · Kit-001',color:p.baseColor,mesh:toMeshData(base)},{id:'shade',name:'Paralume',color:p.shadeColor,mesh:toMeshData(mounted)}],warnings};
 }finally{s.free();}
}
export function fitSample(M:ManifoldToplevel,color:string):Part{const s=new Scope();try{const outer=s.t(M.Manifold.cylinder(4,37.2,37.2,96)),inner=s.t(M.Manifold.cylinder(4,35.2,35.2,96));return{id:'fit',name:'Campione incastro Ø70',color,mesh:toMeshData(s.t(outer.subtract(inner)))};}finally{s.free();}}
