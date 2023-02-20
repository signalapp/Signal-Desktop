import {
  AsyncObjectWrapper,
  ConfigDumpDataNode,
  ConfigDumpRow,
  ConfigDumpRowWithoutData,
  ConfigDumpRowWithoutHashes,
} from '../../types/sqlSharedTypes';
import { ConfigWrapperObjectTypes } from '../../webworker/workers/browser/libsession_worker_functions';
import { channels } from '../channels';
import { cleanData } from '../dataUtils';

export const ConfigDumpData: AsyncObjectWrapper<ConfigDumpDataNode> = {
  getByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, pubkey: string) => {
    return channels.getByVariantAndPubkey(variant, pubkey);
  },
  getMessageHashesByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, pubkey: string) => {
    return channels.getMessageHashesByVariantAndPubkey(variant, pubkey);
  },
  saveConfigDump: (dump: ConfigDumpRow) => {
    console.warn('saveConfigDump', dump.variant);
    if (dump.combinedMessageHashes.some(m => Boolean(m && m.length < 5))) {
      throw new Error('saveConfigDump combinedMessageHashes have invalid size');
    }
    return channels.saveConfigDump(cleanData(dump));
  },
  saveConfigDumpNoHashes: (dump: ConfigDumpRowWithoutHashes) => {
    return channels.saveConfigDumpNoHashes(cleanData(dump));
  },

  saveCombinedMessageHashesForMatching: (dump: ConfigDumpRowWithoutData) => {
    return channels.saveCombinedMessageHashesForMatching(cleanData(dump));
  },
  getAllDumpsWithData: () => {
    return channels.getAllDumpsWithData();
  },
  getAllDumpsWithoutData: () => {
    return channels.getAllDumpsWithoutData();
  },
  getCombinedHashesByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, pubkey: string) => {
    return channels.getCombinedHashesByVariantAndPubkey(variant, pubkey);
  },
};
