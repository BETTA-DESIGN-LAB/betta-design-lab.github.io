import {bounds,type Part} from '@bdl/geometry';
import {groundPart} from '../../coaster/src/parts.ts';
import {currentPlacement,placePart,type Placements} from '../../box/src/placement.ts';
import type {Params} from './params.ts';
export {currentPlacement};
export interface Machine {name:string;width:number;depth:number;speed:number}
export interface Plate {name:string;parts:Part[]}
export function layout(parts:Part[],p:Params,machines:Machine[],pinned:Placements={}) {
  const warnings:string[]=[],oversized:string[]=[],plates:Plate[]=[];
  const loads=machines.map(()=>0);
  const groups=machines.map(()=>[] as Part[]);
  const usable=(machine:Machine)=> {
    const width=machine.width-2*p.margin,depth=machine.depth-2*p.margin;
    return p.roundBed?[Math.min(width,depth)/Math.SQRT2,Math.min(width,depth)/Math.SQRT2]:[width,depth];
  };
  for(const part of [...parts].sort((a,b)=>{const A=bounds([a]),B=bounds([b]);return (B.max[0]-B.min[0])*(B.max[1]-B.min[1])-(A.max[0]-A.min[0])*(A.max[1]-A.min[1]);})){
    const box=bounds([part]),w=box.max[0]-box.min[0],h=box.max[1]-box.min[1];
    const targets=machines.map((machine,index)=>({index,area:usable(machine)})).filter(({area:[x,y]})=>w<=x&&h<=y||p.rotate&&h<=x&&w<=y).sort((a,b)=>loads[a.index]-loads[b.index]);
    if(!targets.length){oversized.push(part.name);continue;}
    const target=targets[0].index;groups[target].push(part);
    loads[target]+=w*h*(box.max[2]-box.min[2])/machines[target].speed;
  }
  for(const [machineIndex,items] of groups.entries()){
    const machine=machines[machineIndex],[uw,ud]=usable(machine);
    const rows:{x:number;y:number;height:number}[][]=[];
    const local:Part[][]=[];
    for(const part of items){
      const flat=groundPart(part),box=bounds([flat]),w=box.max[0]-box.min[0],h=box.max[1]-box.min[1];
      let placed=false;
      for(let plate=0;!placed;plate++){
        if(!local[plate]){local.push([]);rows.push([]);}
        for(const turn of p.rotate?[false,true]:[false]){
          const iw=turn?h:w,ih=turn?w:h;
          if(iw>uw||ih>ud)continue;
          let row=rows[plate].find(row=>ih<=row.height+.001&&row.x+iw<=uw);
          if(!row){const y=rows[plate].reduce((y,row)=>Math.max(y,row.y+row.height+5),0);if(y+ih>ud)continue;row={x:0,y,height:ih};rows[plate].push(row);}
          local[plate].push(placePart(flat,{x:row.x+iw/2-uw/2,y:row.y+ih/2-ud/2,angle:turn?90:0,plate:0}));
          row.x+=iw+5;placed=true;break;
        }
      }
    }
    for(const [index,parts] of local.entries())plates.push({name:machine.name+' · piatto '+(index+1),parts});
  }
  for(const part of parts){
    const at=pinned[part.id];if(!at)continue;
    if(at.plate<0||at.plate>=plates.length)continue;
    for(const plate of plates)plate.parts=plate.parts.filter(item=>item.id!==part.id);
    plates[at.plate].parts.push(placePart(part,at));
  }
  for(const [index,plate]of plates.entries()){
    const machine=machines.find(machine=>plate.name.startsWith(machine.name+' ·'))!;
    const boxes=plate.parts.map(part=>bounds([part]));
    boxes.forEach((b,i)=>{
      const out=b.min[0]<-machine.width/2+p.margin-.01||b.max[0]>machine.width/2-p.margin+.01||b.min[1]<-machine.depth/2+p.margin-.01||b.max[1]>machine.depth/2-p.margin+.01;
      const circle=p.roundBed&&[[b.min[0],b.min[1]],[b.min[0],b.max[1]],[b.max[0],b.min[1]],[b.max[0],b.max[1]]].some(([x,y])=>Math.hypot(x,y)>Math.min(machine.width,machine.depth)/2-p.margin+.01);
      if(out||circle)warnings.push('Piatto '+(index+1)+': '+plate.parts[i].name+' fuori dal margine.');
    });
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(Math.min(boxes[i].max[0],boxes[j].max[0])-Math.max(boxes[i].min[0],boxes[j].min[0])>.01&&Math.min(boxes[i].max[1],boxes[j].max[1])-Math.max(boxes[i].min[1],boxes[j].min[1])>.01)warnings.push('Piatto '+(index+1)+': sposta i pezzi sovrapposti.');
  }
  return {plates,warnings,oversized};
}
