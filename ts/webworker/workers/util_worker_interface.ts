import { WorkerInterface } from '../worker_interface';
import { join } from 'path';

const utilWorkerPath = join('./', 'ts', 'webworker', 'workers', 'util.worker.js'); //app.getAppPath()
const utilWorkerInterface = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000); //{ type: 'module' }

export const callUtilsWorker = async (fnName: string, ...args: any): Promise<any> => {
  return utilWorkerInterface.callWorker(fnName, ...args);
};
