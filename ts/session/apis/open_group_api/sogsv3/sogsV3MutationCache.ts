/**
 * This is strictly use to resolve conflicts between local state and the opengroup poll updates
 * Currently only supports message reactions 26/08/2022
 */

import { findIndex } from 'lodash';

export enum ChangeType {
  REACTIONS = 0,
}

type ReactionAction = 'ADD' | 'REMOVE';

type ReactionChange = {
  messageId: number; // will be serverId of the reacted message
  emoji: string;
  action: ReactionAction;
};

export type SogsV3Mutation = {
  seqno: number | null; // null until mutating API request returns
  server: string; // server address
  room: string; // room name
  changeType: ChangeType;
  metadata: ReactionChange; // For now we only support message reactions
};

// we don't want to export this, we want to export functions that manipulate it
const sogsMutationCache: Array<SogsV3Mutation> = [];

function verifyEntry(entry: SogsV3Mutation): boolean {
  return Boolean(
    !entry.server ||
      !entry.room ||
      entry.seqno !== null ||
      entry.metadata.messageId ||
      entry.metadata.emoji ||
      entry.metadata.action === 'ADD' ||
      entry.metadata.action === 'REMOVE'
  );
}

export function addToMutationCache(entry: SogsV3Mutation) {
  if (!verifyEntry(entry)) {
    window.log.error('SOGS Mutation Cache: Entry verification failed!');
  } else {
    sogsMutationCache.push(entry);
    window.log.info('SOGS Mutation Cache: Entry added!', entry);
  }
}

export function updateMutationCache(entry: SogsV3Mutation) {
  if (!verifyEntry(entry)) {
    window.log.error('SOGS Mutation Cache: Entry verification failed!');
  } else {
    const entryIndex = findIndex(sogsMutationCache, entry);
    if (entryIndex >= 0) {
      sogsMutationCache[entryIndex] = entry;
      window.log.info('SOGS Mutation Cache: Entry updated!', entry);
    } else {
      window.log.error('SOGS Mutation Cache: Updated failed! Cannot find entry');
    }
  }
}

export function removeFromMutationCache() {
  // TODO
}
