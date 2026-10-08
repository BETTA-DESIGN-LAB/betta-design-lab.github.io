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
