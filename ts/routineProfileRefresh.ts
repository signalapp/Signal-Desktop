// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We use `for ... of` to deal with iterables in several places in this file.
/* eslint-disable no-restricted-syntax */

import { isNil, sortBy } from 'lodash';
import PQueue from 'p-queue';

import * as log from './logging/log';
import { assert } from './util/assert';
import { missingCaseError } from './util/missingCaseError';
import { isNormalNumber } from './util/isNormalNumber';
import { take } from './util/iterables';
import { isOlderThan } from './util/timestamp';
import { ConversationModel } from './models/conversations';

const STORAGE_KEY = 'lastAttemptedToRefreshProfilesAt';
const MAX_AGE_TO_BE_CONSIDERED_ACTIVE = 30 * 24 * 60 * 60 * 1000;
const MAX_AGE_TO_BE_CONSIDERED_RECENTLY_REFRESHED = 1 * 24 * 60 * 60 * 1000;
const MAX_CONVERSATIONS_TO_REFRESH = 50;
const MIN_ELAPSED_DURATION_TO_REFRESH_AGAIN = 12 * 3600 * 1000;

// This type is a little stricter than what's on `window.storage`, and only requires what
//   we need for easier testing.
type StorageType = {
  get: (key: string) => unknown;
  put: (key: string, value: unknown) => Promise<void>;
};

export async function routineProfileRefresh({
  allConversations,
  ourConversationId,
  storage,
}: {
  allConversations: Array<ConversationModel>;
  ourConversationId: string;
  storage: StorageType;
}): Promise<void> {
  log.info('routineProfileRefresh: starting');

  if (!hasEnoughTimeElapsedSinceLastRefresh(storage)) {
    log.info('routineProfileRefresh: too soon to refresh. Doing nothing');
    return;
  }

  log.info('routineProfileRefresh: updating last refresh time');
  await storage.put(STORAGE_KEY, Date.now());

  const conversationsToRefresh = getConversationsToRefresh(
    allConversations,
    ourConversationId
  );

  log.info('routineProfileRefresh: starting to refresh conversations');

  let totalCount = 0;
  let successCount = 0;

  async function refreshConversation(
    conversation: ConversationModel
  ): Promise<void> {
    window.log.info(
      `routineProfileRefresh: refreshing profile for ${conversation.idForLogging()}`
    );

    totalCount += 1;
    try {
      await conversation.getProfile(
        conversation.get('uuid'),
        conversation.get('e164')
      );
      window.log.info(
        `routineProfileRefresh: refreshed profile for ${conversation.idForLogging()}`
      );
      successCount += 1;
    } catch (err) {
      window.log.error(
        `routineProfileRefresh: refreshed profile for ${conversation.idForLogging()}`,
        err?.stack || err
      );
    }
  }

  const refreshQueue = new PQueue({ concurrency: 5, timeout: 1000 * 60 * 2 });
  for (const conversation of conversationsToRefresh) {
    refreshQueue.add(() => refreshConversation(conversation));
  }
  await refreshQueue.onIdle();

  log.info(
    `routineProfileRefresh: successfully refreshed ${successCount} out of ${totalCount} conversation(s)`
  );
}

function hasEnoughTimeElapsedSinceLastRefresh(storage: StorageType): boolean {
  const storedValue = storage.get(STORAGE_KEY);

  if (isNil(storedValue)) {
    return true;
  }

  if (isNormalNumber(storedValue)) {
    return isOlderThan(storedValue, MIN_ELAPSED_DURATION_TO_REFRESH_AGAIN);
  }

  assert(
    false,
    `An invalid value was stored in ${STORAGE_KEY}; treating it as nil`
  );
  return true;
}

function getConversationsToRefresh(
  conversations: ReadonlyArray<ConversationModel>,
  ourConversationId: string
): Iterable<ConversationModel> {
  const filteredConversations = getFilteredConversations(
    conversations,
    ourConversationId
  );
  return take(filteredConversations, MAX_CONVERSATIONS_TO_REFRESH);
}

function* getFilteredConversations(
  conversations: ReadonlyArray<ConversationModel>,
  ourConversationId: string
): Iterable<ConversationModel> {
  const sorted = sortBy(conversations, c => c.get('active_at'));

  const conversationIdsSeen = new Set<string>([ourConversationId]);

  for (const conversation of sorted) {
    const type = conversation.get('type');
    switch (type) {
      case 'private':
        if (
          !conversationIdsSeen.has(conversation.id) &&
          isConversationActive(conversation) &&
          !hasRefreshedProfileRecently(conversation)
        ) {
          conversationIdsSeen.add(conversation.id);
          yield conversation;
        }
        break;
      case 'group':
        for (const member of conversation.getMembers()) {
          if (
            !conversationIdsSeen.has(member.id) &&
            !hasRefreshedProfileRecently(member)
          ) {
            conversationIdsSeen.add(member.id);
            yield member;
          }
        }
        break;
      default:
        throw missingCaseError(type);
    }
  }
}

function isConversationActive(
  conversation: Readonly<ConversationModel>
): boolean {
  const activeAt = conversation.get('active_at');
  return (
    isNormalNumber(activeAt) &&
    activeAt + MAX_AGE_TO_BE_CONSIDERED_ACTIVE > Date.now()
  );
}

function hasRefreshedProfileRecently(
  conversation: Readonly<ConversationModel>
): boolean {
  const profileLastFetchedAt = conversation.get('profileLastFetchedAt');
  return (
    isNormalNumber(profileLastFetchedAt) &&
    profileLastFetchedAt + MAX_AGE_TO_BE_CONSIDERED_RECENTLY_REFRESHED >
      Date.now()
  );
}
