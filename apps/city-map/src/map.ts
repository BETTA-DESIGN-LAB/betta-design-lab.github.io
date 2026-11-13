import {el} from '@bdl/ui-kit';
import {bbox,extent,LAT_METRES,lonMetres,type Area,type Point} from './data.ts';
import {MARKER_SOCKET_RADIUS} from './accessories.ts';
import {formPoints,type Form} from './forms.ts';
const world=(p:Point,n:number):[number,number]=>[(p.lon+180)/360*n,(1-Math.asinh(Math.tan(p.lat*Math.PI/180))/Math.PI)*n/2];
const locationAt=(x:number,y:number,n:number):Point=>({lon:x/n*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI});
export function mapPicker(move:(point:Point)=>void,place:(point?:Point)=>void) {
  const tiles=el('div',{class:'bdl-city-tiles','aria-hidden':'true'});
  const outline=document.createElementNS('http://www.w3.org/2000/svg','svg');
  outline.setAttribute('class','bdl-city-extent');outline.setAttribute('aria-hidden','true');
  const boundary=document.createElementNS(outline.namespaceURI,'polygon');
  boundary.setAttribute('vector-effect','non-scaling-stroke');outline.append(boundary);
  const marker=el('span',{class:'bdl-city-marker','aria-hidden':'true'});
  marker.hidden=true;
  const map=el('div',{class:'bdl-city-picker',tabindex:0,role:'group','aria-label':'Selezione sulla mappa. Trascina o usa le frecce.'},tiles,outline,marker);
  let selected:Area|undefined;
  let placing=false,position:Point|undefined,draft:Point|undefined;
  let profile:ReturnType<typeof formPoints>=[],size=180;
  const valid=(point:Point)=>{
    if(!selected)return false;
    const x=(point.lon-selected.lon)*lonMetres(selected.lat),y=(point.lat-selected.lat)*LAT_METRES;
    const radius=(MARKER_SOCKET_RADIUS+.4)*selected.span/size;
    return Array.from({length:12},(_,i)=>i*Math.PI/6).every(a=>{
      const u=x+radius*Math.cos(a),v=y+radius*Math.sin(a);
      let inside=false;
      for(let i=0,j=profile.length-1;i<profile.length;j=i++){
        const [px,py]=profile[i],[qx,qy]=profile[j];
        if((py>v)!==(qy>v)&&u<(qx-px)*(v-py)/(qy-py)+px)inside=!inside;
      }
      return inside;
    });
  };
  const drawMarker=()=>{
    const point=draft??position;
    marker.hidden=!point||!valid(point);
    if(marker.hidden||!point)return;
    const [x,y]=world(point,n);
    marker.style.left=(x-center[0]+map.clientWidth/2)+'px';
    marker.style.top=(y-center[1]+map.clientHeight/2)+'px';
  };
  let center:[number,number]=[0,0],n=1;
  const draw=()=>{
    if(!selected||!map.clientWidth)return;
    const w=map.clientWidth,h=map.clientHeight;
    const [s,l,b,r]=bbox(selected);
    const [x0,y0]=world({lat:b,lon:l},1),[x1,y1]=world({lat:s,lon:r},1);
    const z=Math.max(2,Math.min(19,Math.floor(Math.log2(Math.min(w*.83/(x1-x0),h*.83/(y1-y0))/256))));
    n=256*2**z;
    center=world(selected,n);
    const ox=center[0]-w/2,oy=center[1]-h/2,images:HTMLImageElement[]=[];
    for(let x=Math.floor(ox/256);x<=Math.floor((ox+w)/256);x++)for(let y=Math.floor(oy/256);y<=Math.floor((oy+h)/256);y++) {
      if(y<0||y>=2**z)continue;
      const tx=((x%2**z)+2**z)%2**z;
      const img=el('img',{src:'https://tile.openstreetmap.org/'+z+'/'+tx+'/'+y+'.png',alt:'',draggable:false});
      img.style.left=(x*256-ox)+'px';img.style.top=(y*256-oy)+'px';
      images.push(img);
    }
    tiles.replaceChildren(...images);
    outline.style.width=(x1-x0)*n+'px';outline.style.height=(y1-y0)*n+'px';
    drawMarker();
  };
  new ResizeObserver(draw).observe(map);
  let drag:{x:number;y:number}|undefined;
  map.addEventListener('pointerdown',e=>{
    if(!selected||e.button!==0)return;
    drag={x:e.clientX,y:e.clientY};map.setPointerCapture(e.pointerId);
  });
  map.addEventListener('pointermove',e=>{
    if(drag&&!placing)tiles.style.transform='translate('+(e.clientX-drag.x)+'px,'+(e.clientY-drag.y)+'px)';
  });
  map.addEventListener('pointerup',e=>{
    if(!drag)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    drag=undefined;tiles.style.transform='';
    if(placing){
      const rect=map.getBoundingClientRect();
      const point=locationAt(center[0]+e.clientX-rect.left-rect.width/2,center[1]+e.clientY-rect.top-rect.height/2,n);
      place(valid(point)?point:undefined);
    }else if(Math.hypot(dx,dy)>3)move(locationAt(center[0]-dx,center[1]-dy,n));
  });
  map.addEventListener('pointercancel',()=>{drag=undefined;tiles.style.transform='';});
  map.addEventListener('keydown',e=>{
    if(placing&&e.key==='Enter'){
      e.preventDefault();const point=draft??position??selected;place(point&&valid(point)?point:undefined);return;
    }
    const dirs:Record<string,[number,number]>={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};
    const d=dirs[e.key];if(!d)return;
    e.preventDefault();
    if(placing){
      const start=draft??position;
      const [x,y]=start&&valid(start)?world(start,n):center;
      const point=locationAt(x+d[0]/4,y+d[1]/4,n);
      if(valid(point)){draft=point;drawMarker();}
    }else move(locationAt(center[0]+d[0],center[1]+d[1],n));
  });
  return {root:el('div',{class:'bdl-city-map'},map,
    el('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener',class:'bdl-city-attribution'},'© OpenStreetMap · ODbL')),
    setArea(a:Area,form:Form,modelSize:number){
      selected=a;size=modelSize;
      const [w,h]=extent(a);profile=formPoints(form,w,h);
      outline.setAttribute('viewBox',[-w/2,-h/2,w,h].join(' '));
      outline.setAttribute('preserveAspectRatio','none');
      boundary.setAttribute('points',profile.map(([x,y])=>x+','+(-y)).join(' '));
      draw();
    },
    setMarker(point?:Point){position=point;drawMarker();},
    setPlacement(value:boolean){
      placing=value;draft=undefined;map.classList.toggle('is-placing',value);drawMarker();
      map.setAttribute('aria-label',value?'Posizione segnaposto. Usa le frecce e premi Invio.':'Selezione sulla mappa. Trascina o usa le frecce.');
      if(value)map.focus();
    },
    valid

  };
}
