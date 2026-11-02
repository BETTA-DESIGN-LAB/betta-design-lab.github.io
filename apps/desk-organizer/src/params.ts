export interface Compartment{id:string;name:string;w:number;d:number;h:number;shape?:'rounded'|'square';color?:string;x:number;y:number;}
export interface Params{[key:string]:string|number|boolean;style:'onda'|'cannete';base:boolean;fitToPlate:boolean;autoTray:boolean;width:number;depth:number;thickness:number;rim:number;wall:number;floor:number;clearance:number;color:string;baseColor:string;moduleData:string;}
export const INITIAL:Compartment[]=[
 {id:'module-1',name:'Portapenne',w:82,d:90,h:95,x:10,y:10,color:'#eee8d9'},
 {id:'module-2',name:'Vaschetta accessori',w:82,d:56,h:26,x:10,y:104,color:'#ff4b16'},
 {id:'module-3',name:'Vano alto',w:164,d:90,h:58,x:96,y:10,color:'#ff4b16'},
 {id:'module-4',name:'Scomparto piccolo',w:164,d:56,h:26,x:96,y:104,color:'#eee8d9'},
];
export const DEFAULTS:Params={style:'onda',base:true,fitToPlate:true,autoTray:true,width:270,depth:170,thickness:4,rim:18,wall:2.4,floor:3.6,clearance:.2,color:'#eee8d9',baseColor:'#363936',moduleData:JSON.stringify(INITIAL)};
const num=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):f;
export function compartments(data:unknown):Compartment[]{
 try{const a=typeof data==='string'?JSON.parse(data):data;if(!Array.isArray(a)||!a.length||a.length>8)throw 0;
 const ids=new Set<string>();return a.map((m,i)=>{if(!m||typeof m!=='object')throw 0;const id=typeof m.id==='string'&&/^module-[1-9]\d{0,2}$/.test(m.id)&&!ids.has(m.id)?m.id:'module-'+(i+1);if(ids.has(id))throw 0;ids.add(id);
 return{id,...(typeof m.color==='string'&&/^#[0-9a-f]{6}$/i.test(m.color)?{color:m.color}:{}),shape:m.shape==='square'?'square':'rounded',name:typeof m.name==='string'?m.name.slice(0,48).trim()||'Scomparto '+(i+1):'Scomparto '+(i+1),w:num(m.w,60,30,260),d:num(m.d,50,30,220),h:num(m.h,35,12,160),x:num(m.x,6,-500,500),y:num(m.y,6,-500,500)};});
 }catch{return INITIAL.map(m=>({...m}));}
}
export function sanitize(input:Partial<Params>):Params{
 const p={...DEFAULTS,...input},color=(v:unknown,f:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:f;
 return{style:p.style==='cannete'?'cannete':'onda',base:typeof p.base==='boolean'?p.base:true,fitToPlate:p.fitToPlate!==false,autoTray:p.autoTray!==false,width:num(p.width,270,140,500),depth:num(p.depth,170,100,350),thickness:num(p.thickness,5,4,12),rim:num(p.rim,3,0,30),wall:num(p.wall,2.4,1.6,4),floor:num(p.floor,3.6,3.2,6),clearance:num(p.clearance,.2,.12,.4),color:color(p.color,DEFAULTS.color),baseColor:color(p.baseColor,DEFAULTS.baseColor),moduleData:JSON.stringify(compartments(p.moduleData))};
}
export function moduleWarnings(p:Params):string[]{
 const a=compartments(p.moduleData),messages:string[]=[];
 for(const m of a){const extra=p.style==='cannete'?1:0;if(p.base&&(m.x<5+extra||m.y<5+extra||m.x+m.w>p.width-5-extra||m.y+m.d>p.depth-5-extra))messages.push(m.name+': supera la base. Spostalo, ridimensionalo o amplia il vassoio.');}
 if(p.base)for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i].x<a[j].x+a[j].w+2&&a[i].x+a[i].w+2>a[j].x&&a[i].y<a[j].y+a[j].d+2&&a[i].y+a[i].d+2>a[j].y)messages.push(a[i].name+' e '+a[j].name+': lascia almeno 2 mm di spazio.');return messages;
}
export function addCompartment(p:Params,plate:readonly[number,number]=[256,256]):Compartment[]|null{
 const a=compartments(p.moduleData);if(a.length>=8)return null;
 const w=60,d=48,gap=4,margin=10;
 const xs=[margin,...a.map(m=>m.x+m.w+gap)],ys=[margin,...a.map(m=>m.y+m.d+gap)];
 const candidates=xs.flatMap(x=>ys.map(y=>({x,y}))).filter(({x,y})=>x+w+margin<=500&&y+d+margin<=350&&!a.some(m=>x<m.x+m.w+gap&&x+w+gap>m.x&&y<m.y+m.d+gap&&y+d+gap>m.y));
 const size=({x,y}:{x:number;y:number})=>[Math.max(140,x+w+margin,...a.map(m=>m.x+m.w+margin)),Math.max(100,y+d+margin,...a.map(m=>m.y+m.d+margin))];
 candidates.sort((a,b)=>{const A=size(a),B=size(b),fits=(v:number[])=>v[0]<=plate[0]-14&&v[1]<=plate[1]-14;return Number(!fits(A))-Number(!fits(B))||A[0]*A[1]-B[0]*B[1]||a.y-b.y||a.x-b.x;});
 const at=candidates[0];if(!at)return null;
 const id='module-'+(Math.max(...a.map(m=>Number(m.id.split('-')[1])))+1);
 return[...a,{id,name:'Scomparto '+(a.length+1),w,d,h:32,...at}];
}

/** Il vassoio segue gli ingombri, senza alterare i contenitori. */
export function trayAroundContents(input:Params,plate:readonly[number,number]):Params{
 const p=sanitize(input),a=compartments(p.moduleData);
 p.width=Math.min(500,Math.max(140,...a.map(m=>m.x+m.w+10)));
 p.depth=Math.min(350,Math.max(100,...a.map(m=>m.y+m.d+10)));
 if(p.width>plate[0]-14||p.depth>plate[1]-14)p.fitToPlate=false;
 return p;
}

/** Adatta insieme vassoio e contenitori; le quote sono sempre nette, inclusi margini e nervature. */
export function fitOrganizer(input:Params,plate:readonly[number,number],previous?:Params):Params{
 const p=sanitize(input),old=previous?sanitize(previous):sanitize(input),margin=10,gap=3;
 // Durante la composizione non ridimensionare né riordinare i moduli esistenti.
 if(previous&&p.moduleData!==old.moduleData)return p.autoTray?trayAroundContents(p,plate):p;
 if(previous&&!p.autoTray&&(p.width!==old.width||p.depth!==old.depth))return p;
 const limits=[Math.max(140,Math.min(500,plate[0]-14)),Math.max(100,Math.min(350,plate[1]-14))];
 if(p.fitToPlate){p.width=Math.min(p.width,limits[0]);p.depth=Math.min(p.depth,limits[1]);}
 let items=compartments(p.moduleData);
 if(old.width!==p.width||old.depth!==p.depth){
  const sx=(p.width-2*margin)/(old.width-2*margin),sy=(p.depth-2*margin)/(old.depth-2*margin);
  items=items.map(m=>({...m,x:margin+(m.x-margin)*sx,y:margin+(m.y-margin)*sy,w:Math.max(30,(m.w+gap)*sx-gap),d:Math.max(30,(m.d+gap)*sy-gap)}));
 }
 const w=p.width-2*margin,d=p.depth-2*margin;
 const valid=(a:Compartment[])=>a.every(m=>m.x>=margin-.001&&m.y>=margin-.001&&m.x+m.w<=p.width-margin+.001&&m.y+m.d<=p.depth-margin+.001)&&a.every((m,i)=>a.slice(i+1).every(n=>m.x+m.w+gap<=n.x+.001||n.x+n.w+gap<=m.x+.001||m.y+m.d+gap<=n.y+.001||n.y+n.d+gap<=m.y+.001));
 items=items.map(m=>({...m,w:Math.min(w,m.w),d:Math.min(d,m.d),x:Math.max(margin,Math.min(p.width-margin-Math.min(w,m.w),m.x)),y:Math.max(margin,Math.min(p.depth-margin-Math.min(d,m.d),m.y))}));
 if(p.base&&!valid(items)){
  const source=items;
  let placed:Compartment[]|undefined;
  for(let k=1;k>=.25&&!placed;k-=.05){
   const a:Compartment[]=[];
   for(const m of source){
    const next={...m,w:Math.max(30,m.w*k),d:Math.max(30,m.d*k)};let found=false;
    // Candidate edges allow tight packing without a coarse positional grid.
    const xs=[margin,...a.map(v=>v.x+v.w+gap)],ys=[margin,...a.map(v=>v.y+v.d+gap)];
    for(const y of ys.sort((a,b)=>a-b)){for(const x of xs.sort((a,b)=>a-b)){
     const candidate={...next,x,y};if(valid([...a,candidate])){a.push(candidate);found=true;break;}
    }if(found)break;}
    if(!found)break;
   }
   if(a.length===source.length)placed=a;
  }
  if(placed)items=placed;
  else{
   // Preserve every compartment; increase a too-small requested tray if the plate permits.
   const options=Array.from({length:items.length},(_,i)=>i+1).map(cols=>({cols,rows:Math.ceil(items.length/cols)})).filter(o=>o.cols*30+(o.cols-1)*gap+2*margin<=limits[0]&&o.rows*30+(o.rows-1)*gap+2*margin<=limits[1]);
   const best=options.sort((a,b)=>Math.max(0,a.cols*33+17-p.width)+Math.max(0,a.rows*33+17-p.depth)-Math.max(0,b.cols*33+17-p.width)-Math.max(0,b.rows*33+17-p.depth))[0];
   if(best){p.width=Math.max(p.width,best.cols*33+17);p.depth=Math.max(p.depth,best.rows*33+17);const cw=(p.width-20-(best.cols-1)*gap)/best.cols,cd=(p.depth-20-(best.rows-1)*gap)/best.rows;items=items.map((m,i)=>({...m,w:cw,d:cd,x:10+(i%best.cols)*(cw+gap),y:10+Math.floor(i/best.cols)*(cd+gap)}));}
  }
 }
 p.moduleData=JSON.stringify(items);
 return p;
}
