import type {bounds} from '@bdl/geometry';

type Box=ReturnType<typeof bounds>;
type Point=[number,number,number];
type Project=(point:Point)=>{x:number;y:number;visible:boolean};
const SVG='http://www.w3.org/2000/svg';

export function dimensions(host:HTMLElement){
  const overlay=document.createElementNS(SVG,'svg');
  overlay.classList.add('bdl-city-dimensions');
  overlay.setAttribute('role','img');
  const marks=Array.from({length:3},()=>{
    const group=document.createElementNS(SVG,'g');
    const line=document.createElementNS(SVG,'path');
    const text=document.createElementNS(SVG,'text');
    text.setAttribute('text-anchor','middle');
    group.append(line,text);overlay.append(group);
    return {group,line,text};
  });
  host.append(overlay);
  let box:Box|undefined,enabled=true;
  function update(project:Project){
    if(!box||!enabled){overlay.style.display='none';return;}
    overlay.style.display='';
    const [x,y,z]=box.min,[X,Y,Z]=box.max;
    const gap=Math.max(X-x,Y-y)*.075;
    const guides:[Point,Point,Point,Point][]=[
      [[x,y,z],[x,y-gap,z],[X,y-gap,z],[X,y,z]],
      [[X,y,z],[X+gap,y,z],[X+gap,Y,z],[X,Y,z]],
      [[x,y,z],[x-gap,y-gap,z],[x-gap,y-gap,Z],[x,y,Z]],
    ];
    const w=host.clientWidth,h=host.clientHeight;
    const used:{x:number;y:number}[]=[];
    guides.forEach((points,i)=>{
      const [a,b,c,d]=points.map(project);
      const {group,line,text}=marks[i];
      if(!a.visible||!b.visible||!c.visible||!d.visible){group.style.display='none';return;}
      group.style.display='';
      const dx=c.x-b.x,dy=c.y-b.y,length=Math.hypot(dx,dy);
      const nx=length>1?-dy/length:0,ny=length>1?dx/length:1;
      line.setAttribute('d','M '+a.x+' '+a.y+' L '+b.x+' '+b.y+' L '+c.x+' '+c.y+' L '+d.x+' '+d.y+
        ' M '+(b.x-nx*5)+' '+(b.y-ny*5)+' L '+(b.x+nx*5)+' '+(b.y+ny*5)+
        ' M '+(c.x-nx*5)+' '+(c.y-ny*5)+' L '+(c.x+nx*5)+' '+(c.y+ny*5));
      const middle={x:(b.x+c.x)/2,y:(b.y+c.y)/2};
      let tx=Math.max(46,Math.min(w-46,middle.x+(i===2?-19:i===1?22:0)));
      let ty=Math.max(44,Math.min(h-70,middle.y+(i===0?18:-9)));
      for(const other of used)if(Math.abs(other.x-tx)<86&&Math.abs(other.y-ty)<21)ty=Math.max(33,other.y-23);
      used.push({x:tx,y:ty});
      text.setAttribute('x',String(tx));text.setAttribute('y',String(ty));
    });
  }
  return {
    setBox(value:Box|undefined){
      box=value;
      if(!box)return;
      const values=box.max.map((m,i)=>(m-box!.min[i]).toLocaleString('it-IT',{maximumFractionDigits:1})+' mm');
      marks.forEach((mark,i)=>{mark.text.textContent=values[i];});
      overlay.setAttribute('aria-label','Larghezza '+values[0]+', profondità '+values[1]+', altezza '+values[2]);
    },
    setEnabled(value:boolean){enabled=value;},
    update
  };
}
