/* eslint-disable no-unused-expressions */
import * as BetterSqlite3 from '@signalapp/better-sqlite3';
import { isArray } from 'lodash';
import { CONVERSATIONS_TABLE } from '../database_utility';
import { getIdentityKeys, sqlNode } from '../sql';

export const hasDebugEnvVariable = Boolean(process.env.SESSION_DEBUG);

/**
 * Verify we are calling the correct helper function in the correct migration before running it.
 *
 * You don't need to call this on functions that aren't being exported as helper functions in a file
 * @param version
 * @param targetVersion
 */
export function checkTargetMigration(version: number, targetVersion: number) {
  if (version !== targetVersion) {
    throw new Error(`Migration target mismatch. Expected: ${targetVersion}, Found: ${version}`);
  }
}

/**
 * Returns the logged in user conversation attributes and the keys.
 * If the keys exists but a conversation for that pubkey does not exist yet, the keys are still returned
 */
export function getLoggedInUserConvoDuringMigration(db: BetterSqlite3.Database) {
  const ourKeys = getIdentityKeys(db);

  if (!ourKeys || !ourKeys.publicKeyHex || !ourKeys.privateEd25519) {
    return null;
  }

  const ourConversation = db.prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`).get({
    id: ourKeys.publicKeyHex,
  }) as Record<string, any> | null;

  return { ourKeys, ourConversation: ourConversation || null };
}

export function getBlockedNumbersDuringMigration(db: BetterSqlite3.Database) {
  try {
    const blockedItem = sqlNode.getItemById('blocked', db);
    if (!blockedItem) {
      return [];
    }
    const foundBlocked = blockedItem?.value;
    hasDebugEnvVariable && console.info('foundBlockedNumbers during migration', foundBlocked);
    if (isArray(foundBlocked)) {
      return foundBlocked;
    }
    return [];
  } catch (e) {
    console.info('failed to read blocked numbers. Considering no blocked numbers', e.stack);
    return [];
  }
}
