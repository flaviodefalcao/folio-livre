import {positionExcerpt,rememberReadingPosition,restoreReadingPosition} from "./reader-position";
import {rangesOverlap,textSelectionRange,repairParagraphRange} from "./reader-selection";
import {scaleBookText,clampTextSize} from "./text-scale";
import {set,del} from "idb-keyval";
import ReadingTools,{type ReadingToolTab} from "./ReadingTools";
import {VoiceNotePlayer} from "./VoiceNote";
import {goalReached,topics,voiceKey,type ReadingContext,type SessionGoal} from "./reading-tools";
import "./reading-tools.css";
import { useEffect, useMemo, useRef, useState } from "react";
import ePub, { EpubCFI } from "epubjs";
import type Book from "epubjs/types/book";
import type Rendition from "epubjs/types/rendition";
import type Contents from "epubjs/types/contents";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  Bookmark,
  Highlighter,
  Type,
  X,
  Volume2,
  VolumeX,
  Download,
  Maximize,
  Minimize,
  Trash2,
  BookOpen,
  Sun,
  Moon,
  Star,
  Mic,
  Columns2,
  BookA,
  StickyNote,
  Save,
  Network,
  Quote,
  ExternalLink,
} from "lucide-react";
import type {
  BookRecord,
  ReaderPrefs,
  Annotation,
} from "./types";
import { searchBook } from "./retrieval";
import { openExternal } from "./App";
import { useReadingMetrics } from "./useReadingMetrics";
import { formatTime } from "./metrics";
import { audioChapters, audioTextRange } from "./audio";
import { loadMetrics } from "./metrics-store";
import { readingEstimate } from "./reading-profile";
import type { Chapter } from "./types";
import AudioPlayer from "./AudioPlayer";
import { resolveTocLocation } from "./reader-navigation";
const initialPrefs: ReaderPrefs = {
  theme: "paper",
  fontSize: 20,
  fontFamily: "Georgia",
  lineHeight: 1.7,
  width: 760,
  flow: "paginated",
};
const colors = {
  paper: { bg: "#f7f8fa", fg: "#17212b" },
  sepia: { bg: "#f4e9d5", fg: "#4a3e2c" },
  night: { bg: "#101113", fg: "#f5f6f8" },
};
type Panel = "toc" | "search" | "notes" | "appearance" | "reading" | null;
export default function Reader({
  book,
  appTheme,
  onUpdate,
  onClose,
  onConceptMap,
  settingsModal,
  libraryBooks = [book],
  initialTarget,
}: {
  book: BookRecord;
  appTheme: "light" | "dark";
  onUpdate: (b: BookRecord) => Promise<void>;
  onClose: () => void;
  onConceptMap?: () => void;
  settingsModal?: React.ReactNode;
  libraryBooks?: BookRecord[];
  initialTarget?: string;
}) {
  const openingBook = useRef<BookRecord | null>(null);
  if (!openingBook.current) openingBook.current = restoreReadingPosition(book);
  const positionReady = useRef(false);
  const container = useRef<HTMLDivElement>(null),
    epub = useRef<Book | null>(null),
    rendition = useRef<Rendition | null>(null),
    current = useRef(openingBook.current),
    navigationTarget = useRef<string | null>(null),
    audioNavigation = useRef(0);
  const [panel, setPanel] = useState<Panel>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [prefs, setPrefs] = useState({
      ...initialPrefs,
      ...book.prefs,
      theme: appTheme === "dark" ? ("night" as const) : ("paper" as const),
    });
  useEffect(() => {
    setPrefs((previous) => ({
      ...previous,
      theme: appTheme === "dark" ? "night" : "paper",
    }));
  }, [appTheme]);
  const [chapter, setChapter] = useState(""),
    [href, setHref] = useState(""),
    [currentTocHref, setCurrentTocHref] = useState(""),
    [cfi, setCfi] = useState(openingBook.current.cfi || ""),
    [progress, setProgress] = useState(openingBook.current.progress),
    [page, setPage] = useState("");
  const [selection, setSelection] = useState<{
      text: string;
      cfi: string;
      annotationId?: string;
    } | null>(null),
    [note, setNote] = useState(""),
    [find, setFind] = useState(""),
    [speaking, setSpeaking] = useState(false);
  const [commentOpen,setCommentOpen]=useState(false);
  const selectionRef=useRef(selection);selectionRef.current=selection;
  const highlightTouchedAt=useRef(0);
  const touchCount=useRef(0),zooming=useRef(false),selectionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pendingSelection=useRef<{text:string;cfi:string}|null>(null);
  const applySelection=useRef<(text:string,cfi:string)=>void>(()=>{});
  function cancelPendingSelection(){if(selectionTimer.current)clearTimeout(selectionTimer.current);selectionTimer.current=null;pendingSelection.current=null;}
  function scheduleSelection(){if(selectionTimer.current)clearTimeout(selectionTimer.current);if(touchCount.current||zooming.current||!pendingSelection.current)return;selectionTimer.current=setTimeout(()=>{const pending=pendingSelection.current;pendingSelection.current=null;if(pending&&!touchCount.current&&!zooming.current)applySelection.current(pending.text,pending.cfi);},160);}
  useEffect(()=>()=>{cancelPendingSelection();},[]);
  const draftHighlight=useRef<string|null>(null);
  const selectionHandler=useRef<(text:string,cfi:string)=>void>(()=>{});
  const highlightColors=[['Amarelo','#dbc878'],['Verde','#9acb9a'],['Azul','#8bbde8'],['Rosa','#e6a0b7']] as const;
  const [highlightColor,setHighlightColor]=useState(()=>localStorage.getItem('folio:highlight-color')||'#dbc878');
  function clearSelection(){cancelPendingSelection();draftHighlight.current=null;setSelection(null);setCommentOpen(false);try{for(const contents of rendition.current?.getContents() as unknown as Contents[]||[])contents.window.getSelection()?.removeAllRanges();}catch{}}
  function drawHighlight(item:Annotation,r=rendition.current){if(!r||item.audioId)return;try{r.annotations.remove(item.cfi,'highlight');r.annotations.highlight(item.cfi,{id:item.id},(event:Event)=>{event?.stopPropagation?.();highlightTouchedAt.current=Date.now();
    if(zooming.current||touchCount.current>1)return;
    // The mark proxy also receives touches on native selection handles.
    try{const contents=r.getContents() as unknown as Contents[];if(contents.some(c=>!!c.window.getSelection()?.toString()))return;}catch{}
    const saved=current.current.annotations.find(a=>a.id===item.id);if(!saved)return;draftHighlight.current=null;setSelection({text:saved.text,cfi:saved.cfi,annotationId:saved.id});if(selectionRef.current?.annotationId!==saved.id){setNote(saved.note);setHighlightColor(saved.color);setCommentOpen(false);}setPanel(null);},'folio-highlight',{fill:item.color,'fill-opacity':'0.32','mix-blend-mode':'multiply'});}catch(e){setError((e as Error).message);}}
  function repairSavedHighlights(r:Rendition){
    if(touchCount.current||zooming.current)return;
    const repaired=new Map<string,Annotation>();
    for(const item of current.current.annotations){if(item.audioId)continue;try{const range=r.getRange(item.cfi);if(!range)continue;const full=repairParagraphRange(range,item.text);if(!full)continue;const contents=(r.getContents() as unknown as Contents[]).find(c=>c.document===full.startContainer.ownerDocument);if(!contents)continue;const cfi=contents.cfiFromRange(full);if(cfi===item.cfi)continue;const next={...item,cfi};r.annotations.remove(item.cfi,'highlight');drawHighlight(next,r);repaired.set(item.id,next);}catch{/* Keep an unresolvable note unchanged; other sections may not be loaded yet. */}}
    if(repaired.size)void persist({annotations:current.current.annotations.map(item=>repaired.get(item.id)||item)});
  }
  selectionHandler.current=(text,range)=>{if(zooming.current)return;pendingSelection.current={text,cfi:range};scheduleSelection();};
  applySelection.current=(text,range)=>{
    const existing=current.current.annotations.find(a=>!a.audioId&&a.cfi===range);
    if(existing){setSelection({text,cfi:range,annotationId:existing.id});if(selectionRef.current?.annotationId!==existing.id){setNote(existing.note);setHighlightColor(existing.color);}return;}
    let previous=draftHighlight.current?current.current.annotations.find(a=>a.id===draftHighlight.current):undefined;
    // Moving either selection handle updates this grifo; a fresh range starts another.
    if(previous)try{const a=rendition.current?.getRange(previous.cfi),b=rendition.current?.getRange(range);if(!a||!b||!rangesOverlap(a,b))previous=undefined;}catch{previous=undefined;}
    const item:Annotation={id:previous?previous.id:crypto.randomUUID(),cfi:range,text,note:previous?previous.note:'',color:previous?previous.color:highlightColor,chapter,created:previous?previous.created:Date.now(),topics:previous?previous.topics:[]};
    draftHighlight.current=item.id;
    if(previous)try{rendition.current?.annotations.remove(previous.cfi,'highlight');}catch{}
    drawHighlight(item);setSelection({text,cfi:range,annotationId:item.id});if(selectionRef.current?.annotationId!==item.id){setNote(item.note);setCommentOpen(false);}
    void persist({annotations:[...current.current.annotations.filter(a=>a.id!==item.id),item]},true).catch(e=>{if(current.current.annotations.find(a=>a.id===item.id)?.cfi===item.cfi){current.current={...current.current,annotations:current.current.annotations.flatMap(a=>a.id!==item.id?[a]:previous?[previous]:[])};try{rendition.current?.annotations.remove(item.cfi,'highlight');}catch{}if(previous)drawHighlight(previous);}setError(`Não foi possível salvar o grifo: ${e.message}`);});
  };
  useEffect(()=>{if(!selection){draftHighlight.current=null;setCommentOpen(false);}},[selection]);
  async function updateSelected(patch:Partial<Annotation>){const selected=selectionRef.current;const item=current.current.annotations.find(a=>a.id===selected?.annotationId);if(!item)return;const next={...item,...patch};if(patch.color)drawHighlight(next);try{await persist({annotations:current.current.annotations.map(a=>a.id===item.id?next:a)},true);return true;}catch(e){current.current={...current.current,annotations:current.current.annotations.map(a=>a.id===item.id?item:a)};drawHighlight(item);setHighlightColor(item.color);setError(`Não foi possível salvar: ${(e as Error).message}`);return false;}}
  const openingMemory=useRef(openingBook.current.readingMemory);
  const [resumeVisible,setResumeVisible]=useState(!!openingBook.current.readingMemory&&!initialTarget);
  const [quiet,setQuiet]=useState(()=>localStorage.getItem("folio:quiet-reader")==="true");
  const [stopping,setStopping]=useState(()=>localStorage.getItem("folio:stopping-notice")==="true");
  const [dismissedStop,setDismissedStop]=useState("");
  const [sessionGoal,setSessionGoal]=useState<SessionGoal|null>(null);
  const [toolTab,setToolTab]=useState<ReadingToolTab>('session');
  const [toolContext,setToolContext]=useState<ReadingContext>({text:'',cfi:'',chapter:'',href:''});
  useEffect(()=>{localStorage.setItem("folio:quiet-reader",String(quiet));},[quiet]);
  useEffect(()=>{localStorage.setItem("folio:stopping-notice",String(stopping));},[stopping]);
  if (book.readingBaseline && !current.current.readingBaseline)
    current.current = {
      ...current.current,
      readingBaseline: book.readingBaseline,
    };
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    prefsRef = useRef(prefs),
    saveQueue = useRef(Promise.resolve());

  const [immersive, setImmersive] = useState(
      () => localStorage.getItem("folio:immersive") === "true",
    ),
    [readerControls, setReaderControls] = useState(false);
  const immersiveRef = useRef(immersive);
  immersiveRef.current = immersive;
  function immersiveMode(enabled: boolean) {
    setImmersive(enabled);
    setReaderControls(false);
    setPanel(null);
    if (!window.folio?.setImmersive) {
      if (enabled)
        void document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement)
        void document.exitFullscreen?.().catch(() => {});
    }
  }
  useEffect(() => {
    localStorage.setItem("folio:immersive", String(immersive));
    void window.folio
      ?.setImmersive?.(immersive)
      .catch((e) => setError(e.message));
  }, [immersive]);
  useEffect(
    () => () => {
      void window.folio?.setImmersive?.(false);
      if (document.fullscreenElement)
        void document.exitFullscreen?.().catch(() => {});
    },
    [],
  );
  const [audioSections, setAudioSections] = useState<Chapter[]>([]);
  const [personalPace, setPersonalPace] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void audioChapters(book)
      .then((items) => {
        if (live) setAudioSections(items);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [book.id]);
  useEffect(() => {
    let live = true;
    void loadMetrics().then((data) => {
      const pace = readingEstimate({ ...book, progress }, data);
      if (live) setPersonalPace(pace?.wordsPerMinute || null);
    });
    return () => {
      live = false;
    };
  }, [book.id, Math.floor(progress * 100)]);
  const activeAudioSection =
    audioSections.find((c) => c.href === currentTocHref) ||
    audioSections.find((c) => c.href.split("#")[0] === href);
  const chapterMinutes = (() => {
    if (!activeAudioSection) return null;
    let text = activeAudioSection.text;
    try {
      const range = rendition.current?.getRange(cfi);
      const needle = range?.startContainer.textContent
        ?.slice(range.startOffset, range.startOffset + 45)
        .replace(/\s+/g, " ")
        .trim();
      const at = needle ? text.indexOf(needle) : -1;
      if (at >= 0) text = text.slice(at);
    } catch {}
    return Math.max(
      1,
      Math.ceil(text.split(/\s+/).length / (personalPace || 200)),
    );
  })();
  const readingMetrics = useReadingMetrics(
    book,
    ready && (speaking || (panel === null && !settingsModal && !selection)),
    speaking ? "listen" : "read",
  );
  const chapterKey=currentTocHref||href;
  useEffect(()=>{
    if(sessionGoal&&!sessionGoal.reached&&goalReached(sessionGoal,readingMetrics.sessionMs,chapterKey,progress>=0.999||!!(rendition.current?.location as unknown as {atEnd?:boolean})?.atEnd,progress))setSessionGoal({...sessionGoal,reached:true});
  },[readingMetrics.sessionMs,chapterKey,progress,sessionGoal]);
  function readingContext():ReadingContext {
    let text=selection?.text||'';
    if(!text)try{const range=rendition.current?.getRange(cfi);text=range?.startContainer.parentElement?.closest('p,h1,h2,h3,h4,h5,h6,li')?.textContent||range?.startContainer.textContent||'';}catch{}
    return {text:text.replace(/\s+/g,' ').trim().slice(0,3000)||activeAudioSection?.text.slice(0,700)||'',cfi:selection?.cfi||cfi,chapter,href:chapterKey};
  }
  function openReadingTools(tab:ReadingToolTab='session') {cancelPendingSelection();setToolContext(readingContext());setToolTab(tab);setSelection(null);setResumeVisible(false);setPanel('reading');}
  async function saveVoice(blob:Blob) {
    if(!toolContext.cfi||!toolContext.text)throw Error('Abra um trecho do livro antes de gravar sua nota.');
    const id=crypto.randomUUID();await set(voiceKey(id),blob);
    const item:Annotation={id,cfi:toolContext.cfi,text:toolContext.text,note:'',chapter:toolContext.chapter,created:Date.now(),color:'#dbc878',audioId:id};
    // Save audio and metadata together from the reader's serialized update queue.
    try{await persist({annotations:[...current.current.annotations,item]},true);setPanel('notes');}catch(e){current.current={...current.current,annotations:current.current.annotations.filter(a=>a.id!==id)};await del(voiceKey(id));throw e;}
  }
  function persist(patch: Partial<BookRecord>,throwOnFailure=false) {
    current.current = { ...current.current, ...patch };
    const snapshot = current.current;
    const operation=saveQueue.current.then(()=>onUpdate(snapshot));
    saveQueue.current=operation.catch(e=>setError(`Não foi possível salvar: ${e.message}`));
    return throwOnFailure?operation:saveQueue.current;
  }
  function theme(r: Rendition, p: ReaderPrefs) {
    r.themes.default({
      body: {
        color: colors[p.theme].fg,
        background: colors[p.theme].bg,
        "font-family": `${p.fontFamily}, serif`,
        "font-size": `${p.fontSize}px`,
        "line-height": `${p.lineHeight} !important`,
      },
      p: { "line-height": `${p.lineHeight} !important` },
      "h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th":{color:`${colors[p.theme].fg} !important`,"background-color":"transparent !important"},
      a: { color: p.theme === "night" ? "#c8d49f" : "#586642" },
    });
    r.themes.fontSize(`${p.fontSize}px`);
    r.themes.font(p.fontFamily);
    r.themes.override("color", colors[p.theme].fg, true);
    r.themes.override("background", colors[p.theme].bg, true);
  }
  useEffect(() => {
    let live = true,
      resizeReady = false;
    const b = ePub();
    epub.current = b;
    async function start() {
      try {
        await b.open(book.data.slice(0));
        await b.ready;
        if (!live || !container.current) return;
        const r = b.renderTo(container.current, {
          width: "100%",
          height: "100%",
          flow: prefsRef.current.flow,
          spread: "none",
          allowScriptedContent: false,
        });
        rendition.current = r;
        r.on("rendered",()=>{if(live)repairSavedHighlights(r);});
        theme(r, {...prefsRef.current,fontSize:20});
        r.on(
          "relocated",
          (loc: {
            start: {
              cfi: string;
              href: string;
              percentage: number;
              displayed: { page: number; total: number };
            };
            end?: { cfi: string };
            atEnd: boolean;
          }) => {
            if (!live) return;
            const l = loc.start;
            setCfi(l.cfi);
            setHref(l.href);
            let location: Range | undefined, endLocation: Range | undefined;
            try {
              location = r.getRange(l.cfi);
              if (loc.end?.cfi) endLocation = r.getRange(loc.end.cfi);
            } catch {}
            const tocLocation = resolveTocLocation(
              current.current.toc,
              l.href,
              location,
              endLocation,
              navigationTarget.current,
            );
            setCurrentTocHref(tocLocation?.href || "");
            const label =
              tocLocation?.label ||
              current.current.chapters.find(
                (c) => c.href.split("#")[0] === l.href,
              )?.label ||
              current.current.title;
            setChapter(label);
            setPage(`${l.displayed.page} / ${l.displayed.total}`);
            let pct = b.locations.length()
              ? b.locations.percentageFromCfi(l.cfi)
              : l.percentage;
            if (!Number.isFinite(pct)) pct = 0;
            pct = Math.max(0, Math.min(1, pct));
            setProgress(pct);
            if (!positionReady.current) return;
            if (progressTimer.current) clearTimeout(progressTimer.current);
            let memoryText='';
            try{const range=r.getRange(l.cfi);memoryText=range?positionExcerpt(range):'';}catch{}
            const patch = { cfi: l.cfi, progress: pct, lastOpened: Date.now(), positionUpdatedAt: Date.now(),readingMemory:memoryText?{text:memoryText,cfi:l.cfi,chapter:label,at:Date.now()}:undefined };
            current.current = { ...current.current, ...patch };
            rememberReadingPosition(current.current);
            progressTimer.current = setTimeout(() => {
              void persist(patch);
            }, 350);
          },
        );
        r.on("selected", (range: string, contents: Contents) => {
          if(!live)return;
          const text = contents.window.getSelection()?.toString().trim();
          if (text) {
            const nativeRange=contents.window.getSelection()?.getRangeAt(0);
            const selectedCfi=nativeRange?contents.cfiFromRange(textSelectionRange(nativeRange)):range;
            selectionHandler.current(text.slice(0,8000),selectedCfi);
          }
        });
        r.on("keydown", (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") {
            void r.next().catch((e) => setError(e.message));
          }
          if (e.key === "ArrowLeft") {
            void r.prev().catch((e) => setError(e.message));
          }
        });
        r.hooks.content.register((contents: Contents) => {
          readingMetrics.attachDocument(contents.document);
          scaleBookText(contents.document,prefsRef.current.fontSize,prefsRef.current.lineHeight);
          let startX = 0,
            startY = 0,
            startAt = 0,
            distance = 0,
            font = 20,
            pinching = false,
            previewFont = prefsRef.current.fontSize,
            anchor = '',
            previewFrame = 0;
          const doc = contents.document;
          doc.addEventListener(
            "touchstart",
            (event) => {
              startAt = Date.now();
              touchCount.current=event.touches.length;
              if(selectionTimer.current)clearTimeout(selectionTimer.current);
              if(event.touches.length<2&&pinching)return;
              pinching = event.touches.length >= 2;
              if (pinching) {
                event.preventDefault();zooming.current=true;cancelPendingSelection();
                try{doc.getSelection()?.removeAllRanges();}catch{}
                anchor=r.location?.start?.cfi||'';
                distance = Math.hypot(
                  event.touches[0].clientX - event.touches[1].clientX,
                  event.touches[0].clientY - event.touches[1].clientY,
                );
                font = prefsRef.current.fontSize;previewFont=font;
              } else if (event.touches.length === 1) {
                startX = event.touches[0].clientX;
                startY = event.touches[0].clientY;
              }
            },
            { passive: false },
          );
          doc.addEventListener(
            "touchmove",
            (event) => {
              if(pinching)event.preventDefault();
              if (pinching && event.touches.length === 2 && distance > 0) {
                previewFont=clampTextSize(font*Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY)/distance);
                if(!previewFrame)previewFrame=requestAnimationFrame(()=>{previewFrame=0;if(live)scaleBookText(doc,previewFont,prefsRef.current.lineHeight);});
              }
            },
            { passive: false },
          );
          doc.addEventListener(
            "touchend",
            (event) => {
              touchCount.current=event.touches.length;
              if(pinching){
                if(event.touches.length)return;
                if(previewFrame)cancelAnimationFrame(previewFrame);previewFrame=0;
                pinching=false;zooming.current=false;cancelPendingSelection();try{doc.getSelection()?.removeAllRanges();}catch{}
                if(live){scaleBookText(doc,previewFont,prefsRef.current.lineHeight);setPrefs(previous=>({...previous,fontSize:previewFont}));if(anchor)requestAnimationFrame(()=>{if(live)void r.display(anchor).catch(e=>setError(e.message));});}
                return;
              }
              scheduleSelection();
              if (
                pinching ||
                Date.now()-highlightTouchedAt.current<400 ||
                event.touches.length ||
                doc.getSelection()?.toString()
              )
                return;
              if (
                (event.target as Element)?.closest?.("a,button,input,textarea")
              )
                return;
              const touch = event.changedTouches[0];
              if (!touch) return;
              const dx = touch.clientX - startX,
                dy = touch.clientY - startY;
              if (
                Math.abs(dx) > 55 &&
                Math.abs(dx) > Math.abs(dy) * 1.5 &&
                prefsRef.current.flow === "paginated"
              ) {
                void (dx < 0 ? r.next() : r.prev()).catch((e) =>
                  setError(e.message),
                );
              } else if (
                Date.now() - startAt < 250 &&
                Math.abs(dx) < 12 &&
                Math.abs(dy) < 12
              ) {
                const rect = container.current?.getBoundingClientRect();
                const width = rect?.width || contents.window.innerWidth;
                const frameLeft =
                  contents.window.frameElement?.getBoundingClientRect().left ||
                  0;
                const localX = touch.clientX + frameLeft - (rect?.left || 0);
                if (
                  localX > width * 0.75 &&
                  prefsRef.current.flow === "paginated"
                )
                  void r.next().catch((e) => setError(e.message));
                else if (
                  localX < width * 0.25 &&
                  prefsRef.current.flow === "paginated"
                )
                  void r.prev().catch((e) => setError(e.message));
                else if (immersiveRef.current)
                  setReaderControls((visible) => !visible);
              }
            },
            { passive: true },
          );
          doc.addEventListener('touchcancel',()=>{touchCount.current=0;zooming.current=false;pinching=false;if(previewFrame)cancelAnimationFrame(previewFrame);previewFrame=0;cancelPendingSelection();scaleBookText(doc,prefsRef.current.fontSize,prefsRef.current.lineHeight);},{passive:true});
          contents.document.querySelectorAll("a").forEach((a) => {
            if (/^[a-z][\w+.-]*:/i.test(a.getAttribute("href") || ""))
              a.removeAttribute("href");
          });
        });
        await r.display(initialTarget || openingBook.current?.cfi || undefined);
        if (!live) return;
        positionReady.current = true;
        r.reportLocation();
        resizeReady = true;
        repairSavedHighlights(r);
        for (const a of current.current.annotations) drawHighlight(a,r);
        setReady(true);
        await b.locations.generate(1200);
        if (live && r.location) {
          const pct = b.locations.percentageFromCfi(r.location.start.cfi);
          if (Number.isFinite(pct)) {
            setProgress(pct);
            void persist({ progress: pct });
          }
        }
      } catch (e) {
        if (live)
          setError(`Não foi possível abrir o livro: ${(e as Error).message}`);
      }
    }
    const startup = start();
    const resize = new ResizeObserver(() => {
      if (live && resizeReady && container.current && rendition.current) {
        const { width, height } = container.current.getBoundingClientRect();
        if (width && height) rendition.current.resize(width, height);
      }
    });
    if (container.current) resize.observe(container.current);
    return () => {
      live = false;
      positionReady.current=false;
      rememberReadingPosition(current.current);
      touchCount.current=0;zooming.current=false;cancelPendingSelection();
      resize.disconnect();
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        void persist({});
      }
      window.speechSynthesis?.cancel();
      void window.folio?.stopSpeaking?.().catch(() => {});
      // EPUB sections can still be loading while location indexing finishes.
      // Keep their hooks alive until startup settles, even after leaving the reader.
      void startup.then(() => {
        try { b.destroy(); } catch {}
      });
      rendition.current = null;
      epub.current = null;
    };
  }, [book.id]);
  useEffect(() => {
    prefsRef.current = prefs;
    if (rendition.current) {
      theme(rendition.current, prefs);
      try{for(const contents of rendition.current.getContents() as unknown as Contents[])scaleBookText(contents.document,prefs.fontSize,prefs.lineHeight);}catch{}
      if (rendition.current.settings.flow !== prefs.flow)
        rendition.current.flow(prefs.flow);
    }
    void persist({ prefs });
  }, [prefs]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input,textarea,select") || target.isContentEditable)
        return;
      if (e.key === "ArrowRight")
        void rendition.current?.next().catch((e) => setError(e.message));
      if (e.key === "ArrowLeft")
        void rendition.current?.prev().catch((e) => setError(e.message));
      if (e.key === "Escape") {
        clearSelection();
        setPanel(null);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    const flushPosition = () => {
      if (!positionReady.current) return;
      rememberReadingPosition(current.current);
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = null;
      void persist({});
    };
    document.addEventListener("visibilitychange", flushPosition);
    window.addEventListener("folio-app-state", flushPosition);
    window.addEventListener("pagehide", flushPosition);
    return () => {
      document.removeEventListener("visibilitychange", flushPosition);
      window.removeEventListener("folio-app-state", flushPosition);
      window.removeEventListener("pagehide", flushPosition);
    };
  }, [book.id]);
  async function closeReader(after?:()=>void) {
    cancelPendingSelection();
    await readingMetrics.flush();
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
    try {
      await saveQueue.current;
      await onUpdate(current.current);
      onClose();
      after?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const close = () => {
      if (panel) setPanel(null);
      else if (immersive && readerControls) setReaderControls(false);
      else if (immersive) immersiveMode(false);
      else void closeReader();
    };
    window.addEventListener("folio-close-reader", close);
    return () => window.removeEventListener("folio-close-reader", close);
  }, [panel, immersive, readerControls]);
  async function go(target: string) {
    clearSelection();
    navigationTarget.current = current.current.toc.some(
      (t) => t.href === target,
    )
      ? target
      : null;
    try {
      await rendition.current?.display(target);
      setSelection(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function annotate(favorite=false) {
    if(!selection)return;
    const saved=await updateSelected({note:note.trim(),...(favorite?{favorite:true}:{})});
    if(saved)clearSelection();
  }
  async function removeAnnotation(item:Annotation) {
    try{await persist({annotations:current.current.annotations.filter(a=>a.id!==item.id)},true);}
    catch(e){if(!current.current.annotations.some(a=>a.id===item.id))current.current={...current.current,annotations:[...current.current.annotations,item]};setError(`Não foi possível remover a nota: ${(e as Error).message}`);return;}
    if(item.audioId)void del(voiceKey(item.audioId)).catch(()=>setError('A nota foi removida, mas não foi possível limpar o arquivo de áudio.'));
    else try{rendition.current?.annotations.remove(item.cfi,'highlight');}catch{/* Refreshing the page clears an already removed highlight. */}
  }
  async function bookmark() {
    if (!cfi) return;
    const existing = current.current.bookmarks.some((b) => b.cfi === cfi);
    await persist({
      bookmarks: existing
        ? current.current.bookmarks.filter((b) => b.cfi !== cfi)
        : [...current.current.bookmarks, { cfi, label: chapter }],
    });
  }
  const matches = useMemo(
    () => searchBook(book.chapters, find),
    [book.chapters, find],
  );
  const [audioOpen, setAudioOpen] = useState(false);
  async function exportNotes() {
    const text =
      `# ${book.title}\n${book.author}\n\n` +
      book.annotations
        .map(
          (a) =>
            `## ${a.chapter}\n\n> ${a.text.replace(/\n/g, "\n> ")}\n\n${a.note}\n${a.audioId?"\nNota de voz salva no Folio (áudio não incluído neste arquivo).\n":""}${a.topics?.length?`\nTemas: ${a.topics.join(", ")}\n`:""}`,
        )
        .join("\n");
    if (window.folio)
      await window.folio.exportFile(`${book.title}-notas.md`, text);
    else {
      const u = URL.createObjectURL(
        new Blob([text], { type: "text/markdown" }),
      );
      const a = document.createElement("a");
      a.href = u;
      a.download = "notas.md";
      a.click();
      URL.revokeObjectURL(u);
    }
  }
  const toggle = (p: Panel) => {clearSelection();setPanel(panel === p ? null : p);};
  return (
    <div
      className={`reader-shell theme-${prefs.theme}${immersive ? " reader-immersive" : ""}${readerControls ? " reader-controls-visible" : ""}${quiet ? " reader-quiet" : ""}`}
    >
      <header className="reader-toolbar">
        <button
          className="reader-back"
          aria-label="Biblioteca"
          onClick={() => void closeReader()}
        >
          <ArrowLeft size={18} />
          <span>Biblioteca</span>
        </button>
        <div className="reader-title">
          <strong>{book.title}</strong>
          <span>{book.author}</span>
        </div>
        <div className="reader-actions">
          <button className="icon-button quick-theme" aria-label={prefs.theme==='night'?'Ativar modo claro':'Ativar modo escuro'} title={prefs.theme==='night'?'Modo claro':'Modo escuro'} onClick={()=>{const theme=prefs.theme==='night'?'paper':'night';setPrefs(p=>({...p,theme}));window.dispatchEvent(new CustomEvent('folio-theme-change',{detail:theme==='night'?'dark':'light'}));}}>{prefs.theme==='night'?<Sun size={19}/>:<Moon size={19}/>}</button>
          <button
            className="icon-button"
            aria-label={immersive ? "Sair da tela cheia" : "Tela cheia"}
            onClick={() => immersiveMode(!immersive)}
          >
            {immersive ? <Minimize size={19} /> : <Maximize size={19} />}
          </button>
          {immersive && (
            <button
              className="icon-button"
              aria-label="Abrir player de áudio"
              onClick={() => {
                setAudioOpen(true);
                window.dispatchEvent(new Event("folio-audio-open"));
              }}
            >
              <Volume2 size={19} />
            </button>
          )}
          <button
            className={panel === "toc" ? "icon-button selected" : "icon-button"}
            aria-label="Sumário"
            onClick={() => toggle("toc")}
          >
            <List size={20} />
          </button>
          <button
            className={
              panel === "search" ? "icon-button selected" : "icon-button"
            }
            aria-label="Buscar no livro"
            onClick={() => toggle("search")}
          >
            <Search size={19} />
          </button>
          <button
            className={
              panel === "appearance" ? "icon-button selected" : "icon-button"
            }
            aria-label="Ajustar leitura"
            onClick={() => toggle("appearance")}
          >
            <Type size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="Marcar página"
            onClick={() => void bookmark()}
          >
            <Bookmark
              size={19}
              fill={
                book.bookmarks.some((b) => b.cfi === cfi)
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
          <button
            className="icon-button"
            aria-label="Destaques e notas"
            onClick={() => toggle("notes")}
          >
            <Highlighter size={19} />
          </button>
          <button className="icon-button" aria-label="Funções de leitura" title="Funções de leitura" disabled={!ready} onClick={()=>openReadingTools()}><BookOpen size={19}/></button>
        </div>
      </header>
      {error && (
        <div className="reader-error error-banner" role="alert">
          {error}
          <button aria-label="Fechar aviso" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {ready&&!panel&&!selection&&!resumeVisible&&!audioOpen&&sessionGoal?.reached&&<div className="reading-notice" role="status"><span>Meta alcançada. Você pode parar ou continuar lendo.</span><button onClick={()=>setSessionGoal(null)}>Continuar lendo</button><button onClick={()=>void closeReader()}>Encerrar leitura</button></div>}
      {ready&&!panel&&!selection&&!resumeVisible&&!audioOpen&&!sessionGoal?.reached&&stopping&&chapterMinutes!==null&&chapterMinutes<=2&&dismissedStop!==chapterKey&&<div className="reading-notice" role="status"><span>Bom ponto para parar: cerca de {chapterMinutes} min até o fim do capítulo.</span><button aria-label="Dispensar aviso de parada" onClick={()=>setDismissedStop(chapterKey)}><X size={16}/></button></div>}
      <div className="reader-body">
        <div className="reading-area">
      {resumeVisible&&!panel&&!selection&&!audioOpen&&openingMemory.current&&<div className="reading-resume-card" role="region" aria-label="Retomar o fio"><div><strong>Onde você parou</strong><small>{openingMemory.current.chapter}</small><p>{openingMemory.current.text}</p>{book.resumeNote&&<p>{book.resumeNote}</p>}</div><button onClick={()=>openReadingTools('resume')}>Ver retomada</button><button aria-label="Continuar leitura" onClick={()=>setResumeVisible(false)}><X size={18}/></button></div>}
          <div className="chapter-heading">
            <span>{chapter || "Preparando sua leitura"}</span>
            {chapterMinutes !== null && (
              <small className="chapter-time">
                ~{chapterMinutes} min até terminar o capítulo
                {personalPace ? "" : " · estimativa inicial"}
              </small>
            )}
            <button
              className="icon-button"
              aria-label={
                speaking
                  ? "Parar leitura em voz alta"
                  : "Ler capítulo em voz alta"
              }
              onClick={() => {
                setAudioOpen(true);
                window.dispatchEvent(new Event("folio-audio-open"));
              }}
            >
              {speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>
          <div
            className="epub-container"
            ref={container}
            style={{ maxWidth: prefs.width }}
          />
          {!ready && !error && (
            <div className="reader-loading">Abrindo o livro…</div>
          )}
          {prefs.flow === "paginated" && (
            <>
              <button
                className="page-arrow previous"
                aria-label="Página anterior"
                onClick={() =>
                  void rendition.current
                    ?.prev()
                    .catch((e) => setError(e.message))
                }
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="page-arrow next"
                aria-label="Próxima página"
                onClick={() =>
                  void rendition.current
                    ?.next()
                    .catch((e) => setError(e.message))
                }
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <div className="reading-metrics-status" aria-live="polite">
            <span
              className={`status-dot ${readingMetrics.status === "idle" || readingMetrics.status === "paused" ? "paused" : ""}`}
            />
            {readingMetrics.status === "reading"
              ? "Leitura ativa"
              : readingMetrics.status === "listening"
                ? "Voz ativa"
                : readingMetrics.status === "idle"
                  ? "Pausa por inatividade — toque na página para continuar"
                  : "Contagem pausada"}
            <span> · {formatTime(readingMetrics.sessionMs)} nesta sessão</span>
            {readingMetrics.saveError && (
              <span role="alert">{readingMetrics.saveError}</span>
            )}
          </div>
          {immersive && (
            <footer className="immersive-progress">
              <span>
                {epub.current?.locations.length()
                  ? `Localização ${(Number(epub.current.locations.locationFromCfi(cfi)) || 0) + 1} de ${epub.current.locations.length()}`
                  : page
                    ? `Página ${page}`
                    : ""}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </footer>
          )}
          <footer className="reader-footer">
            <span>{Math.round(progress * 100)}% lido</span>
            <input
              type="range"
              aria-label="Posição no livro"
              min="0"
              max="100"
              value={Math.round(progress * 100)}
              disabled={!ready || !epub.current?.locations.length()}
              onChange={(e) => {
                const target = epub.current?.locations.cfiFromPercentage(
                  Number(e.target.value) / 100,
                );
                if (target) void go(target);
              }}
            />
            <span>{page ? `Página ${page} do capítulo` : ""}</span>
            <button
              className="text-button"
              onClick={() => void persist({ finished: !book.finished })}
            >
              {book.finished ? "Concluído ✓" : "Concluir livro"}
            </button>
          </footer>
        </div>
        {panel && (
          <aside
            className="reader-panel"
          >
            <div className="panel-heading">
              <h2>
                {panel === "reading" ? "Minha leitura" : panel === "toc" ? (
                  "Neste livro"
                ) : panel === "search" ? (
                  "Buscar no livro"
                ) : panel === "notes" ? (
                  "Suas anotações"
                ) : panel === "appearance" ? (
                  "Sua leitura"
                ) : (
                  <>
                    Converse com o livro<span className="ai-dot">✦</span>
                  </>
                )}
              </h2>
              <button
                className="icon-button"
                aria-label="Fechar painel"
                onClick={() => {setPanel(null);if(quiet)setReaderControls(false);}}
              >
                <X size={18} />
              </button>
            </div>
            {panel === "reading" && <ReadingTools book={book} books={libraryBooks} context={toolContext} tab={toolTab} onTab={setToolTab} goal={sessionGoal} sessionMs={readingMetrics.sessionMs} onStart={(kind,minutes)=>{setSessionGoal({kind,minutes,startMs:readingMetrics.sessionMs,chapter:chapterKey,startProgress:progress,reached:false});setStopping(true);setPanel(null);}} onEnd={()=>setSessionGoal(null)} stopping={stopping} onStopping={setStopping} quiet={quiet} onQuiet={value=>{setQuiet(value);if(value){setImmersive(true);setReaderControls(true);}}} onResumeNote={text=>{if(text!==current.current.resumeNote)void persist({resumeNote:text});}} onVoice={saveVoice} onGo={target=>{void go(target);setPanel(null);}} memory={openingMemory.current||book.readingMemory}/>}
            {panel === "toc" && (
              <div className="panel-scroll">
                <div className="eyebrow">SUMÁRIO</div>
                {book.toc.map((item, i) => (
                  <button
                    key={`${item.href}-${i}`}
                    className={
                      item.href === currentTocHref
                        ? "toc-link current"
                        : "toc-link"
                    }
                    onClick={() => void go(item.href)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {item.label}
                  </button>
                ))}
                <div className="divider" />
                <div className="eyebrow">PÁGINAS MARCADAS</div>
                {book.bookmarks.map((b, i) => (
                  <button
                    className="toc-link"
                    key={b.cfi}
                    onClick={() => void go(b.cfi)}
                  >
                    <Bookmark size={14} />
                    {b.label || `Marcador ${i + 1}`}
                  </button>
                ))}
                {!book.bookmarks.length && (
                  <p className="panel-muted">
                    Use o marcador na barra de leitura para guardar uma página.
                  </p>
                )}
              </div>
            )}
            {panel === "search" && (
              <div className="panel-scroll">
                <label className="search-input panel-search">
                  <Search size={17} />
                  <input
                    autoFocus
                    placeholder="Uma palavra ou expressão…"
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                  />
                </label>
                <p className="panel-muted">
                  {find.length < 2
                    ? "Digite ao menos duas letras."
                    : `${matches.length}${matches.length === 60 ? "+" : ""} resultados. Os links abrem o capítulo.`}
                </p>
                {matches.map((m, i) => (
                  <button
                    className="search-result"
                    key={i}
                    onClick={() => void go(m.href)}
                  >
                    <strong>{m.label}</strong>
                    <span>{m.excerpt}</span>
                  </button>
                ))}
              </div>
            )}
            {panel === "notes" && (
              <div className="panel-scroll">
                {onConceptMap&&<button className="secondary-button" onClick={()=>void closeReader(onConceptMap)}><Network size={16}/>Abrir mapa de ideias</button>}
                <button
                  className="text-button"
                  onClick={() =>
                    void exportNotes().catch((e) => setError(e.message))
                  }
                >
                  <Download size={16} />
                  Exportar notas
                </button>
                {book.annotations.map((a) => (
                  <article className="annotation" key={a.id}>
                    <button onClick={() => void go(a.cfi)}>
                      <small>{a.chapter}</small>
                      <blockquote>{a.text}</blockquote>
                    </button>
                    <button className="text-button" aria-pressed={!!a.favorite} onClick={()=>void persist({annotations:current.current.annotations.map(n=>n.id===a.id?{...n,favorite:!n.favorite}:n)})}>{a.favorite?'★ Trecho favorito':'☆ Guardar favorito'}</button>
                    <label className="annotation-topics">Temas do trecho<input aria-label="Temas do trecho" maxLength={600} placeholder="Ex.: amizade, trabalho" defaultValue={(a.topics||[]).join(', ')} onBlur={e=>void persist({annotations:current.current.annotations.map(n=>n.id===a.id?{...n,topics:topics(e.target.value)}:n)})}/></label>
                    {a.audioId&&<VoiceNotePlayer id={a.audioId}/>}
                    <textarea
                      aria-label="Editar nota"
                      defaultValue={a.note}
                      placeholder="Acrescente uma ideia…"
                      onBlur={(e) => {
                        if (a.note !== e.target.value)
                          void persist({
                            annotations: current.current.annotations.map((n) =>
                              n.id === a.id
                                ? { ...n, note: e.target.value }
                                : n,
                            ),
                          });
                      }}
                    />
                    <button
                      className="text-button danger-text"
                      onClick={()=>void removeAnnotation(a)}
                    >
                      <Trash2 size={13} />
                      Remover
                    </button>
                  </article>
                ))}
                {!book.annotations.length && (
                  <p className="panel-muted">
                    Selecione um trecho do livro para destacar e anotar.
                  </p>
                )}
              </div>
            )}
            {panel === "appearance" && (
              <div className="panel-scroll">
                <button className="secondary-button" onClick={()=>openReadingTools()}>Metas, retomada e notas por voz</button>
                <div className="eyebrow">COR DA PÁGINA</div>
                <div className="theme-buttons">
                  {(["paper", "night"] as const).map((t) => (
                    <button
                      className={prefs.theme === t ? "active" : ""}
                      style={{ background: colors[t].bg, color: colors[t].fg }}
                      key={t}
                      onClick={() => {
                        setPrefs({ ...prefs, theme: t });
                        window.dispatchEvent(
                          new CustomEvent("folio-theme-change", {
                            detail: t === "night" ? "dark" : "light",
                          }),
                        );
                      }}
                    >
                      {t === "paper" ? "Claro" : "Escuro"}
                    </button>
                  ))}
                </div>
                <label className="form-field">
                  Fonte
                  <select
                    value={prefs.fontFamily}
                    onChange={(e) =>
                      setPrefs({ ...prefs, fontFamily: e.target.value })
                    }
                  >
                    <option value="Georgia">Georgia</option>
                    <option value="Palatino">Palatino</option>
                    <option value="Arial">Arial</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </label>
                <label className="form-field">
                  Tamanho · {prefs.fontSize}px
                  <input
                    type="range"
                    min="12"
                    max="56"
                    value={prefs.fontSize}
                    onChange={(e) =>
                      setPrefs({ ...prefs, fontSize: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="form-field">
                  Espaçamento · {prefs.lineHeight}
                  <input
                    type="range"
                    min="1.2"
                    max="2.4"
                    step="0.1"
                    value={prefs.lineHeight}
                    onChange={(e) =>
                      setPrefs({ ...prefs, lineHeight: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="form-field">
                  Largura da página
                  <input
                    type="range"
                    min="450"
                    max="1100"
                    step="50"
                    value={prefs.width}
                    onChange={(e) =>
                      setPrefs({ ...prefs, width: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="form-field">
                  Navegação
                  <select
                    value={prefs.flow}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        flow: e.target.value as ReaderPrefs["flow"],
                      })
                    }
                  >
                    <option value="paginated">Páginas</option>
                    <option value="scrolled-doc">Rolagem contínua</option>
                  </select>
                </label>
                <button
                  className="text-button"
                  onClick={() => immersiveMode(true)}
                >
                  <Maximize size={16} />
                  Tela cheia
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
      {selection && !panel && !audioOpen && (
        <div className="selection-toolbar kindle-selection" role="region" aria-label="Menu do grifo">
          <div className="highlight-palette">{highlightColors.map(([name,color])=><button key={color} aria-label={`Grifo ${name.toLowerCase()}`} title={name} aria-pressed={highlightColor===color} style={{'--swatch':color} as React.CSSProperties} onClick={()=>{setHighlightColor(color);localStorage.setItem('folio:highlight-color',color);void updateSelected({color});}}><span/></button>)}<button className="icon-button" aria-label="Limpar seleção" title="Fechar" onClick={clearSelection}><X size={18}/></button></div>
          <div className="highlight-actions">
            <button aria-label="Comentar grifo" title="Comentar" aria-pressed={commentOpen} onClick={()=>setCommentOpen(v=>!v)}><StickyNote size={20}/></button>
            <button aria-label="Guardar favorito" title="Favorito" onClick={()=>void annotate(true)}><Star size={20}/></button>
            <button aria-label="Ouvir seleção" title="Ouvir" onClick={()=>{setAudioOpen(true);window.dispatchEvent(new Event('folio-audio-open'));}}><Volume2 size={20}/></button>
            <button aria-label="Nota por voz" title="Nota por voz" onClick={()=>openReadingTools('voice')}><Mic size={20}/></button>
            <button aria-label="Comparar edições" title="Comparar edições" onClick={()=>openReadingTools('compare')}><Columns2 size={20}/></button>
            <button aria-label="Dicionário" title="Dicionário" onClick={()=>void openExternal(`https://pt.wiktionary.org/wiki/${encodeURIComponent(selection.text.trim().slice(0,120))}`).catch(e=>setError(e.message))}><BookA size={20}/></button>
            <button aria-label="Remover grifo" title="Remover grifo" onClick={()=>{const item=current.current.annotations.find(a=>a.id===selection.annotationId);if(item)void removeAnnotation(item);clearSelection();}}><Trash2 size={20}/></button>
          </div>
          {commentOpen&&<form className="highlight-comment" onSubmit={e=>{e.preventDefault();void updateSelected({note:note.trim()}).then(saved=>{if(saved)setCommentOpen(false);});}}><input autoFocus aria-label="Nota sobre o trecho" placeholder="Seu comentário…" maxLength={12000} value={note} onChange={e=>setNote(e.target.value)}/><button aria-label="Salvar comentário" title="Salvar comentário"><Save size={20}/></button></form>}
        </div>
      )}

      {audioOpen && (
        <AudioPlayer
          book={book}
          currentHref={currentTocHref || href}
          selection={selection?.text}
          currentText={(() => {
            try {
              const range = rendition.current?.getRange(cfi);
              const node = range?.startContainer;
              return (
                node?.parentElement?.closest("p")?.textContent ||
                node?.textContent ||
                undefined
              );
            } catch {
              return undefined;
            }
          })()}
          onClose={() => {
            audioNavigation.current++;
            setAudioOpen(false);
          }}
          onPlaying={setSpeaking}
          marked={book.bookmarks.some((mark) => mark.cfi === cfi)}
          onBookmark={() => void bookmark()}
          onVoiceNote={async(target,text,offset)=>{
            let point=cfi;
            const b=epub.current,section=b?.spine.get(target.split('#')[0]);
            if(!b||!section)throw Error('Não foi possível localizar o trecho do áudio.');await section.load(b.load.bind(b));const range=audioTextRange(section.document,text,{anchor:target.split('#')[1],offset});if(!range)throw Error('Não foi possível localizar o trecho do áudio. Volte ao texto para anotar.');point=section.cfiFromRange(range);
            setToolContext({cfi:point,text:text.slice(0,3000),href:target,chapter:book.toc.find(t=>t.href===target)?.label||chapter});setToolTab('voice');setSelection(null);setAudioOpen(false);setPanel('reading');
          }}
          onNavigate={(target, text, follow = false, offset) => {
            const request = ++audioNavigation.current;
            void (async () => {
              try {
                const b = epub.current,
                  r = rendition.current;
                if (!b || !r) return;
                const section = b.spine.get(target.split("#")[0]);
                if (text && section) {
                  await section.load(b.load.bind(b));
                  if (request !== audioNavigation.current) return;
                  const range = audioTextRange(section.document, text, {
                    anchor: target.split("#")[1],
                    offset,
                  });
                  if (range) {
                    range.collapse(true);
                    const point = section.cfiFromRange(range);
                    const location = r.location;
                    const compare = new EpubCFI();
                    if (
                      follow &&
                      location?.start?.cfi &&
                      location?.end?.cfi &&
                      compare.compare(point, location.start.cfi) >= 0 &&
                      compare.compare(point, location.end.cfi) <= 0
                    )
                      return;
                    navigationTarget.current = target;
                    await r.display(point);
                    return;
                  }
                }
                if (!follow && request === audioNavigation.current) {
                  navigationTarget.current = target;
                  await r.display(target);
                }
              } catch (e) {
                if (request === audioNavigation.current)
                  setError((e as Error).message);
              }
            })();
          }}
        />
      )}
      {settingsModal}
    </div>
  );
}
