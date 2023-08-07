/* eslint-disable no-restricted-syntax */
/**
 * This is strictly use to resolve conflicts between local state and the opengroup poll updates
 * Currently only supports message reactions 26/08/2022
 */

import { filter, findIndex, remove } from 'lodash';
import { Reactions } from '../../../../util/reactions';
import { OpenGroupReactionMessageV4 } from '../opengroupV2/OpenGroupServerPoller';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';

export enum ChangeType {
  REACTIONS = 0,
}

type ReactionAction = 'ADD' | 'REMOVE' | 'CLEAR';

type ReactionChange = {
  messageId: number; // will be serverId of the reacted message
  emoji: string;
  action: ReactionAction;
};

export type SogsV3Mutation = {
  seqno: number | null; // null until mutating API request returns
  server: string; // serverUrl
  room: string; // roomId
  changeType: ChangeType;
  metadata: ReactionChange; // For now we only support message reactions
};

// we don't want to export this, we want to export functions that manipulate it
const sogsMutationCache: Array<SogsV3Mutation> = [];

// for testing purposes only
export function getMutationCache() {
  return sogsMutationCache;
}

function verifyEntry(entry: SogsV3Mutation): boolean {
  return Boolean(
    entry.server &&
      entry.room &&
      entry.changeType === ChangeType.REACTIONS &&
      entry.metadata.messageId &&
      entry.metadata.emoji &&
      (entry.metadata.action === 'ADD' ||
        entry.metadata.action === 'REMOVE' ||
        entry.metadata.action === 'CLEAR')
  );
}

export function addToMutationCache(entry: SogsV3Mutation) {
  if (!verifyEntry(entry)) {
    window.log.error('SOGS Mutation Cache: Entry verification on add failed!', entry);
  } else {
    sogsMutationCache.push(entry);
    window.log.debug('SOGS Mutation Cache: Entry added!', entry);
  }
}

export function updateMutationCache(entry: SogsV3Mutation, seqno: number) {
  if (!verifyEntry(entry)) {
    window.log.error('SOGS Mutation Cache: Entry verification on update failed!', entry);
  } else {
    const entryIndex = findIndex(sogsMutationCache, entry);
    if (entryIndex >= 0) {
      sogsMutationCache[entryIndex].seqno = seqno;
      window.log.debug('SOGS Mutation Cache: Entry updated!', sogsMutationCache[entryIndex]);
    } else {
      window.log.error('SOGS Mutation Cache: Updated failed! Cannot find entry', entry);
    }
  }
}

// return is for testing purposes only
export async function processMessagesUsingCache(
  server: string,
  room: string,
  message: OpenGroupReactionMessageV4
): Promise<OpenGroupReactionMessageV4> {
  const updatedReactions = message.reactions;

  const roomMatches: Array<SogsV3Mutation> = filter(sogsMutationCache, { server, room });
  for (let i = 0; i < roomMatches.length; i++) {
    const matchSeqno = roomMatches[i].seqno;
    if (message.seqno && matchSeqno && matchSeqno <= message.seqno) {
      const removedEntry = roomMatches.splice(i, 1)[0];
      window.log.debug(
        `SOGS Mutation Cache: Entry ignored and removed in ${server}/${room} for message ${message.id}`,
        removedEntry
      );
      remove(sogsMutationCache, removedEntry);
    }
  }

  for (const reaction of Object.keys(message.reactions)) {
    const reactionMatches = filter(roomMatches, {
      server,
      room,
      changeType: ChangeType.REACTIONS,
      metadata: {
        messageId: message.id,
        emoji: reaction,
      },
    });

    for (const reactionMatch of reactionMatches) {
      switch (reactionMatch.metadata.action) {
        case 'ADD':
          updatedReactions[reaction].you = true;
          updatedReactions[reaction].count += 1;
          window.log.debug(
            `SOGS Mutation Cache: Added our reaction based on the cache in ${server}/${room} for message ${message.id}`,
            updatedReactions[reaction]
          );
          break;
        case 'REMOVE':
          updatedReactions[reaction].you = false;
          updatedReactions[reaction].count -= 1;
          window.log.debug(
            `SOGS Mutation Cache: Removed our reaction based on the cache in ${server}/${room} for message ${message.id}`,
            updatedReactions[reaction]
          );
          break;
        case 'CLEAR':
          delete updatedReactions[reaction];
          window.log.debug(
            `SOGS Mutation Cache: Cleared all ${reaction} reactions based on the cache in ${server}/${room} for message ${message.id}`
          );
          break;
        default:
          window.log.warn(
            `SOGS Mutation Cache: Unsupported metadata action in OpenGroupMessageV4 in ${server}/${room} for message ${message.id}`,
            reactionMatch
          );
      }
      const removedEntry = remove(sogsMutationCache, reactionMatch);
      window.log.info(
        `SOGS Mutation Cache: Entry removed in ${server}/${room} for message ${message.id}`,
        removedEntry
      );
    }
  }

  // eslint-disable-next-line no-param-reassign
  message.reactions = updatedReactions;
  await Reactions.handleOpenGroupMessageReactions(
    getOpenGroupV2ConversationId(server, room),
    message.id,
    message.reactions
  );
  return message;
}
