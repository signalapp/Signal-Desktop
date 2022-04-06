import { WorkerInterface } from '../worker_interface';
import { join } from 'path';

let utilWorkerInterface: WorkerInterface | undefined;

export const callUtilsWorker = async (fnName: string, ...args: any): Promise<any> => {
  if (!utilWorkerInterface) {
    const utilWorkerPath = join('./', 'ts', 'webworker', 'workers', 'util.worker.js'); //app.getAppPath()
    utilWorkerInterface = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000); //{ type: 'module' }
  }
  return utilWorkerInterface?.callWorker(fnName, ...args);
};
