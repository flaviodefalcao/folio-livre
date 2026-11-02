import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import type { Settings } from "./types";
interface NativeAPI {
  addListener(
    eventName: string,
    listener: (data: any) => void,
  ): Promise<PluginListenerHandle>;
  neuralVoices(): Promise<{voices: import("./types").NeuralVoice[]}>;
  downloadNeuralVoice(input: {id: string}): Promise<void>;
  speechEngines(): Promise<import("./types").SpeechEngineState>;
  setSpeechEngine(input: {id: string}): Promise<void>;
  openSpeechEngineSettings(input: {id: string}): Promise<void>;
  beginKindleShare(): Promise<void>;
  putKindleBook(input: {id: string; offset: number; base64: string; complete: boolean; title?: string; author?: string}): Promise<void>;
  startKindleShare(): Promise<{url: string; expiresAt: number}>;
  stopKindleShare(): Promise<void>;
  kindleShareStatus(): Promise<{running: boolean}>;
  setAppTheme(input: { theme: string }): Promise<void>;
  setImmersive(input: { enabled: boolean }): Promise<void>;
  speak(input: {
    text: string;
    language?: string;
    voice?: string;
    rate?: number;
    sleepUntil?: number;
    pauses?: {offset: number; durationMs: number}[];
  }): Promise<void>;
  speechVoices(): Promise<{
    voices: { id: string; name: string; language: string; network: boolean }[];
  }>;
  speechTimer(input: { sleepUntil: number }): Promise<void>;
  stopSpeaking(): Promise<void>;
  searchBooks(input: {
    query: string;
    language?: string;
    page?: number;
  }): Promise<import("./catalog").CatalogResult>;
  searchCatalog(input: {
    query: string;
    language?: string;
    format?: string;
    page?: number;
  }): Promise<import("./catalog").CatalogResult>;
  openCatalog(input: {
    url: string;
    collect?: "search" | "links";
  }): Promise<void>;
  catalogLinks(input: {
    url: string;
  }): Promise<import("./catalog").CatalogLinks>;
  getSettings(): Promise<Settings>;
  saveSettings(settings:{annaUrl?:string}):Promise<Settings>;
  openExternal(input: { url: string }): Promise<void>;
  download(input: { url: string }): Promise<{ name: string; base64: string }>;
  exportFile(input: {
    name: string;
    text: string;
  }): Promise<{ saved: boolean }>;
}
let foreground = true;
export const isAppForeground = () => foreground;
/** Wait for the main Activity to finish resuming after an ordinary catalog Activity closes. */
export async function waitForForeground(timeout=2000):Promise<void>{
 if(isAppForeground())return;
 await new Promise<void>(resolve=>{let timer:ReturnType<typeof setTimeout>;const done=()=>{clearTimeout(timer);window.removeEventListener('folio-app-state',check);resolve();};const check=()=>{if(isAppForeground())done();};window.addEventListener('folio-app-state',check);timer=setTimeout(done,timeout);check();});
}
const native = registerPlugin<NativeAPI>("FolioNative");
export function initializeNative() {
  if (!Capacitor.isNativePlatform()) return;
  const ios = Capacitor.getPlatform() === "ios";
  document.documentElement.classList.add("native-app");
  if (ios) document.documentElement.classList.add("ios-app");
  const stateChanged = ({ isActive }: { isActive: boolean }) => {
    foreground = isActive;
    window.dispatchEvent(new Event("folio-app-state"));
  };
  void CapacitorApp.getState().then(stateChanged);
  void CapacitorApp.addListener("appStateChange", stateChanged);
  void CapacitorApp.addListener("pause", () =>
    stateChanged({ isActive: false }),
  );
  void CapacitorApp.addListener("resume", () =>
    stateChanged({ isActive: true }),
  );
  void CapacitorApp.addListener("backButton", () => {
    const event = new Event("folio-back", { cancelable: true });
    if (window.dispatchEvent(event)) void CapacitorApp.exitApp();
  });
  void native.addListener("speechStopped", () =>
    window.dispatchEvent(new Event("folio-speech-stopped")),
  );
  void native.addListener("speechProgress", (detail) =>
    window.dispatchEvent(new CustomEvent("folio-speech-progress", { detail })),
  );
  void native.addListener("speechError", () =>
    window.dispatchEvent(new Event("folio-speech-error")),
  );
  void native.addListener("speechEnded", () =>
    window.dispatchEvent(new Event("folio-speech-ended")),
  );
  if(!ios)void native.addListener("speechVoicesChanged", () =>
    window.dispatchEvent(new Event("folio-speech-voices")),
  );
  void native.addListener("catalogResults", (result) =>
    window.dispatchEvent(
      new CustomEvent("folio-catalog-results", { detail: result }),
    ),
  );
  void native.addListener("catalogDownload", (result) => {
    const raw = atob(result.base64);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    window.dispatchEvent(
      new CustomEvent("folio-catalog-download", {
        detail: { name: result.name, data: bytes },
      }),
    );
  });
  void native.addListener("catalogLinks", (result) =>
    window.dispatchEvent(
      new CustomEvent("folio-catalog-links", { detail: result }),
    ),
  );
  void native.addListener("neuralDownloadProgress", detail => window.dispatchEvent(new CustomEvent("folio-neural-download", {detail})));
  window.folio = {
    ...(ios ? {} : {
    neuralVoices: () => native.neuralVoices(),
    speechEngines: () => native.speechEngines(),
    setSpeechEngine: id => native.setSpeechEngine({id}),
    openSpeechEngineSettings: id => native.openSpeechEngineSettings({id}),
    downloadNeuralVoice: id => native.downloadNeuralVoice({id}),
    beginKindleShare: () => native.beginKindleShare(),
    putKindleBook: (input) => native.putKindleBook(input),
    startKindleShare: () => native.startKindleShare(),
    stopKindleShare: () => native.stopKindleShare(),
    kindleShareStatus: () => native.kindleShareStatus(),
    }),
    searchBooks: (input) => native.searchBooks(input),
    searchCatalog: (input) => native.searchCatalog(input),
    openCatalog: (url, options) => native.openCatalog({ url, ...options }),
    catalogLinks: (url) => native.catalogLinks({ url }),
    setAppTheme: (theme) => native.setAppTheme({ theme }),
    setImmersive: (enabled) => native.setImmersive({ enabled }),
    speechTimer: (sleepUntil) => native.speechTimer({ sleepUntil }),
    speak: (text, options) => native.speak({ text, ...options }),
    speechVoices: () => native.speechVoices(),
    stopSpeaking: () => native.stopSpeaking(),
    getSettings: () => native.getSettings(),
    saveSettings: (s) => native.saveSettings(s),
    openExternal: (url) => native.openExternal({ url }),
    download: async (url) => {
      const r = await native.download({ url });
      const raw = atob(r.base64);
      const data = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
      return { name: r.name, data };
    },
    exportFile: async (name, text) =>
      (await native.exportFile({ name, text })).saved,
  };
}
