import { AsyncObjectWrapper, ConfigDumpDataNode, ConfigDumpRow } from '../../types/sqlSharedTypes';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { ConfigWrapperObjectTypes } from '../../webworker/workers/browser/libsession_worker_functions';
import { channels } from '../channels';
import { cleanData } from '../dataUtils';

export const ConfigDumpData: AsyncObjectWrapper<ConfigDumpDataNode> = {
  getByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, pubkey: string) => {
    return channels.getByVariantAndPubkey(variant, pubkey);
  },
  saveConfigDump: (dump: ConfigDumpRow) => {
    return channels.saveConfigDump(cleanData(dump));
  },
  getAllDumpsWithData: () => {
    return channels.getAllDumpsWithData();
  },
  getAllDumpsWithoutData: () => {
    return channels.getAllDumpsWithoutData();
  },
};
