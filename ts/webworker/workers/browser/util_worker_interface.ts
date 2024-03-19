import { join } from 'path';
import { getAppRootPath } from '../../../node/getRootPath';
import { WorkerInterface } from '../../worker_interface';

let utilWorkerInterface: WorkerInterface | undefined;

type WorkerAllowedFunctionName =
  | 'arrayBufferToStringBase64'
  | 'decryptAttachmentBufferNode'
  | 'encryptAttachmentBufferNode'
  | 'DecryptAESGCM'
  | 'fromBase64ToArrayBuffer'
  | 'verifyAllSignatures'
  | 'encryptForPubkey';

const internalCallUtilsWorker = async (
  fnName: WorkerAllowedFunctionName,
  ...args: any
): Promise<any> => {
  if (!utilWorkerInterface) {
    const utilWorkerPath = join(
      getAppRootPath(),
      'ts',
      'webworker',
      'workers',
      'node',
      'util',
      'util.worker.compiled.js'
    );
    utilWorkerInterface = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000);
  }
  return utilWorkerInterface?.callWorker(fnName, ...args);
};

export const callUtilsWorker = async (
  fnName: WorkerAllowedFunctionName,
  ...args: any
): Promise<any> => {
  return internalCallUtilsWorker(fnName, ...args);
};
