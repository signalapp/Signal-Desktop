import { WorkerInterface } from '../../worker_interface';
import { join } from 'path';
import { getAppRootPath } from '../../../node/getRootPath';
import { LibSessionWorkerFunctions } from './libsession_worker_functions';

let libsessionWorkerInterface: WorkerInterface | undefined;

const internalCallLibSessionWorker = async ([
  config,
  fnName,
  ...args
]: LibSessionWorkerFunctions): Promise<any> => {
  if (!libsessionWorkerInterface) {
    const libsessionWorkerPath = join(
      getAppRootPath(),
      'ts',
      'webworker',
      'workers',
      'node',
      'libsession',
      'libsession.worker.js'
    );

    libsessionWorkerInterface = new WorkerInterface(libsessionWorkerPath, 1 * 60 * 1000);
  }
  return libsessionWorkerInterface?.callWorker(config, fnName, ...args);
};

export const callLibSessionWorker = async (callToMake: LibSessionWorkerFunctions): Promise<any> => {
  return internalCallLibSessionWorker(callToMake);
};
