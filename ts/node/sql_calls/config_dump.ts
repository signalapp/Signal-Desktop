/**
 * Config dumps sql calls
 */

import { compact, uniq } from 'lodash';
import {
  CONFIG_DUMP_TABLE,
  ConfigDumpDataNode,
  ConfigDumpRow,
  ConfigDumpRowWithoutData,
} from '../../types/sqlSharedTypes';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { ConfigWrapperObjectTypes } from '../../webworker/workers/browser/libsession_worker_functions';
import { assertGlobalInstance } from '../sqlInstance';

function parseRow(
  row: Pick<ConfigDumpRow, 'data' | 'publicKey' | 'variant'>
): ConfigDumpRow | null {
  const parsedNoData = parseRowNoData(row);
  if (!parsedNoData) {
    return null;
  }
  return { ...parsedNoData, data: row.data };
}

function parseRowNoData(
  row: Pick<ConfigDumpRow, 'data' | 'publicKey' | 'variant'>
): ConfigDumpRowWithoutData | null {
  const toRet: ConfigDumpRowWithoutData = {
    publicKey: row.publicKey,
    variant: row.variant,
  };

  return toRet;
}

export function uniqCompacted<T extends string>(list: Array<T>): Array<T> {
  if (!list || !list.length) {
    return [];
  }
  return uniq(compact(list));
}

export const configDumpData: ConfigDumpDataNode = {
  getByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, publicKey: string) => {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT publicKey, variant, data FROM ${CONFIG_DUMP_TABLE} WHERE variant = $variant AND publicKey = $publicKey;`
      )
      .all({
        publicKey,
        variant,
      });

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRow));
  },

  getAllDumpsWithData: () => {
    const rows = assertGlobalInstance()
      .prepare(`SELECT variant, publicKey, data from ${CONFIG_DUMP_TABLE};`)
      .all();

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRow));
  },

  getAllDumpsWithoutData: () => {
    const rows = assertGlobalInstance()
      .prepare(`SELECT variant, publicKey from ${CONFIG_DUMP_TABLE};`)
      .all();

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRowNoData));
  },

  saveConfigDump: ({ data, publicKey, variant }: ConfigDumpRow) => {
    assertGlobalInstance()
      .prepare(
        `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
              publicKey,
              variant,
              data
          ) values (
            $publicKey,
            $variant,
            $data
          );`
      )
      .run({
        publicKey,
        variant,
        data,
      });
  },
};
