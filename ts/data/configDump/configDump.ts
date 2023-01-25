import {
  AsyncWrapper,
  ConfigDumpRow,
  GetAllDumps,
  GetByPubkeyConfigDump,
  GetByVariantAndPubkeyConfigDump,
  SaveConfigDump,
} from '../../types/sqlSharedTypes';
import { ConfigWrapperObjectTypes } from '../../webworker/workers/browser/libsession_worker_functions';
import { channels } from '../channels';

const getByVariantAndPubkey: AsyncWrapper<GetByVariantAndPubkeyConfigDump> = (
  variant: ConfigWrapperObjectTypes,
  pubkey: string
) => {
  return channels.getConfigDumpByVariantAndPubkey(variant, pubkey);
};

const getByPubkey: AsyncWrapper<GetByPubkeyConfigDump> = (pubkey: string) => {
  return channels.getConfigDumpsByPk(pubkey);
};

const saveConfigDump: AsyncWrapper<SaveConfigDump> = (dump: ConfigDumpRow) => {
  return channels.saveConfigDump(dump);
};

const getAllDumpsWithData: AsyncWrapper<GetAllDumps> = () => {
  return channels.getAllDumpsWithData();
};

const getAllDumpsWithoutData: AsyncWrapper<GetAllDumps> = () => {
  return channels.getAllDumpsWithoutData();
};

export const ConfigDumpData = {
  getByVariantAndPubkey,
  getByPubkey,
  saveConfigDump,
  getAllDumpsWithData,
  getAllDumpsWithoutData,
};
