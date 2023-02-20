/**
 * Config dumps sql calls
 */

import { compact, isEmpty, uniq } from 'lodash';
import { uniqFromListOfList } from '../../shared/string_utils';
import {
  ConfigDumpDataNode,
  ConfigDumpRow,
  ConfigDumpRowWithoutData,
  ConfigDumpRowWithoutHashes,
  CONFIG_DUMP_TABLE,
} from '../../types/sqlSharedTypes';
import { ConfigWrapperObjectTypes } from '../../webworker/workers/browser/libsession_worker_functions';
import { assertGlobalInstance } from '../sqlInstance';

type CombinedMessageHashes = { combinedMessageHashes?: string };

function parseRow(
  row: Pick<ConfigDumpRow, 'data' | 'publicKey' | 'variant'> & CombinedMessageHashes
): ConfigDumpRow | null {
  const parsedNoData = parseRowNoData(row);
  if (!parsedNoData) {
    return null;
  }
  return { ...parsedNoData, data: row.data };
}

function parseRowNoData(
  row: Pick<ConfigDumpRow, 'data' | 'publicKey' | 'variant'> & CombinedMessageHashes
): ConfigDumpRowWithoutData | null {
  const toRet: ConfigDumpRowWithoutData = {
    publicKey: row.publicKey,
    variant: row.variant,
    combinedMessageHashes: [],
  };
  toRet.combinedMessageHashes = parseRowMessageHashes(row);

  return toRet;
}

export function uniqCompacted<T extends string>(list: Array<T>): Array<T> {
  if (!list || !list.length) {
    return [];
  }
  return uniq(compact(list));
}

function parseRowMessageHashes(row: CombinedMessageHashes): Array<string> {
  if (!isEmpty(row.combinedMessageHashes) && row.combinedMessageHashes) {
    try {
      return uniqCompacted(JSON.parse(row.combinedMessageHashes));
    } catch (e) {
      console.warn('parseRowMessageHashes row failed');
    }
  }
  return [];
}

export const configDumpData: ConfigDumpDataNode = {
  getByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, publicKey: string) => {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT publicKey, variant, combinedMessageHashes, data from ${CONFIG_DUMP_TABLE} WHERE variant = $variant AND publicKey = $publicKey;`
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

  getMessageHashesByVariantAndPubkey: (
    variant: ConfigWrapperObjectTypes,
    publicKey: string
  ): Array<string> => {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT combinedMessageHashes from ${CONFIG_DUMP_TABLE} WHERE variant = $variant AND publicKey = $publicKey;`
      )
      .all({
        publicKey,
        variant,
      });

    if (!rows) {
      return [];
    }
    const parsedRows: Array<Array<string>> = rows.map(parseRowMessageHashes);

    const unique: Array<string> = uniqFromListOfList(parsedRows);
    return unique;
  },

  getAllDumpsWithData: () => {
    const rows = assertGlobalInstance()
      .prepare(`SELECT variant, publicKey, combinedMessageHashes, data from ${CONFIG_DUMP_TABLE};`)
      .all();

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRow));
  },

  getAllDumpsWithoutData: () => {
    const rows = assertGlobalInstance()
      .prepare(`SELECT variant, publicKey, combinedMessageHashes from ${CONFIG_DUMP_TABLE};`)
      .all();

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRowNoData));
  },

  saveConfigDump: ({ data, publicKey, variant, combinedMessageHashes }: ConfigDumpRow) => {
    assertGlobalInstance()
      .prepare(
        `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
              publicKey,
              variant,
              combinedMessageHashes,
              data
          ) values (
            $publicKey,
            $variant,
            $combinedMessageHashes,
            $data
          );`
      )
      .run({
        publicKey,
        variant,
        combinedMessageHashes: JSON.stringify(uniqCompacted(combinedMessageHashes)),
        data,
      });
  },
  saveConfigDumpNoHashes: ({ data, publicKey, variant }: ConfigDumpRowWithoutHashes) => {
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

  saveCombinedMessageHashesForMatching: ({
    publicKey,
    variant,
    combinedMessageHashes,
  }: ConfigDumpRowWithoutData) => {
    assertGlobalInstance()
      .prepare(
        `UPDATE ${CONFIG_DUMP_TABLE} SET
         combinedMessageHashes = $combinedMessageHashes
         WHERE publicKey=$publicKey AND variant=$variant;`
      )
      .run({
        publicKey,
        variant,
        combinedMessageHashes: JSON.stringify(uniqCompacted(combinedMessageHashes)),
      });
  },

  getCombinedHashesByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, publicKey: string) => {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT combinedMessageHashes from ${CONFIG_DUMP_TABLE} WHERE variant = $variant AND publicKey = $publicKey;`
      )
      .all({
        publicKey,
        variant,
      });

    if (!rows) {
      return new Array<string>();
    }
    return uniqFromListOfList(rows.map(parseRowMessageHashes));
  },
};
