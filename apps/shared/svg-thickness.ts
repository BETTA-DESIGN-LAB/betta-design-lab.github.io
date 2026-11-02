import {type CrossSection,type Scope} from '@bdl/geometry';
export function thickenSvg(scope:Scope,shape:CrossSection,amount:number|undefined):CrossSection{
 const width=typeof amount==='number'&&Number.isFinite(amount)?Math.max(0,Math.min(2,amount)):0;
 return width>0?scope.t(shape.offset(width/2,'Round',2,32)):shape;
}
