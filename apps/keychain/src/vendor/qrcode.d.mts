interface QR { addData(data:string,mode?:string):void; make():void; getModuleCount():number; isDark(row:number,col:number):boolean }
declare const qrcode: { (version:number,level:string):QR; stringToBytes:(text:string)=>number[] };
export default qrcode;
