import { Scope, bounds, toMeshData, type ManifoldToplevel, type Part, type Manifold } from './index.ts';
/** Sedi per decorazioni in rilievo: inserto prolungato verso il supporto, quota esterna invariata.
 * Gli intarsi già incassati e i componenti meccanici non vengono modificati. */
export function assemblySeats(M: ManifoldToplevel, parts: readonly Part[], depth = .25): Part[] {
  const scope = new Scope();
  try {
    const solids = new Map<string, Manifold>();
    const cuts = new Map<string, Manifold[]>();
    const solid = (part: Part) => {
      if (!solids.has(part.id)) {
        const mesh = new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();
        solids.set(part.id, scope.t(new M.Manifold(mesh)));
      }
      return solids.get(part.id)!;
    };
    const supports = parts.filter(p => /^(base|body|case|lid|cap(?:-\d+)?)$/.test(p.id));
    for (const art of parts.filter(p => !supports.includes(p) && !/^(grid|fit|switch)/.test(p.id))) {
      const face = /^art-(front|back|left|right|lid)-/.exec(art.id)?.[1];
      const a = bounds([art]);
      const axis = face==='front'||face==='back'?1:face==='left'||face==='right'?0:2;
      const sign = face==='front'||face==='left'?-1:1;
      for (const support of supports) {
        const b = bounds([support]);
        // Un rilievo non interseca il supporto, ma lo incontra spostandosi verso l’interno.
        const overlap=scope.t(solid(art).intersect(solid(support)));
        if(overlap.volume()>solid(art).volume()*.05)continue;
        // Una sede già esistente avvolge i fianchi del pezzo a metà spessore.
        const center=a.min.map((v,i)=>(v+a.max[i])/2) as [number,number,number];
        const dims=a.min.map((v,i)=>a.max[i]-v+.1) as [number,number,number];dims[axis]=(a.max[axis]-a.min[axis])*.5;
        const clip=scope.t(M.Manifold.cube(dims,true).translate(center));
        const factors:[number,number,number]=[1.01,1.01,1.01];factors[axis]=1;
        const expanded=scope.t(scope.t(scope.t(solid(art).translate(center.map(v=>-v) as [number,number,number])).scale(factors)).translate(center));
        const sides=scope.t(scope.t(expanded.intersect(clip)).intersect(solid(support)));
        if(sides.volume()>1e-5)continue;
        const inward:[number,number,number]=[0,0,0];inward[axis]=-sign*Math.min(depth,(b.max[axis]-b.min[axis])*.15);
        const source=solid(art), shifted=scope.t(source.translate(inward));
        const hit=scope.t(shifted.intersect(solid(support)));
        if(hit.volume()<1e-5)continue;
        // La parte immersa è limitata al supporto; non vengono creati piedini nel vuoto.
        const inset=hit;
        solids.set(art.id,scope.t(source.add(inset)));
        const group=cuts.get(support.id)??[];group.push(inset);cuts.set(support.id,group);
        break;
      }
    }
    for(const support of supports){const group=cuts.get(support.id);if(group?.length)solids.set(support.id,scope.t(solid(support).subtract(scope.t(M.Manifold.union(group)))));}
    return parts.map(p => solids.has(p.id)?{...p,mesh:toMeshData(solids.get(p.id)!)}:p);
  } finally {scope.free();}
}

export type Connection = 'auto' | 'seat' | 'pins';
const isSupport = (p:Part) => /^(base|body|case|lid|cap(?:-\d+)?)$/.test(p.id);
const isArt = (p:Part) => !isSupport(p) && !/^(grid|fit|switch|lower|upper)/.test(p.id);
export function hasConnectionArtwork(parts:readonly Part[]):boolean{return parts.some(isArt)&&parts.some(isSupport);}
/** Collegamenti delle decorazioni; guide, switch e incastri strutturali restano intatti. */
export function assemblyConnections(M:ManifoldToplevel,parts:readonly Part[],connection:Connection='auto'):{parts:Part[];warnings:string[]}{
 const seated=assemblySeats(M,parts);if(connection!=='pins'||!hasConnectionArtwork(seated))return {parts:seated,warnings:[]};
 const s=new Scope(),warnings:string[]=[];
 try{
  const G=M.Manifold,C=M.CrossSection,solids=new Map<string,Manifold>();
  const solid=(p:Part)=>{if(!solids.has(p.id)){const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();solids.set(p.id,s.t(new G(mesh)));}return solids.get(p.id)!;};
  let fallback=false;
  for(const art of seated.filter(isArt)){
   const face=/^art-(front|back|left|right|lid)-/.exec(art.id)?.[1];
   const rotation:[number,number,number]=face==='front'?[-90,0,0]:face==='back'?[90,0,0]:face==='left'?[0,90,0]:face==='right'?[0,-90,0]:[0,0,0];
   const inverse=rotation.map(v=>-v) as [number,number,number];
   const local=s.t(solid(art).rotate(rotation)),chunks=local.decompose().map(c=>s.t(c)),joined:Manifold[]=[];
   for(const chunk of chunks){
    const z=chunk.boundingBox().min[2],footprint=s.t(chunk.slice(z+.04)),safe=s.t(footprint.offset(-.75,'Round',2,24)),b=footprint.bounds();let connected:Manifold|undefined;
    if(!safe.isEmpty())for(const support of seated.filter(isSupport)){
     const body=s.t(solid(support).rotate(rotation));
     for(const [u,v]of [[.5,.5],...Array.from({length:49},(_,i)=>[(i%7+.5)/7,(Math.floor(i/7)+.5)/7])]){
      const x=b.min[0]+(b.max[0]-b.min[0])*u,y=b.min[1]+(b.max[1]-b.min[1])*v;
      const point=s.t(s.t(C.circle(.03,16)).translate([x,y]));if(s.t(point.subtract(safe)).area()>1e-8)continue;
      const depth=.6,probe=s.t(s.t(G.cylinder(depth,.7,.7,24)).translate([x,y,z-depth-.1]));
      if(s.t(probe.intersect(body)).volume()<probe.volume()*.995)continue;
      const pin=s.t(s.t(G.cylinder(depth+.1,.45,.55,24)).translate([x,y,z-depth]));
      const socket=s.t(s.t(G.cylinder(depth+.04,.7,.7,24)).translate([x,y,z-depth-.02]));
      const next=s.t(body.subtract(socket)),count=next.decompose().map(c=>s.t(c)).length,oldCount=body.decompose().map(c=>s.t(c)).length;
      if(count!==oldCount)continue;
      connected=s.t(chunk.add(pin));solids.set(support.id,s.t(next.rotate(inverse)));break;
     }
     if(connected)break;
    }
    if(!connected)fallback=true;joined.push(connected??chunk);
   }
   if(joined.length)solids.set(art.id,s.t(s.t(G.union(joined)).rotate(inverse)));
  }
  if(fallback)warnings.push('I dettagli sottili o senza appoggio sufficiente usano soltanto la sede sagomata.');
  return {parts:seated.map(p=>solids.has(p.id)?{...p,mesh:toMeshData(solids.get(p.id)!)}:p),warnings};
 }finally{s.free();}
}
