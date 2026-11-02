import {useEffect,useRef,useState} from "react";
import {Search,Download,ChevronLeft,ChevronRight,ArrowUpRight,Check} from "lucide-react";
import type {CatalogBook,CatalogLinks,CatalogResult,DownloadOption} from "./catalog";
import type {BookRecord,Settings} from "./types";
import {Modal,openExternal} from "./App";

export default function Catalog({initialQuery="",settings,onImport,onDownload,books}:{
 initialQuery?:string;settings:Settings;onImport:(files:File[])=>Promise<boolean|undefined>;
 onDownload:()=>void;books:BookRecord[];
}) {
 const [query,setQuery]=useState(initialQuery),[language,setLanguage]=useState("pt");
 const [result,setResult]=useState<CatalogResult>({results:[],page:1,hasMore:false});
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [selected,setSelected]=useState<CatalogBook|null>(null),[links,setLinks]=useState<CatalogLinks>({options:[]});
 const [linksLoading,setLinksLoading]=useState(false),[downloading,setDownloading]=useState("");
 const searchGeneration=useRef(0),linkGeneration=useRef(0),selectedRef=useRef(selected),live=useRef(true);
 selectedRef.current=selected;
 function searchURL(page=1){const u=new URL("/search",settings.annaUrl);u.searchParams.set("q",query.trim());u.searchParams.set("ext","epub");u.searchParams.set("display","list_compact");if(language)u.searchParams.set("lang",language);if(page>1)u.searchParams.set("page",String(page));return u.href;}
 const freeOptions=(options:DownloadOption[])=>options.filter(o=>{try{const u=new URL(o.url);return u.protocol==="https:"&&!u.username&&!u.password&&!/fast_download|\/account|\/login|\/donate/i.test(u.pathname)&&!/premium|members? only|somente membros|download rápido|fast download/i.test(o.label);}catch{return false;}});
 useEffect(()=>{
  live.current=true;
  const results=(event:Event)=>{searchGeneration.current++;const value=(event as CustomEvent<CatalogResult>).detail;setResult(value);if(value.query!==undefined)setQuery(value.query);setLoading(false);setError(value.error||"");};
  const returnedLinks=(event:Event)=>{const value=(event as CustomEvent<CatalogLinks&{sourceUrl?:string}>).detail;const book=selectedRef.current;if(!book||value.sourceUrl&&new URL(value.sourceUrl).pathname!==new URL(book.url).pathname)return;linkGeneration.current++;setLinks({...value,options:freeOptions(value.options)});setLinksLoading(false);};
  window.addEventListener("folio-catalog-results",results);window.addEventListener("folio-catalog-links",returnedLinks);
  return()=>{live.current=false;searchGeneration.current++;linkGeneration.current++;window.removeEventListener("folio-catalog-results",results);window.removeEventListener("folio-catalog-links",returnedLinks);};
 },[]);
 async function inside(url:string,collect?:"search"|"links"){
  if(window.folio?.openCatalog)await window.folio.openCatalog(url,collect?{collect}:undefined);
  else await openExternal(url);
 }
 async function search(page=1){
  const generation=++searchGeneration.current;setLoading(true);setError("");
  try{
   if(window.folio?.openCatalog&&settings.supportsIntegratedCatalog)await inside(searchURL(page),"search");
   else if(window.folio?.searchCatalog){const value=await window.folio.searchCatalog({query:query.trim(),language,format:"epub",page});if(generation!==searchGeneration.current||!live.current)return;setResult(value);setError(value.error||"");}
   else await inside(searchURL(page));
  }catch(e){if(generation===searchGeneration.current&&live.current)setError((e as Error).message);}
  finally{if(generation===searchGeneration.current&&live.current)setLoading(false);}
 }
 async function showLinks(book:CatalogBook){
  const generation=++linkGeneration.current;setSelected(book);setLinks({options:[]});setError("");
  if(!window.folio?.catalogLinks)return;
  setLinksLoading(true);
  try{const value=await window.folio.catalogLinks(book.url);if(generation===linkGeneration.current&&live.current)setLinks({...value,options:freeOptions(value.options)});}
  catch(e){if(generation===linkGeneration.current&&live.current)setLinks({options:[],error:(e as Error).message});}
  finally{if(generation===linkGeneration.current&&live.current)setLinksLoading(false);}
 }
 async function download(book:CatalogBook,option:DownloadOption){
  if(downloading)return;setError("");
  try{
   if(option.kind!=="direct"||!window.folio){await inside(option.url);return;}
   setDownloading(book.id);const file=await window.folio.download(option.url);const bytes=Uint8Array.from(file.data);
   const ok=await onImport([new File([bytes.buffer],file.name,{type:"application/epub+zip"})]);
   if(ok===false)throw Error("Não foi possível importar este EPUB.");
   setSelected(null);
  }catch(e){setError((e as Error).message);}finally{setDownloading("");}
 }
 return <section className="catalog-native catalog-v4">
  <h1>Buscar livros<span>.</span></h1>
  <p className="intro">Anna’s Archive · links gratuitos para EPUB.</p>
  <form className="native-search" onSubmit={e=>{e.preventDefault();void search();}}>
   <div className="catalog-search"><Search size={20}/><input aria-label="Título ou autor" placeholder="Título ou autor" maxLength={500} value={query} onChange={e=>setQuery(e.target.value)}/><button className="primary-button" disabled={loading}>{loading?"Buscando…":"Buscar"}</button></div>
   <div className="catalog-filters"><label>Idioma <select aria-label="Idioma dos livros" value={language} onChange={e=>setLanguage(e.target.value)}><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="fr">Francês</option><option value="">Todos</option></select></label><button type="button" className="text-button" onClick={onDownload}><Download size={16}/>Importar link</button></div>
  </form>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {result.challenge&&<div className="catalog-challenge"><h2>Conclua a verificação do site</h2><p>Abra a busca, siga as etapas do site e volte para o Folio Livre.</p><button className="primary-button" onClick={()=>void search()}>Abrir busca no app</button></div>}
  <div className="catalog-grid">{result.results.map(book=>{const owned=books.some(b=>b.title.toLocaleLowerCase()===book.title.toLocaleLowerCase());return <article className="catalog-book" key={book.id}>
   {book.coverUrl&&<img className="catalog-cover" src={book.coverUrl} alt="" loading="lazy"/>}<div className="catalog-book-info"><h2>{book.title}</h2><p>{book.author}</p><div className="catalog-book-tags"><span>EPUB</span>{book.language&&<span>{book.language.toUpperCase()}</span>}{book.size&&<span>{book.size}</span>}{owned&&<span><Check size={12}/>Na biblioteca</span>}</div><button className="primary-button" disabled={!!downloading} onClick={()=>void showLinks(book)}>Ver links gratuitos<ChevronRight size={16}/></button></div>
  </article>;})}</div>
  {!loading&&!result.results.length&&!result.challenge&&<p className="catalog-source-note">Busque um título ou autor. Se o site pedir uma verificação, conclua-a na janela que abrir.</p>}
  {(result.page>1||result.hasMore)&&<div className="catalog-pagination"><button disabled={loading||result.page<=1} onClick={()=>void search(result.page-1)}><ChevronLeft size={16}/>Anterior</button><span>Página {result.page}</span><button disabled={loading||!result.hasMore} onClick={()=>void search(result.page+1)}>Próxima<ChevronRight size={16}/></button></div>}
  <p className="catalog-source-note">Os links gratuitos podem ter espera e verificações. Depois de baixar, o EPUB é adicionado à biblioteca. A disponibilidade depende do site.</p>
  {selected&&<Modal title="Links gratuitos" onClose={()=>{linkGeneration.current++;setSelected(null);}}><h3>{selected.title}</h3><p>{selected.author}</p>{linksLoading&&<p role="status">Carregando links…</p>}{links.error&&<p className="form-error" role="alert">{links.error}</p>}<div className="download-options">{links.options.map(option=><div className="download-option" key={option.id}><strong>{option.label}</strong><button className="primary-button" disabled={!!downloading} onClick={()=>void download(selected,option)}>{downloading?"Baixando…":option.kind==="direct"?"Baixar EPUB":"Abrir link gratuito"}<Download size={16}/></button></div>)}</div>{!linksLoading&&!links.options.length&&<p>Abra a página do livro e escolha um link gratuito.</p>}<button className="text-button" onClick={()=>void inside(selected.url,"links").catch(e=>setError(e.message))}>Abrir página do livro<ArrowUpRight size={16}/></button></Modal>}
 </section>;
}
