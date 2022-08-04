// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNil, sortBy } from 'lodash';
import PQueue from 'p-queue';

import * as log from './logging/log';
import { assert } from './util/assert';
import { sleep } from './util/sleep';
import { missingCaseError } from './util/missingCaseError';
import { isNormalNumber } from './util/isNormalNumber';
import { take } from './util/iterables';
import type { ConversationModel } from './models/conversations';
import type { StorageInterface } from './types/Storage.d';
import * as Errors from './types/errors';
import { getProfile } from './util/getProfile';
import { MINUTE, HOUR, DAY, WEEK, MONTH } from './util/durations';

const STORAGE_KEY = 'lastAttemptedToRefreshProfilesAt';
const MAX_AGE_TO_BE_CONSIDERED_ACTIVE = MONTH;
const MAX_AGE_TO_BE_CONSIDERED_RECENTLY_REFRESHED = DAY;
const MAX_CONVERSATIONS_TO_REFRESH = 50;
const MIN_ELAPSED_DURATION_TO_REFRESH_AGAIN = 12 * HOUR;
const MIN_REFRESH_DELAY = MINUTE;

let idCounter = 1;

export class RoutineProfileRefresher {
  private started = false;
  private id: number;

  constructor(
    private readonly options: {
      getAllConversations: () => ReadonlyArray<ConversationModel>;
      getOurConversationId: () => string | undefined;
      storage: Pick<StorageInterface, 'get' | 'put'>;
    }
  ) {
    // We keep track of how many of these classes we create, because we suspect that
    //   there might be too many...
    idCounter += 1;
    this.id = idCounter;
    log.info(
      `Creating new RoutineProfileRefresher instance with id ${this.id}`
    );
  }

  public async start(): Promise<void> {
    const logId = `RoutineProfileRefresher.start/${this.id}`;

    if (this.started) {
      log.warn(`${logId}: already started!`);
      return;
    }
    this.started = true;

    const { storage, getAllConversations, getOurConversationId } = this.options;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const refreshInMs = timeUntilNextRefresh(storage);

      log.info(`${logId}: waiting for ${refreshInMs}ms`);

      // eslint-disable-next-line no-await-in-loop
      await sleep(refreshInMs);

      const ourConversationId = getOurConversationId();
      if (!ourConversationId) {
        log.warn(`${logId}: missing our conversation id`);

        // eslint-disable-next-line no-await-in-loop
        await sleep(MIN_REFRESH_DELAY);

        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        await routineProfileRefresh({
          allConversations: getAllConversations(),
          ourConversationId,
          storage,
          id: this.id,
        });
      } catch (error) {
        log.error(`${logId}: failure`, Errors.toLogFormat(error));
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await sleep(MIN_REFRESH_DELAY);
      }
    }
  }
}

export async function routineProfileRefresh({
  allConversations,
  ourConversationId,
  storage,
  id,
  // Only for tests
  getProfileFn = getProfile,
}: {
  allConversations: ReadonlyArray<ConversationModel>;
  ourConversationId: string;
  storage: Pick<StorageInterface, 'get' | 'put'>;
  id: number;
  getProfileFn?: typeof getProfile;
}): Promise<void> {
  const logId = `routineProfileRefresh/${id}`;
  log.info(`${logId}: starting`);

  const refreshInMs = timeUntilNextRefresh(storage);
  if (refreshInMs > 0) {
    log.info(`${logId}: too soon to refresh. Doing nothing`);
    return;
  }

  log.info(`${logId}: updating last refresh time`);
  await storage.put(STORAGE_KEY, Date.now());

  const conversationsToRefresh = getConversationsToRefresh(
    allConversations,
    ourConversationId
  );

  log.info(`${logId}: starting to refresh conversations`);

  let totalCount = 0;
  let successCount = 0;

  async function refreshConversation(
    conversation: ConversationModel
  ): Promise<void> {
    log.info(`${logId}: refreshing profile for ${conversation.idForLogging()}`);

    totalCount += 1;
    try {
      await getProfileFn(conversation.get('uuid'), conversation.get('e164'));
      log.info(
        `${logId}: refreshed profile for ${conversation.idForLogging()}`
      );
      successCount += 1;
    } catch (err) {
      log.error(
        `${logId}: refreshed profile for ${conversation.idForLogging()}`,
        err?.stack || err
      );
    }
  }

  const refreshQueue = new PQueue({
    concurrency: 5,
    timeout: MINUTE * 30,
    throwOnTimeout: true,
  });
  for (const conversation of conversationsToRefresh) {
    refreshQueue.add(() => refreshConversation(conversation));
  }
  await refreshQueue.onIdle();

  log.info(
    `${logId}: successfully refreshed ${successCount} out of ${totalCount} conversation(s)`
  );
}

function timeUntilNextRefresh(storage: Pick<StorageInterface, 'get'>): number {
  const storedValue = storage.get(STORAGE_KEY);

  if (isNil(storedValue)) {
    return 0;
  }

  if (isNormalNumber(storedValue)) {
    const planned = storedValue + MIN_ELAPSED_DURATION_TO_REFRESH_AGAIN;
    const now = Date.now();
    return Math.min(Math.max(0, planned - now), WEEK);
  }

  assert(
    false,
    `An invalid value was stored in ${STORAGE_KEY}; treating it as nil`
  );
  return 0;
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
          conversation.hasProfileKeyCredentialExpired() &&
          (conversation.id === ourConversationId ||
            !conversationIdsSeen.has(conversation.id))
        ) {
          conversationIdsSeen.add(conversation.id);
          yield conversation;
          break;
        }

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
