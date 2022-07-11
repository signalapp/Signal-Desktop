import { WorkerInterface } from '../worker_interface';
import { join } from 'path';
import { getAppRootPath } from '../../node/getRootPath';

let utilWorkerInterface: WorkerInterface | undefined;

export const internalCallUtilsWorker = async (fnName: string, ...args: any): Promise<any> => {
  if (!utilWorkerInterface) {
    const utilWorkerPath = join(getAppRootPath(), 'ts', 'webworker', 'workers', 'util.worker.js');
    utilWorkerInterface = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000); //{ type: 'module' }
  }
  return utilWorkerInterface?.callWorker(fnName, ...args);
};

export const callUtilsWorker = async (fnName: string, ...args: any): Promise<any> => {
  return internalCallUtilsWorker(fnName, ...args);
};
