import {
  AsyncObjectWrapper,
  ConfigDumpDataNode,
  ConfigDumpRow,
  ConfigDumpRowWithoutData,
} from '../../types/sqlSharedTypes';
import { ConfigWrapperObjectTypes } from '../../webworker/workers/browser/libsession_worker_functions';
import { channels } from '../channels';

export const ConfigDumpData: AsyncObjectWrapper<ConfigDumpDataNode> = {
  getByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, pubkey: string) => {
    return channels.getByVariantAndPubkey(variant, pubkey);
  },
  getMessageHashesByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, pubkey: string) => {
    return channels.getMessageHashesByVariantAndPubkey(variant, pubkey);
  },
  saveConfigDump: (dump: ConfigDumpRow) => {
    console.warn('saveConfigDump', dump);
    return channels.saveConfigDump(dump);
  },
  saveCombinedMessageHashesForMatching: (dump: ConfigDumpRowWithoutData) => {
    console.warn('saveCombinedMessageHashesForMatching', dump);
    return channels.saveCombinedMessageHashesForMatching(dump);
  },
  getAllDumpsWithData: () => {
    return channels.getAllDumpsWithData();
  },
  getAllDumpsWithoutData: () => {
    return channels.getAllDumpsWithoutData();
  },
};
