export type NeuralVoice = {id: string; name: string; language: string; bytes: number; installed: boolean; bundled?:boolean};
export type Chapter = { id: string; label: string; href: string; text: string; headingEnds?: number[] };
export type Annotation = {
  id: string;
  cfi: string;
  text: string;
  note: string;
  color: string;
  chapter: string;
  created: number;
  favorite?: boolean;
  topics?: string[];
  audioId?: string;
  mapManualTopics?: boolean;
};
export type Bookmark = { cfi: string; label: string };
export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { label: string; href: string; excerpt: string }[];
};
export type ReaderPrefs = {
  theme: "paper" | "sepia" | "night";
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  width: number;
  flow: "paginated" | "scrolled-doc";
};
export type BookRecord = {
  id: string;
  title: string;
  author: string;
  cover?: string;
  data: ArrayBuffer;
  chapters: Chapter[];
  toc: { label: string; href: string }[];
  added: number;
  lastOpened: number;
  cfi?: string;
  positionUpdatedAt?: number;
  progress: number;
  collection: string;
  favorite: boolean;
  finished: boolean;
  annotations: Annotation[];
  bookmarks: Bookmark[];
  messages: Message[];
  prefs?: ReaderPrefs;
  readingBaseline?: { at: number; progress: number };
  readingMemory?: {text:string;cfi:string;chapter:string;at:number};
  resumeNote?: string;
};
export type Settings = {annaUrl:string; supportsIntegratedCatalog?:boolean};
export type BookDownload = {name:string;data:Uint8Array};
export type SpeechEngineState = {engines: {id: string; name: string}[]; selected: string; ready: boolean};
declare global {
  interface Window {
    folio?: {
      neuralVoices?(): Promise<{voices: NeuralVoice[]}>;
      downloadNeuralVoice?(id: string): Promise<void>;
      speechEngines?(): Promise<SpeechEngineState>;
      setSpeechEngine?(id: string): Promise<void>;
      openSpeechEngineSettings?(id: string): Promise<void>;
      beginKindleShare?(): Promise<void>;
      putKindleBook?(input: {id: string; offset: number; base64: string; complete: boolean; title?: string; author?: string}): Promise<void>;
      startKindleShare?(): Promise<{url: string; expiresAt: number}>;
      stopKindleShare?(): Promise<void>;
      kindleShareStatus?(): Promise<{running: boolean}>;
      setAppTheme?(theme: "dark" | "light"): Promise<void>;
      setImmersive?(enabled: boolean): Promise<void>;
      speak?(
        text: string,
        options?: {
          language?: string;
          voice?: string;
          rate?: number;
          sleepUntil?: number;
          pauses?: {offset: number; durationMs: number}[];
        },
      ): Promise<void>;
      speechVoices?(): Promise<{
        voices: {
          id: string;
          name: string;
          language: string;
          network: boolean;
        }[];
      }>;
      speechTimer?(sleepUntil: number): Promise<void>;
      stopSpeaking?(): Promise<void>;
      searchBooks?(input: {
        query: string;
        language?: string;
        page?: number;
      }): Promise<import("./catalog").CatalogResult>;
      searchCatalog?(input: {
        query: string;
        language?: string;
        format?: string;
        page?: number;
      }): Promise<import("./catalog").CatalogResult>;
      openCatalog?(
        url: string,
        options?: { collect?: "search" | "links" },
      ): Promise<void>;
      catalogLinks?(url: string): Promise<import("./catalog").CatalogLinks>;
      getSettings(): Promise<Settings>;
      saveSettings(settings:{annaUrl?:string}):Promise<Settings>;
      openExternal(url: string): Promise<void>;
      download(url: string): Promise<{ name: string; data: Uint8Array }>;
      exportFile(name: string, text: string): Promise<boolean>;
    };
  }
}

