import { WorkerInterface } from '../worker_interface';
import { join } from 'path';
import { ipcRenderer } from 'electron';

let utilWorkerInterface: WorkerInterface | undefined;

export const callUtilsWorker = async (fnName: string, ...args: any): Promise<any> => {
  if (!utilWorkerInterface) {
    const apDataPath = await ipcRenderer.invoke('get-data-path');
    const utilWorkerPath = join(apDataPath, 'ts', 'webworker', 'workers', 'util.worker.js');
    utilWorkerInterface = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000); //{ type: 'module' }
  }
  return utilWorkerInterface?.callWorker(fnName, ...args);
};
