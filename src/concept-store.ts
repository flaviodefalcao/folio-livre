import {get,set} from 'idb-keyval';
import {emptyMap,type MapData} from './concept-map';
const KEY='folio:concept-map:v1';let queue:Promise<unknown>=Promise.resolve();
export async function loadMap():Promise<MapData>{const data=await get<MapData>(KEY);return data?.version===1?data:emptyMap();}
export function saveMap(data:MapData):Promise<void>{const task=queue.then(()=>set(KEY,data));queue=task.catch(()=>{});return task;}
