import {useEffect, useState} from "react";

export type CoverColors = {background:string; accent:string; ink:string};
const cache = new Map<string, Promise<CoverColors | undefined>>();
const rgb = (c:number[]) => `rgb(${c.map(Math.round).join(", ")})`;
const luminance = (c:number[]) => c.map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);

// Sample a tiny thumbnail locally. Quantized groups ignore isolated lettering and JPEG noise.
export function colorsFromPixels(pixels:Uint8ClampedArray):CoverColors | undefined {
  const groups=new Map<number,{sum:number[]; count:number}>();
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]<180)continue;
    const c=[pixels[i],pixels[i+1],pixels[i+2]];
    const key=(c[0]>>5)*64+(c[1]>>5)*8+(c[2]>>5);
    const g=groups.get(key)||{sum:[0,0,0],count:0};g.count++;
    c.forEach((v,j)=>g.sum[j]+=v);groups.set(key,g);
  }
  const ranked=[...groups.values()].sort((a,b)=>b.count-a.count);
  if(!ranked.length)return;
  const average=(g:typeof ranked[number])=>g.sum.map(v=>v/g.count);
  const base=average(ranked[0]);
  const secondary=ranked.find(g=>g.count>=ranked[0].count*.08&&average(g).reduce((s,v,i)=>s+(v-base[i])**2,0)>9000);
  const accent=secondary?average(secondary):base.map(v=>Math.max(0,v*.7));
  const lightContrast=1.05/(luminance(base)+.05);
  const darkContrast=(luminance(base)+.05)/.05;
  return {background:rgb(base),accent:rgb(accent),ink:lightContrast>=darkContrast?"#ffffff":"#161616"};
}
function coverColors(source:string):Promise<CoverColors | undefined>{
  const cached=cache.get(source);if(cached)return cached;
  const task=new Promise<CoverColors | undefined>(resolve=>{
    const img=new Image();img.crossOrigin="anonymous";
    let done=false;
    const finish=(result?:CoverColors)=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(result);};
    const timer=setTimeout(()=>finish(),4000);
    img.onload=()=>{try{
      const canvas=document.createElement("canvas");canvas.width=32;canvas.height=48;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return finish();
      ctx.drawImage(img,0,0,32,48);finish(colorsFromPixels(ctx.getImageData(0,0,32,48).data));
    }catch{finish();}};
    img.onerror=()=>finish();img.src=source;
  });
  cache.set(source,task);if(cache.size>128)cache.delete(cache.keys().next().value!);
  return task;
}
export function useCoverColors(covers:(string|undefined)[],enabled:boolean){
  const [colors,setColors]=useState<Map<string,CoverColors>>(()=>new Map());
  useEffect(()=>{
    if(!enabled)return;let live=true;
    const active=new Set(covers);
    setColors(previous=>[...previous.keys()].some(key=>!active.has(key))?new Map([...previous].filter(([key])=>active.has(key))):previous);
    for(const cover of new Set(covers))if(cover){
      void coverColors(cover).then(result=>{
        if(!live||!result)return;
        setColors(previous=>previous.get(cover)===result?previous:new Map(previous).set(cover,result));
      });
    }
    return ()=>{live=false;};
  },[covers,enabled]);
  return colors;
}
