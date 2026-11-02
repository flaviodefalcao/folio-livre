import type {BookRecord} from "./types";
const key=(id:string)=>`folio:reading-position:${id}`;
export function rememberReadingPosition(book:BookRecord){
  if(!book.cfi||!book.positionUpdatedAt)return;
  try{localStorage.setItem(key(book.id),JSON.stringify({cfi:book.cfi,progress:book.progress,readingMemory:book.readingMemory,positionUpdatedAt:book.positionUpdatedAt}));}catch{/* IndexedDB remains the primary store if local storage is unavailable. */}
}
export function restoreReadingPosition(book:BookRecord):BookRecord {
  try{
    const saved=JSON.parse(localStorage.getItem(key(book.id))||"null");
    if(!saved||typeof saved.cfi!=="string"||!saved.cfi.startsWith("epubcfi(")||!Number.isFinite(saved.positionUpdatedAt)||saved.positionUpdatedAt<=(book.positionUpdatedAt||0)||!Number.isFinite(saved.progress)||saved.progress<0||saved.progress>1)return book;
    const memory=saved.readingMemory;
    return {...book,cfi:saved.cfi,progress:saved.progress,positionUpdatedAt:saved.positionUpdatedAt,...(memory&&memory.cfi===saved.cfi&&typeof memory.text==="string"&&typeof memory.chapter==="string"?{readingMemory:{...memory,text:memory.text.slice(0,700),chapter:memory.chapter.slice(0,300)}}:{readingMemory:undefined})};
  }catch{return book;}
}
/** Start at the actual visible character, not the beginning of its paragraph. */
export function positionExcerpt(range:Range,limit=700):string {
  const node=range.startContainer,doc=node.ownerDocument;
  if(!doc?.body)return "";
  if(node.nodeType!==3){const tail=range.cloneRange();tail.collapse(true);tail.setEnd(doc.body,doc.body.childNodes.length);return tail.toString().replace(/\s+/g," ").trim().slice(0,limit);}
  const walker=doc.createTreeWalker(doc.body,4);walker.currentNode=node;
  let text=node.textContent?.slice(range.startOffset)||"",previous=node.parentElement?.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote");
  while(text.length<limit){
    const next=walker.nextNode();if(!next)break;
    if(next.parentElement?.closest("script,style,[hidden]"))continue;
    const block=next.parentElement?.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote");
    if(block!==previous)text+=" ";previous=block;text+=next.textContent||"";
  }
  return text.replace(/\s+/g," ").trim().slice(0,limit);
}
