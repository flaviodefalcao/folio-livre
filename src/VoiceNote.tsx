import {useEffect,useRef,useState} from 'react';
import {get} from 'idb-keyval';
import {Mic,Square} from 'lucide-react';
import {voiceKey} from './reading-tools';
export function VoiceNotePlayer({id}:{id:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let live=true,source='';void get<Blob>(voiceKey(id)).then(blob=>{if(!blob)throw Error('A gravação não está disponível neste aparelho.');if(live){source=URL.createObjectURL(blob);setUrl(source);}}).catch(e=>live&&setError(e.message));return()=>{live=false;if(source)URL.revokeObjectURL(source);};},[id]);
 return url?<audio controls preload="metadata" src={url} aria-label="Ouvir nota de voz"/>:<p role="status">{error||'Abrindo gravação…'}</p>;
}
export default function VoiceNoteRecorder({onSave}:{onSave:(blob:Blob)=>Promise<void>}){
 const [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[blob,setBlob]=useState<Blob>(),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),live=useRef(true),requesting=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 useEffect(()=>{if(!blob){setUrl('');return;}const source=URL.createObjectURL(blob);setUrl(source);return()=>URL.revokeObjectURL(source);},[blob]);
 useEffect(()=>{if(!recording)return;const timer=setInterval(()=>setSeconds(s=>{if(s>=179&&recorder.current?.state==='recording')recorder.current.stop();return s+1;}),1000);const hide=()=>{if(document.hidden&&recorder.current?.state==='recording')recorder.current.stop();};document.addEventListener('visibilitychange',hide);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);};},[recording]);
 async function record(){if(requesting.current)return;setError('');if(recording){recorder.current?.stop();return;}if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('A gravação não está disponível neste ambiente.');return;}requesting.current=true;
  try{stream.current=await navigator.mediaDevices.getUserMedia({audio:true});if(!live.current){stream.current.getTracks().forEach(t=>t.stop());return;}const type=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));const rec=new MediaRecorder(stream.current,type?{mimeType:type}:undefined);recorder.current=rec;let size=0;const parts:BlobPart[]=[];
   rec.ondataavailable=e=>{if(e.data.size){parts.push(e.data);size+=e.data.size;if(size>=19*1024*1024&&rec.state==='recording')rec.stop();}};
   rec.onstop=()=>{stream.current?.getTracks().forEach(t=>t.stop());if(live.current){setRecording(false);const result=new Blob(parts,{type:rec.mimeType});if(result.size&&result.size<=20*1024*1024)setBlob(result);else setError('Não foi possível guardar a gravação. Grave uma nota menor.');}};
   rec.onerror=()=>{stream.current?.getTracks().forEach(t=>t.stop());if(live.current){setRecording(false);setError('A gravação falhou. Tente novamente.');}};setBlob(undefined);setSeconds(0);setRecording(true);rec.start(1000);
  }catch{stream.current?.getTracks().forEach(t=>t.stop());setError('Permita o microfone para gravar sua nota.');}finally{requesting.current=false;}
 }
 return <div className="voice-note-recorder"><p>Grave sua reflexão sobre este trecho. O áudio fica salvo no aparelho.</p><button className="primary-button" disabled={busy} onClick={()=>void record()}>{recording?<Square size={18}/>:<Mic size={18}/>} {recording?`Parar gravação · ${seconds}s`:blob?'Gravar novamente':'Gravar nota de voz'}</button>{url&&<audio controls src={url} aria-label="Conferir nota de voz"/>}{blob&&!recording&&<button className="primary-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onSave(blob);if(live.current)setBlob(undefined);}catch(e){if(live.current)setError((e as Error).message);}finally{if(live.current)setBusy(false);}}}>{busy?'Salvando…':'Salvar nota de voz neste trecho'}</button>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
