import type {BookRecord} from './types';
export type Idea = {id:string;title:string;text:string;quote?:string;topics:string[];automatic:boolean;created:number;bookId?:string;annotationId?:string;cfi?:string;bookTitle?:string;audioId?:string};
export type FreeIdea = {id:string;title:string;text:string;topics:string[];automatic:boolean;created:number};
export type IdeaLink = {id:string;from:string;to:string;label:string};
export type MapData = {version:1;notes:FreeIdea[];links:IdeaLink[];positions:Record<string,{x:number;y:number}>};
export const emptyMap = ():MapData=>({version:1,notes:[],links:[],positions:{}});
export const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const themes:[string,string[]][]=[
 ['Atenção',['atencao','attention','foco','focus','concentracao','concentration','distracao','distraction']],
 ['Hábitos',['habito','habitos','habit','habits','rotina','routine','disciplina','discipline']],
 ['Aprendizado',['aprender','aprendizagem','aprendizado','learning','learn','study','estudo','educacao','education']],
 ['Memória',['memoria','memory','remember','lembrar','lembranca','recall']],
 ['Conhecimento',['conhecimento','knowledge','evidencia','evidence','verdade','truth','certeza','certainty']],
 ['Pensamento crítico',['critico','critical','vies','vieses','bias','biases','raciocinio','reasoning','crenca','belief','beliefs']],
 ['Poder',['poder','power','autoridade','authority','politica','politics','dominacao','domination']],
 ['Liberdade',['liberdade','freedom','liberty','autonomia','autonomy','censura','censorship']],
 ['Identidade',['identidade','identity','self','personalidade','personality','pertencimento','belonging']],
 ['Emoções',['emocao','emocoes','emotion','emotions','medo','fear','ansiedade','anxiety','alegria','joy']],
 ['Relações',['amizade','friendship','relacionamento','relationship','empatia','empathy','cooperacao','cooperation','amor','love']],
 ['Trabalho',['trabalho','work','labor','labour','profissao','career','carreira','emprego','employment']],
 ['Economia',['economia','economy','economic','economico','mercado','market','dinheiro','money','capitalismo','capitalism']],
 ['Tecnologia',['tecnologia','technology','digital','algoritmo','algorithm','algoritmos','algorithms','software','inteligencia artificial','artificial intelligence']],
 ['Ética',['etica','ethics','ethical','moral','justica','justice','responsabilidade','responsibility']],
 ['Linguagem',['linguagem','language','palavra','word','words','discurso','discourse','traducao','translation']],
 ['Natureza',['natureza','nature','ambiente','environment','ecologia','ecology','clima','climate']],
 ['Criatividade',['criatividade','creativity','creative','arte','art','imaginacao','imagination']],
 ['Tempo',['tempo','time','duracao','duration','presente','present','futuro','future','passado','past']],
 ['Leitura',['leitura','reading','ler','read','leitor','reader','livro','book']],
];
const stop=new Set(fold('a o os as um uma uns umas de da do dos das em no na nos nas por para com sem sobre entre ao aos e ou mas que se sua seu suas seus este esta isto esse essa isso aquele aquela como mais muito pouca pouco sao ser foi era ter tem ha ja nao sim tambem cada todo todos todas ate onde quando porque qual quais quem voce voces ele ela eles elas eu tu nos me te lhe meu minha nosso nossa the a an and or but of to in on at for from with without about this that these those is are was were be been being have has had do does did not no yes it its i you we they he she them our your their his her as by so if then than into can could would should will may might also only more most less very some any all each such what which who when where how why text texto trecho note nota ideia idea').split(/\s+/));
function words(text:string){return fold(text).match(/[a-z][a-z0-9-]{2,}/g)||[];}
export function normalizeTopics(values:string[]){const seen=new Set<string>();return values.map(s=>s.trim().slice(0,50)).filter(s=>{const k=fold(s);if(!k||seen.has(k))return false;seen.add(k);return true;}).slice(0,10);}
export function suggestedTopics(text:string):string[]{
 const tokens=new Set(words(text.slice(0,10000))),flat=fold(text.slice(0,10000));
 return themes.filter(([,terms])=>terms.some(term=>term.includes(' ')?flat.includes(term):tokens.has(term))).map(([name])=>name).slice(0,5);
}
export const annotationIdeaId=(book:string,note:string)=>`book:${book}:note:${note}`;
export function collectIdeas(books:BookRecord[],notes:FreeIdea[]):Idea[]{
 return [...notes.map(n=>({...n})),...books.flatMap(book=>book.annotations.map(a=>({id:annotationIdeaId(book.id,a.id),title:(a.note||a.text).replace(/\s+/g,' ').slice(0,90)||'Nota de voz',text:a.note,quote:a.text,topics:a.topics||[],automatic:!a.mapManualTopics,created:a.created,bookId:book.id,annotationId:a.id,cfi:a.cfi,bookTitle:book.title,audioId:a.audioId})))].sort((a,b)=>b.created-a.created);
}
export function ideaTopics(ideas:Idea[]):Map<string,string[]>{
 const output=new Map<string,string[]>(),df=new Map<string,number>();
 const candidates=new Map(ideas.map(idea=>{const ts=[...new Set(words(`${idea.title} ${idea.text} ${idea.quote||''}`).filter(w=>w.length>=5&&!stop.has(w)))];for(const t of ts)df.set(t,(df.get(t)||0)+1);return[idea.id,ts] as const;}));
 const labels=new Map<string,string>();for(const idea of ideas)for(const t of idea.topics)if(!labels.has(fold(t)))labels.set(fold(t),t);
 for(const idea of ideas){
  let topics=idea.automatic?normalizeTopics([...idea.topics,...suggestedTopics(`${idea.title} ${idea.text} ${idea.quote||''}`)]):normalizeTopics(idea.topics);
  if(idea.automatic&&!topics.length){const shared=(candidates.get(idea.id)||[]).filter(w=>(df.get(w)||0)>=2&&(df.get(w)||0)<=Math.max(3,ideas.length*.65)).sort((a,b)=>(df.get(b)||0)-(df.get(a)||0)||a.localeCompare(b)).slice(0,2);topics=shared.map(s=>s[0].toUpperCase()+s.slice(1));}
  output.set(idea.id,normalizeTopics(topics).map(t=>labels.get(fold(t))||t));
 }
 return output;
}
export type GraphNode={id:string;kind:'idea'|'topic';label:string;subtitle:string;x:number;y:number;idea?:Idea};
export function layoutGraph(ideas:Idea[],tags:Map<string,string[]>,positions:MapData['positions']):{nodes:GraphNode[];edges:{from:string;to:string}[]}{
 const topicNames=[...new Map(ideas.flatMap(i=>(tags.get(i.id)||[]).map(t=>[fold(t),t] as const))).values()].sort((a,b)=>a.localeCompare(b));
 const topicNodes:GraphNode[]=topicNames.map((label,i)=>{const angle=i/Math.max(1,topicNames.length)*Math.PI*2-Math.PI/2;return{id:'topic:'+fold(label),kind:'topic',label,subtitle:'Tema',x:topicNames.length===1?500:500+Math.cos(angle)*250,y:topicNames.length===1?330:330+Math.sin(angle)*220};});
 const nodes:GraphNode[]=[...topicNodes,...ideas.map((idea,i)=>{const angle=i/Math.max(1,ideas.length)*Math.PI*2;return{id:idea.id,kind:'idea' as const,label:idea.title,subtitle:idea.bookTitle||'Nota livre',idea,x:500+Math.cos(angle)*420,y:330+Math.sin(angle)*350};})];
 const byId=new Map(nodes.map(n=>[n.id,n]));const edges=ideas.flatMap(i=>(tags.get(i.id)||[]).map(t=>({from:i.id,to:'topic:'+fold(t)})));
 // Deterministic relaxation separates labels while drawing notes toward their themes.
 for(let step=0;step<95;step++){
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],dx=b.x-a.x||.1,dy=b.y-a.y||.1;if(Math.abs(dx)<205&&Math.abs(dy)<100){const distance=Math.hypot(dx,dy)||1,force=step<65?6:2;a.x-=dx/distance*force;b.x+=dx/distance*force;a.y-=dy/distance*force;b.y+=dy/distance*force;}}
  for(const edge of edges){const a=byId.get(edge.from)!,b=byId.get(edge.to)!,dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);if(dist>235){a.x+=dx*.018;a.y+=dy*.018;b.x-=dx*.006;b.y-=dy*.006;}}
 }
 for(const n of nodes){const p=positions[n.id];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){n.x=p.x;n.y=p.y;}}
 return{nodes,edges};
}
