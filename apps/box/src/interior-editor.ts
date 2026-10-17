import { button, el, segmented } from '@bdl/ui-kit';
import type { Params } from './params.ts';
import { dividerRect, interiorRooms, interiorSize, readDividers, type Divider } from './interior.ts';

export function interiorEditor(get: () => Params, change: (patch: Partial<Params>) => void) {
  let selected = -1, roomIndex = -1;
  const root = el('div', { class: 'bdl-interior-editor' });
  const mode = segmented({ label: 'Disposizione interna', value: get().interiorMode,
    options: [{value:'automatic',label:'Scomparti uguali'},{value:'custom',label:'Disegna tu'}], onChange: v => {
      selected=-1;roomIndex=-1;
      change({interiorMode:v as Params['interiorMode']});
    }});
  const custom = el('div', {class:'bdl-interior-custom'}), summary = el('p',{class:'bdl-hint'});
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');svg.classList.add('bdl-interior-plan');
  svg.setAttribute('role','group');svg.setAttribute('aria-label','Pianta interna: seleziona e trascina i divisori');
  const node = (tag:string,attrs:Record<string,string|number>,text?:string) => {
    const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;
  };
  const rows=el('div',{class:'bdl-interior-list','aria-label':'Divisori del progetto'});
  const dimensions=el('div',{class:'bdl-interior-rooms','aria-live':'polite'});
  const inspector=el('div',{class:'bdl-interior-inspector'});
  const fields = new Map<'at'|'start'|'end',HTMLInputElement>();
  for(const [key,label] of [['at','Posizione dal bordo interno (mm)'],['start','Inizio dal bordo interno (mm)'],['end','Fine dal bordo interno (mm)']] as const) {
    const input=el('input',{type:'number',class:'bdl-input',step:.1,min:0,'aria-label':label});
    input.addEventListener('change',()=>{const list=items();if(!list[selected]||!Number.isFinite(input.valueAsNumber))return;list[selected]={...list[selected],[key]:input.valueAsNumber};commit(list);});
    fields.set(key,input);inspector.append(el('label',{},label,input));
  }
  const remove=button({label:'Elimina divisorio',variant:'ghost',onClick:()=>{const list=items();list.splice(selected,1);selected=-1;commit(list);}});inspector.append(remove);
  function items(){return readDividers(get().dividerData,get());}
  function commit(list:Divider[]){change({interiorMode:'custom',dividers:true,dividerData:JSON.stringify(list)});}
  function add(axis:Divider['axis']) {
    const p=get(),list=items();if(list.length>=24)return;
    const size=interiorSize(p),rooms=interiorRooms(p,list);
    const room=rooms[roomIndex]??rooms.filter(r=>r.rectangular).sort((a,b)=>b.width*b.depth-a.width*a.depth)[0]??{x:0,y:0,width:size.width,depth:size.depth};
    const d:Divider=axis==='vertical'
      ?{axis,at:room.x+room.width/2,start:Math.max(0,room.y-p.wall/2),end:Math.min(size.depth,room.y+room.depth+p.wall/2)}
      :{axis,at:room.y+room.depth/2,start:Math.max(0,room.x-p.wall/2),end:Math.min(size.width,room.x+room.width+p.wall/2)};
    selected=list.length;roomIndex=-1;commit([...list,d]);
  }
  const addV=button({label:'Aggiungi verticale',onClick:()=>add('vertical')}),addH=button({label:'Aggiungi orizzontale',onClick:()=>add('horizontal')});
  custom.append(summary,el('div',{class:'bdl-row'},addV,addH),el('p',{class:'bdl-hint'},'Tocca un vano per dividerlo. Trascina il divisorio per spostarlo; usa i due punti alle estremità per allungarlo o accorciarlo. Si aggancia alle pareti e agli altri divisori.'),svg,rows,inspector,dimensions,
    el('p',{class:'bdl-hint'},'Le misure sono nette, tra le facce delle pareti. Gli angoli arrotondati riducono lo spazio agli angoli. I divisori sono uniti al fondo e hanno lo stesso spessore delle pareti.'),
    button({label:'Svuota interno',variant:'ghost',onClick:()=>{selected=-1;roomIndex=-1;commit([]);}}));
  root.append(mode.root,custom);
  let drag: {pointer:number;index:number;handle:string;initial:Divider;point:{x:number;y:number}} | undefined;
  function point(e:PointerEvent){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const matrix=svg.getScreenCTM();return matrix?pt.matrixTransform(matrix.inverse()):{x:0,y:0};}
  svg.addEventListener('pointerdown',e=>{
    const target=e.target as Element, index=target.getAttribute('data-divider'), room=target.getAttribute('data-room');
    if(index===null){selected=-1;roomIndex=room===null?-1:Number(room);render();return;}
    selected=Number(index);const initial=items()[selected];if(!initial)return;
    drag={pointer:e.pointerId,index:selected,handle:target.getAttribute('data-handle')??'move',initial:{...initial},point:point(e)};
    svg.setPointerCapture(e.pointerId);e.preventDefault();render();
  });
  svg.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;
    const p=get(),size=interiorSize(p),list=items(),pos=point(e),d={...drag.initial};
    const vertical=d.axis==='vertical',across=vertical?size.width:size.depth,span=vertical?size.depth:size.width;
    const deltaAt=vertical?pos.x-drag.point.x:pos.y-drag.point.y,deltaAlong=vertical?pos.y-drag.point.y:pos.x-drag.point.x;
    const snap=(v:number,points:number[])=>{const closest=points.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a,v+2);return Math.abs(closest-v)<1.2?closest:v;};
    const alongPoints=[0,span,...list.filter((_,i)=>i!==drag!.index).flatMap(v=>v.axis===d.axis?[v.start,v.end]:[v.at])];
    if(drag.handle==='start')d.start=Math.max(0,Math.min(d.end-1,snap(d.start+deltaAlong,alongPoints)));
    else if(drag.handle==='end')d.end=Math.min(span,Math.max(d.start+1,snap(d.end+deltaAlong,alongPoints)));
    else {
      const references=list.filter((_,i)=>i!==drag!.index).flatMap(v=>v.axis===d.axis?[v.at]:[v.start,v.end]);
      d.at=Math.max(p.wall/2,Math.min(across-p.wall/2,snap(d.at+deltaAt,references)));
      const length=d.end-d.start;
      const start=snap(d.start+deltaAlong,alongPoints),end=snap(d.end+deltaAlong,alongPoints);
      const candidate=Math.abs(end-(d.end+deltaAlong))<Math.abs(start-(d.start+deltaAlong))?end-length:start;
      d.start=Math.max(0,Math.min(span-length,candidate));d.end=d.start+length;
    }
    list[drag.index]=d;commit(list);
  });
  const finish=(e:PointerEvent)=>{if(drag?.pointer===e.pointerId){drag=undefined;render();}};
  svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
  function render(){
    const p=get(),size=interiorSize(p),list=items(),rooms=interiorRooms(p,list);
    mode.set(p.interiorMode);custom.hidden=p.interiorMode!=='custom'||!p.dividers;
    summary.textContent=`Spazio interno ${size.width.toFixed(1)} × ${size.depth.toFixed(1)} mm · pareti ${p.wall.toFixed(1)} mm`;
    addV.disabled=addH.disabled=list.length>=24;
    svg.setAttribute('viewBox',`-5 -5 ${size.width+10} ${size.depth+10}`);svg.replaceChildren();
    svg.append(node('rect',{x:0,y:0,width:size.width,height:size.depth,rx:size.radius,class:'bdl-interior-floor'}));
    rooms.forEach((r,i)=>{svg.append(node('rect',{x:r.x,y:r.y,width:r.width,height:r.depth,'data-room':i,class:i===roomIndex?'bdl-interior-room is-selected':'bdl-interior-room'}));
      if(r.rectangular&&r.width>12&&r.depth>9)svg.append(node('text',{x:r.x+r.width/2,y:r.y+r.depth/2,'text-anchor':'middle','dominant-baseline':'middle',class:'bdl-interior-measure','font-size':Math.max(2.2,Math.min(3.8,r.width/15))},`${r.width.toFixed(1)} × ${r.depth.toFixed(1)}`));});
    list.forEach((d,i)=>{
      const r=dividerRect(d,p.wall),attrs={'data-divider':i};
      svg.append(node('rect',{x:r.x,y:r.y,width:r.width,height:r.depth,...attrs,class:i===selected?'bdl-interior-divider is-selected':'bdl-interior-divider'}));
      svg.append(node('line',{x1:d.axis==='vertical'?d.at:d.start,y1:d.axis==='vertical'?d.start:d.at,x2:d.axis==='vertical'?d.at:d.end,y2:d.axis==='vertical'?d.end:d.at,...attrs,class:'bdl-interior-hit'}));
      if(i===selected)for(const handle of ['start','end'] as const)svg.append(node('circle',{cx:d.axis==='vertical'?d.at:d[handle],cy:d.axis==='vertical'?d[handle]:d.at,r:Math.max(1.6,Math.min(3,size.width/55)),...attrs,'data-handle':handle,class:'bdl-interior-handle'}));
    });
    rows.replaceChildren(...list.map((d,i)=>{const b=button({label:`${i+1} · ${d.axis==='vertical'?'Verticale':'Orizzontale'}`,variant:i===selected?'primary':'ghost',onClick:()=>{selected=i;roomIndex=-1;render();}});b.setAttribute('aria-pressed',String(i===selected));return b;}));
    inspector.hidden=!list[selected];
    const d=list[selected];if(d)for(const [key,input]of fields){if(document.activeElement!==input)input.value=String(Math.round(d[key]*10)/10);input.max=String(key==='at'?(d.axis==='vertical'?size.width:size.depth):(d.axis==='vertical'?size.depth:size.width));}
    dimensions.replaceChildren(...rooms.map((r,i)=>el('p',{class:'bdl-hint'},`Vano ${i+1}: ${r.rectangular?`${r.width.toFixed(1)} × ${r.depth.toFixed(1)} mm`:'forma irregolare'}`)));
  }
  return {root,sync:render};
}
