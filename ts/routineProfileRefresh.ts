// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNil, sortBy } from 'lodash';

import * as log from './logging/log';
import { assert } from './util/assert';
import { missingCaseError } from './util/missingCaseError';
import { isNormalNumber } from './util/isNormalNumber';
import { map, take } from './util/iterables';
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
  await Promise.all(
    map(conversationsToRefresh, async (conversation: ConversationModel) => {
      totalCount += 1;
      try {
        await conversation.getProfile(
          conversation.get('uuid'),
          conversation.get('e164')
        );
        successCount += 1;
      } catch (err) {
        window.log.error(
          'routineProfileRefresh: failed to fetch a profile',
          err?.stack || err
        );
      }
    })
  );

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

  // We use a `for` loop (instead of something like `forEach`) because we want to be able
  //   to yield. We use `for ... of` for readability.
  // eslint-disable-next-line no-restricted-syntax
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
        // eslint-disable-next-line no-restricted-syntax
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
