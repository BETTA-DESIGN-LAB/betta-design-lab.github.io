import {type ManifoldToplevel,Scope,type Manifold} from '@bdl/geometry';
/** Attacco comune a tutti i manici: raggio 6 mm, passo 2, tre giri. */
export function attachment(M:ManifoldToplevel,s:Scope,clearance=0):Manifold{
 const t=<T extends {delete():void}>(v:T)=>s.t(v),vertices:number[]=[],faces:number[]=[],steps=144,radius=6;
 for(let i=0;i<=steps;i++){const a=i/steps*6*Math.PI,z=1+i/steps*6;for(const [r,dz]of [[radius-.12,-.65-clearance*.4],[radius+.75+clearance,0],[radius-.12,.65+clearance*.4]])vertices.push(r*Math.cos(a),r*Math.sin(a),z+dz);}
 for(let i=0;i<steps;i++)for(let k=0;k<3;k++){const a=i*3+k,b=i*3+(k+1)%3,c=(i+1)*3+k,d=(i+1)*3+(k+1)%3;faces.push(a,b,c,b,d,c);}faces.push(0,2,1,steps*3,steps*3+1,steps*3+2);
 let volume=0;for(let i=0;i<faces.length;i+=3){const a=faces[i]*3,b=faces[i+1]*3,c=faces[i+2]*3;volume+=vertices[a]*(vertices[b+1]*vertices[c+2]-vertices[b+2]*vertices[c+1])+vertices[a+1]*(vertices[b+2]*vertices[c]-vertices[b]*vertices[c+2])+vertices[a+2]*(vertices[b]*vertices[c+1]-vertices[b+1]*vertices[c]);}
 if(volume<0)for(let i=0;i<faces.length;i+=3)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
 const ridge=t(new M.Manifold(new M.Mesh({numProp:3,vertProperties:new Float32Array(vertices),triVerts:new Uint32Array(faces)})));
 return t(t(M.Manifold.cylinder(8.2,6+clearance,6+clearance,72)).add(ridge));
}
