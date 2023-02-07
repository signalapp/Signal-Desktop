/**
 * Config dumps sql calls
 */

import { compact, flatten, isEmpty, uniq } from 'lodash';
import {
  ConfigDumpDataNode,
  ConfigDumpRow,
  ConfigDumpRowWithoutData,
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

function parseRowMessageHashes(row: CombinedMessageHashes): Array<string> {
  if (!isEmpty(row.combinedMessageHashes) && row.combinedMessageHashes) {
    try {
      return JSON.parse(row.combinedMessageHashes) || [];
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
        'SELECT publicKey, variant, combinedMessageHashes, data from configDump WHERE variant = $variant AND publicKey = $publicKey;'
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

  getMessageHashesByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, publicKey: string) => {
    const rows = assertGlobalInstance()
      .prepare(
        'SELECT combinedMessageHashes from configDump WHERE variant = $variant AND publicKey = $publicKey;'
      )
      .all({
        publicKey,
        variant,
      });

    if (!rows) {
      return [];
    }
    return uniq(flatten(rows.map(parseRowMessageHashes)));
  },

  getAllDumpsWithData: () => {
    const rows = assertGlobalInstance()
      .prepare('SELECT variant, publicKey, combinedMessageHashes, data from configDump;')
      .all();

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRow));
  },

  getAllDumpsWithoutData: () => {
    const rows = assertGlobalInstance()
      .prepare('SELECT variant, publicKey, combinedMessageHashes from configDump;')
      .all();

    if (!rows) {
      return [];
    }

    return compact(rows.map(parseRowNoData));
  },

  saveConfigDump: ({ data, publicKey, variant, combinedMessageHashes }: ConfigDumpRow) => {
    assertGlobalInstance()
      .prepare(
        `INSERT OR REPLACE INTO configDump (
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
        combinedMessageHashes: JSON.stringify(combinedMessageHashes || []),
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
        `UPDATE configDump SET
         combinedMessageHashes = $combinedMessageHashes
         WHERE publicKey=$publicKey AND variant=$variant;`
      )
      .run({
        publicKey,
        variant,
        combinedMessageHashes: JSON.stringify(combinedMessageHashes || []),
      });
  },

  getCombinedHashesByVariantAndPubkey: (variant: ConfigWrapperObjectTypes, publicKey: string) => {
    const rows = assertGlobalInstance()
      .prepare(
        'SELECT combinedMessageHashes from configDump WHERE variant = $variant AND publicKey = $publicKey;'
      )
      .all({
        publicKey,
        variant,
      });

    if (!rows) {
      return new Set();
    }
    const asArrays = compact(
      rows.map(t => {
        try {
          return JSON.parse(t.combinedMessageHashes);
        } catch {
          return null;
        }
      })
    );
    return new Set(asArrays.flat(1));
  },
};
