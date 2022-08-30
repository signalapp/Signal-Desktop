/**
 * This is strictly use to resolve conflicts between local state and the opengroup poll updates
 * Currently only supports message reactions 26/08/2022
 */

import { filter, findIndex, remove } from 'lodash';
import { Reactions } from '../../../../util/reactions';
import { OpenGroupMessageV4 } from '../opengroupV2/OpenGroupServerPoller';

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

function verifyEntry(entry: SogsV3Mutation): boolean {
  return Boolean(
    entry.server &&
      entry.server !== '' &&
      entry.room &&
      entry.room !== '' &&
      entry.changeType === ChangeType.REACTIONS &&
      entry.metadata.messageId &&
      entry.metadata.emoji &&
      entry.metadata.emoji !== '' &&
      (entry.metadata.action === 'ADD' ||
        entry.metadata.action === 'REMOVE' ||
        entry.metadata.action === 'CLEAR')
  );
}

// we return the cache for testing
export function addToMutationCache(entry: SogsV3Mutation): Array<SogsV3Mutation> {
  if (!verifyEntry(entry)) {
    window.log.error('SOGS Mutation Cache: Entry verification on add failed!', entry);
  } else {
    sogsMutationCache.push(entry);
    window.log.info('SOGS Mutation Cache: Entry added!', entry);
  }
  return sogsMutationCache;
}

// we return the cache for testing
export function updateMutationCache(entry: SogsV3Mutation, seqno: number): Array<SogsV3Mutation> {
  if (!verifyEntry(entry)) {
    window.log.error('SOGS Mutation Cache: Entry verification on update failed!', entry);
  } else {
    const entryIndex = findIndex(sogsMutationCache, entry);
    if (entryIndex >= 0) {
      sogsMutationCache[entryIndex].seqno = seqno;
      window.log.info('SOGS Mutation Cache: Entry updated!', sogsMutationCache[entryIndex]);
    } else {
      window.log.error('SOGS Mutation Cache: Updated failed! Cannot find entry', entry);
    }
  }
  return sogsMutationCache;
}

// return is for testing purposes only
export async function processMessagesUsingCache(
  server: string,
  room: string,
  message: OpenGroupMessageV4
): Promise<OpenGroupMessageV4> {
  const updatedReactions = message.reactions;
  const roomMatches: Array<SogsV3Mutation> = filter(sogsMutationCache, { server, room });

  for (const roomMatch of roomMatches) {
    if (message.seqno && roomMatch.seqno && roomMatch.seqno <= message.seqno) {
      const removedEntry = remove(sogsMutationCache, roomMatch);
      window.log.info('SOGS Mutation Cache: Entry ignored and removed!', removedEntry);
    } else if (
      !message.seqno ||
      (message.seqno && roomMatch.seqno && roomMatch.seqno > message.seqno)
    ) {
      for (const reaction of Object.keys(message.reactions)) {
        const reactionMatches = filter(sogsMutationCache, {
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
              window.log.info(
                'SOGS Mutation Cache: Added our reaction based on the cache',
                updatedReactions[reaction]
              );
              break;
            case 'REMOVE':
              updatedReactions[reaction].you = false;
              updatedReactions[reaction].count -= 1;
              window.log.info(
                'SOGS Mutation Cache: Removed our reaction based on the cache',
                updatedReactions[reaction]
              );
              break;
            default:
              window.log.warn(
                'SOGS Mutation Cache: Unsupported metadata action in OpenGroupMessageV4',
                reactionMatch
              );
          }
        }
      }
    }
  }

  const removedMatches = remove(sogsMutationCache, ...roomMatches);
  if (removedMatches?.length) {
    window.log.info('SOGS Mutation Cache: Removed processed entries from cache!', removedMatches);
  }

  message.reactions = updatedReactions;
  await Reactions.handleOpenGroupMessageReactions(message.reactions, message.id);
  return message;
}
