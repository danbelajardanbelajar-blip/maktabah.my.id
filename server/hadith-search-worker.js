import {parentPort,workerData} from 'node:worker_threads';
import {searchHadith,buildHadithIndex} from './hadith-search-core.js';
try{parentPort.postMessage({result:workerData.action==='build'?buildHadithIndex(workerData,progress=>parentPort.postMessage({progress})):searchHadith(workerData)});}
catch(e){parentPort.postMessage({error:e.message,status:e.status||503,code:e.code});}
