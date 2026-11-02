const installed=new WeakSet<Document>();
const BASE_SIZE=20;
export const clampTextSize=(value:number)=>Math.round(Math.max(12,Math.min(56,value)));
/** Normalize the dominant text size once, preserving relative sizes of headings and inline text. */
export function scaleBookText(doc:Document,size:number,lineHeight=1.7){
 const body=doc.body;if(!body)return;
 if(!installed.has(doc)){
  const view=doc.defaultView;if(!view)return;
  body.style.setProperty('font-size',`${BASE_SIZE}px`,'important');
  const frequencies=new Map<number,number>(),walker=doc.createTreeWalker(body,NodeFilter.SHOW_TEXT);
  let count=0,node:Node|null;
  while((node=walker.nextNode())&&count++<50000){const el=node.parentElement,text=node.textContent?.trim();if(!el||!text||el.closest('script,style,svg,math'))continue;const px=Number.parseFloat(view.getComputedStyle(el).fontSize);if(px>=6&&px<=100)frequencies.set(px,(frequencies.get(px)||0)+text.length);}
  const baseline=[...frequencies].sort((a,b)=>b[1]-a[1])[0]?.[0]||BASE_SIZE;
  const elements=Array.from(body.querySelectorAll<HTMLElement>('p,span,div,li,blockquote,td,th,h1,h2,h3,h4,h5,h6,a,em,strong,b,i,small,sup,sub,pre,code,dt,dd')).filter(el=>!el.closest('svg,math'));
  // Read every original size before changing inheritance, so nested spans never scale twice.
  const metrics=elements.map(el=>({el,px:Number.parseFloat(view.getComputedStyle(el).fontSize)}));
  for(const {el,px} of metrics)if(Number.isFinite(px)&&px>0){el.style.setProperty('font-size',`calc(var(--folio-text-size, 20px) * ${Math.min(8,Math.max(.2,px/baseline)).toFixed(5)})`,'important');if(el.matches('p,li,blockquote,td,th,div,pre,dt,dd'))el.style.setProperty('line-height','var(--folio-line-height, 1.7)','important');else if(el.matches('h1,h2,h3,h4,h5,h6'))el.style.setProperty('line-height','1.25','important');else el.style.setProperty('line-height','inherit','important');}
  installed.add(doc);
 }
 body.style.setProperty('--folio-line-height',String(Math.max(1.2,Math.min(2.4,lineHeight))));
 body.style.setProperty('--folio-text-size',`${clampTextSize(size)}px`);
 body.style.setProperty('font-size',`${clampTextSize(size)}px`,'important');
 body.style.setProperty('touch-action','pan-y');
}
