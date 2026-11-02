import {useEffect, useRef, useState} from "react";
import type {SpeechEngineState} from "./types";

const pocket = "org.pockettts.android.engine";
const downloads = "https://github.com/The-unknown-Shadowman/PocketTTS-Android-Engine/releases/latest";

export default function SpeechEngines({onStop, onChanged}: {onStop: () => void; onChanged: () => Promise<void>}) {
  const [state, setState] = useState<SpeechEngineState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    live.current = true;
    const load = () => {
      void window.folio?.speechEngines?.().then(result => {if(live.current)setState(result);}).catch(err => {if(live.current)setError(err.message);});
    };
    load();
    window.addEventListener("folio-app-state", load);
    window.addEventListener("folio-speech-voices", load);
    return () => {live.current = false; window.removeEventListener("folio-app-state", load); window.removeEventListener("folio-speech-voices", load);};
  }, []);
  if(!window.folio?.speechEngines || !window.folio.setSpeechEngine)return null;
  async function select(id: string) {
    if(locked.current)return;
    locked.current = true;setBusy(true);setError("");onStop();
    try {
      await window.folio!.setSpeechEngine!(id);
      const result = await window.folio!.speechEngines!();
      if(live.current)setState(result);
      await onChanged();
    } catch(err) {if(live.current)setError((err as Error).message);}
    finally {locked.current = false;if(live.current)setBusy(false);}
  }
  async function configure() {
    setError("");onStop();
    try {await window.folio?.openSpeechEngineSettings?.(state?.selected || "");}
    catch(err) {if(live.current)setError((err as Error).message);}
  }
  async function openDownloads() {
    try {
      if(window.folio?.openExternal)await window.folio.openExternal(downloads);
      else window.open(downloads,"_blank","noopener,noreferrer");
    }catch(err){if(live.current)setError((err as Error).message);}
  }
  const installed = state?.engines.some(engine => engine.id === pocket);
  return <section className="speech-engines" aria-label="Motor de voz do Android" aria-busy={busy}>
    <label>Motor de voz
      <select aria-label="Motor de voz" value={state?.selected || ""} disabled={busy || !state} onChange={event => void select(event.target.value)}>
        <option value="">Padrão do Android</option>
        {state?.selected && !state.engines.some(engine => engine.id === state.selected) && <option value={state.selected}>Motor salvo indisponível</option>}
        {state?.engines.map(engine => <option key={engine.id} value={engine.id}>{engine.name}</option>)}
      </select>
    </label>
    <div className="speech-engine-actions">
      <button type="button" disabled={busy || !state || !window.folio?.openSpeechEngineSettings} onClick={() => void configure()}>Configurar motor e voz</button>
      <button type="button" disabled={busy || !state} onClick={() => void select(state?.selected || "")}>{busy ? "Preparando motor…" : "Atualizar motores e vozes"}</button>
    </div>
    <details>
      <summary>Usar uma voz personalizada offline</summary>
      <p>O Pocket TTS é um motor gratuito e experimental instalado separadamente. Baixe o APK e o pacote de português; no Pocket TTS, importe o pacote e uma amostra WAV limpa de 5 a 15 segundos de uma voz sua ou autorizada.</p>
      <p>Volte aqui, toque em Atualizar motores e vozes, escolha Pocket TTS e selecione a voz e o idioma abaixo. Depois do download inicial, a leitura acontece no celular. A velocidade e a qualidade dependem do aparelho e da gravação.</p>
      <button type="button" onClick={() => void openDownloads()}>{installed ? "Ver downloads do Pocket TTS" : "Baixar Pocket TTS e modelo"}</button>
    </details>
    {state && !state.ready && !busy && <p role="status">O motor ainda não está pronto. Configure-o e atualize as vozes, ou escolha outro motor.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
