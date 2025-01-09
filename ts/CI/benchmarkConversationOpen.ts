// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as uuid } from 'uuid';

import { incrementMessageCounter } from '../util/incrementMessageCounter';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SendStatus } from '../messages/MessageSendState';
import { DataWriter } from '../sql/Client';
import { BodyRange } from '../types/BodyRange';
import { strictAssert } from '../util/assert';
import { MINUTE } from '../util/durations';
import { isOlderThan } from '../util/timestamp';
import { sleep } from '../util/sleep';
import { stats } from '../util/benchmark/stats';
import type { StatsType } from '../util/benchmark/stats';
import type { MessageAttributesType } from '../model-types.d';
import * as log from '../logging/log';
import { postSaveUpdates } from '../util/cleanup';

const BUFFER_DELAY_MS = 50;

type PopulateConversationArgsType = {
  conversationId: string;
  messageCount: number;
  unreadCount?: number;
  customizeMessage?: (
    idx: number,
    baseMessage: MessageAttributesType
  ) => MessageAttributesType;
};

export async function populateConversationWithMessages({
  conversationId,
  messageCount,
  unreadCount = 0,
  customizeMessage,
}: PopulateConversationArgsType): Promise<void> {
  strictAssert(
    window.SignalCI,
    'CI not enabled; ensure this is a staging build'
  );
  const logId = 'benchmarkConversationOpen/populateConversationWithMessages';
  log.info(`${logId}: populating conversation`);

  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const conversation = window.ConversationController.get(conversationId);

  strictAssert(
    conversation,
    `Conversation with id [${conversationId}] not found`
  );

  log.info(`${logId}: destroying all messages in ${conversationId}`);
  await conversation.destroyMessages({ source: 'local-delete' });

  log.info(`${logId}: adding ${messageCount} messages to ${conversationId}`);
  let timestamp = Date.now();
  const messages: Array<MessageAttributesType> = [];
  for (let i = 0; i < messageCount; i += 1) {
    const isUnread = messageCount - i <= unreadCount;
    const isIncoming = isUnread || i % 2 === 0;
    const message: MessageAttributesType = {
      body: `Message ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam venenatis nec sapien id porttitor.`,
      bodyRanges: [{ start: 0, length: 7, style: BodyRange.Style.BOLD }],
      attachments: [],
      conversationId,
      id: uuid(),
      type: isIncoming ? 'incoming' : 'outgoing',
      timestamp,
      sent_at: timestamp,
      schemaVersion: window.Signal.Types.Message.CURRENT_SCHEMA_VERSION,
      received_at: incrementMessageCounter(),
      readStatus: isUnread ? ReadStatus.Unread : ReadStatus.Read,
      sourceServiceId: isIncoming
        ? conversation.getCheckedServiceId('CI')
        : ourAci,
      ...(isIncoming
        ? {}
        : {
            sendStateByConversationId: {
              [conversationId]: { status: SendStatus.Sent },
            },
          }),
    };
    messages.push(customizeMessage?.(i, message) ?? message);

    timestamp += 1;
  }

  await DataWriter.saveMessages(messages, {
    forceSave: true,
    ourAci,
    postSaveUpdates,
  });

  conversation.set('active_at', Date.now());
  await DataWriter.updateConversation(conversation.attributes);
  log.info(`${logId}: populating conversation complete`);
}

export async function benchmarkConversationOpen({
  conversationId,
  messageCount = 10_000,
  runCount = 50,
  runCountToSkip = 0,
  customizeMessage,
  unreadCount,
  testRunId,
}: Partial<PopulateConversationArgsType> & {
  runCount?: number;
  runCountToSkip?: number;
  testRunId?: string;
} = {}): Promise<{ durations: Array<number>; stats: StatsType }> {
  strictAssert(
    window.SignalCI,
    'CI not enabled; ensure this is a staging build'
  );

  // eslint-disable-next-line no-param-reassign
  conversationId =
    conversationId ||
    window.reduxStore.getState().conversations.selectedConversationId;

  strictAssert(conversationId, 'Must open a conversation for benchmarking');

  const logId = `benchmarkConversationOpen${testRunId ? `/${testRunId}` : ''}`;

  log.info(`${logId}: starting conversation open benchmarks, config:`, {
    conversationId,
    messageCount,
    runCount,
    customMessageMethod: !!customizeMessage,
    unreadCount,
    testRunId,
  });

  await populateConversationWithMessages({
    conversationId,
    messageCount,
    unreadCount,
    customizeMessage,
  });
  log.info(`${logId}: populating conversation complete`);

  const durations: Array<number> = [];
  for (let i = 0; i < runCount; i += 1) {
    // Give some buffer between tests
    // eslint-disable-next-line no-await-in-loop
    await sleep(BUFFER_DELAY_MS);

    log.info(`${logId}: running open test run ${i + 1}/${runCount}`);

    // eslint-disable-next-line no-await-in-loop
    const duration = await timeConversationOpen(conversationId);

    if (i >= runCountToSkip) {
      durations.push(duration);
    }
  }

  const result = {
    durations,
    stats: stats(durations),
  };

  log.info(`${logId}: tests complete, results:`, result);
  return result;
}

async function waitForSelector(
  selector: string,
  timeout = MINUTE
): Promise<Node> {
  const start = Date.now();

  while (!isOlderThan(start, timeout)) {
    const element = window.document.querySelector(selector);
    if (element) {
      return element;
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(BUFFER_DELAY_MS);
  }

  throw new Error('Timed out');
}

async function timeConversationOpen(id: string): Promise<number> {
  strictAssert(
    window.SignalCI,
    'CI not enabled; ensure this is a staging build'
  );

  await showEmptyInbox();

  const element = await waitForSelector(`[data-id="${id}"]`);

  const conversationOpenPromise = window.SignalCI.waitForEvent(
    'conversation:open',
    { ignorePastEvents: true }
  );

  const start = Date.now();

  element.dispatchEvent(new Event('click', { bubbles: true }));
  window.reduxActions.conversations.showConversation({
    conversationId: id,
  });

  await conversationOpenPromise;
  const end = Date.now();

  return end - start;
}

async function showEmptyInbox() {
  strictAssert(
    window.SignalCI,
    'CI not enabled; ensure this is a staging build'
  );
  if (!window.reduxStore.getState().conversations.selectedConversationId) {
    return;
  }
  const promise = window.SignalCI.waitForEvent('empty-inbox:rendered', {
    ignorePastEvents: true,
  });
  window.reduxActions.conversations.showConversation({
    conversationId: undefined,
  });
  return promise;
}
