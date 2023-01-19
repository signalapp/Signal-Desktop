import {
  AsyncWrapper,
  ConfigDumpRow,
  GetByPubkeyConfigDump,
  GetByVariantAndPubkeyConfigDump,
  SaveConfigDump,
  SharedConfigSupportedVariant,
} from '../../types/sqlSharedTypes';
import { channels } from '../channels';

const getByVariantAndPubkey: AsyncWrapper<GetByVariantAndPubkeyConfigDump> = (
  variant: SharedConfigSupportedVariant,
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

export const ConfigDumpData = { getByVariantAndPubkey, getByPubkey, saveConfigDump };
