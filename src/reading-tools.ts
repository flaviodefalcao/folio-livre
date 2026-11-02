import type {BookRecord} from './types';
export type ReadingContext={text:string;cfi:string;chapter:string;href:string};
export type SessionGoal={kind:'minutes'|'chapter';minutes:number;startMs:number;chapter:string;startProgress?:number;reached:boolean};
export function goalReached(goal:SessionGoal,sessionMs:number,chapter:string,atBookEnd=false,progress=1){
 return goal.kind==='minutes'?sessionMs-goal.startMs>=goal.minutes*60000:!!goal.chapter&&!!chapter&&(chapter!==goal.chapter&&progress>=(goal.startProgress||0)||atBookEnd);
}
export function topics(value:string){return [...new Set(value.slice(0,1000).split(',').map(s=>s.trim().slice(0,50)).filter(Boolean))].slice(0,10);}
export const voiceKey=(id:string)=>`folio:voice-note:${id}`;
export function favoritePassages(books:BookRecord[]){return books.flatMap(book=>book.annotations.filter(a=>a.favorite).map(note=>({book,note}))).sort((a,b)=>b.note.created-a.note.created);}
