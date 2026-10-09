// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';

import { createLogger } from '../../logging/log.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import * as Errors from '../../types/errors.std.ts';
import { safeParseUnknown } from '../../util/schemas.std.ts';
import { ConversationDiffer } from '../conversationDiff.std.ts';
import { EventQueue } from '../eventQueue.std.ts';
import {
  setExternalClientMessageListener,
  setMessageNotificationsHandledExternally,
} from '../hooks.std.ts';
import { SentPayloadCache } from '../sentPayloadCache.std.ts';
import { toMessageDTO } from '../messageDto.std.ts';
import type {
  BroadcastEventNameType,
  EventTopicType,
} from '../protocol.std.ts';
import { EventName, EventTopic } from '../protocol.std.ts';
import type { RendererEventsType } from '../rendererChannel.std.ts';
import {
  EVENTS_CHANNEL,
  EVENTS_READY_CHANNEL,
  MAX_EVENTS_PER_BATCH,
  TOPICS_CHANNEL,
  rendererTopicsSchema,
} from '../rendererChannel.std.ts';
import {
  getDtoContext,
  getListedConversation,
} from './serviceHelpers.preload.ts';

// Renderer source of live events. Main says which topics any client wants;
// with none, nothing here runs. Changes are queued, coalesced per object,
// turned into public DTOs at flush time and sent to main in batches.

const log = createLogger('ExternalClientEvents');

const FLUSH_DELAY_MS = 100;
const CONVERSATION_DIFF_DELAY_MS = 250;
const STORE_WAIT_MS = 1000;
// Beyond this the renderer gives up on the backlog and has every client
// resynchronize instead.
const MAX_QUEUED_EVENTS = 5000;
const MAX_REMEMBERED_MESSAGES = 2000;
// Signal caches a new message (an update) shortly before adding it to the
// conversation (the add). Updates to a message this recent that has not been
// announced yet are left for the add, which carries the same data.
const NEW_MESSAGE_WINDOW_MS = 10_000;

type PendingType =
  | Readonly<{ kind: 'message'; message: MessageAttributesType }>
  | Readonly<{ kind: 'removedMessage'; message: MessageAttributesType }>
  | Readonly<{ kind: 'data'; data: Record<string, unknown> }>;

let topics: ReadonlySet<EventTopicType> = new Set();
// When the messages topic last started; anything received since then gets
// its own message.added.
let messagesSince = Infinity;
const queue = new EventQueue<PendingType>(MAX_QUEUED_EVENTS);
const sentMessages = new SentPayloadCache(MAX_REMEMBERED_MESSAGES);
let overflowed = false;
let flushTimer: NodeJS.Timeout | undefined;

const differ = new ConversationDiffer();
let unsubscribeStore: (() => void) | undefined;
let storeWaitTimer: NodeJS.Timeout | undefined;
let diffTimer: NodeJS.Timeout | undefined;

function enqueue(
  key: string,
  event: BroadcastEventNameType,
  pending: PendingType
): void {
  if (overflowed) {
    return;
  }
  if (!queue.push(key, event, pending)) {
    log.warn('event queue full; clients must resynchronize');
    queue.clear();
    overflowed = true;
  }
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

function flush(): void {
  flushTimer = undefined;
  try {
    if (overflowed) {
      overflowed = false;
      ipc.send(EVENTS_CHANNEL, {
        events: [],
        overflow: true,
      } satisfies RendererEventsType);
      return;
    }

    const context = getDtoContext();
    const events: RendererEventsType['events'] = [];
    for (const { key, event, data } of queue.take(MAX_EVENTS_PER_BATCH)) {
      const built = build(data, context);
      if (!built) {
        continue;
      }
      if (event === EventName.MessageRemoved) {
        sentMessages.forget(key);
      } else if (data.kind === 'message') {
        if (
          event === EventName.MessageUpdated &&
          isUnannouncedNewMessage(key, data.message)
        ) {
          continue;
        }
        const changed = sentMessages.record(key, JSON.stringify(built));
        if (event === EventName.MessageUpdated && !changed) {
          continue;
        }
      }
      events.push({ event, data: built });
    }
    if (events.length > 0) {
      ipc.send(EVENTS_CHANNEL, { events } satisfies RendererEventsType);
    }
  } catch (error) {
    log.error('flush failed', Errors.toLogFormat(error));
  }
  if (queue.size > 0) {
    scheduleFlush();
  }
}

function isUnannouncedNewMessage(
  key: string,
  message: MessageAttributesType
): boolean {
  if (sentMessages.has(key)) {
    return false;
  }
  const receivedAt = message.received_at_ms ?? 0;
  return (
    receivedAt >= messagesSince &&
    receivedAt > Date.now() - NEW_MESSAGE_WINDOW_MS
  );
}

// Messages are converted at flush time, after coalescing, and only if their
// conversation is still one clients can see.
function build(
  pending: PendingType,
  context: ReturnType<typeof getDtoContext>
): Record<string, unknown> | undefined {
  switch (pending.kind) {
    case 'data':
      return pending.data;
    case 'removedMessage': {
      const { id, conversationId } = pending.message;
      if (!getListedConversation(conversationId)) {
        return undefined;
      }
      return { messageId: id, conversationId };
    }
    case 'message': {
      if (!getListedConversation(pending.message.conversationId)) {
        return undefined;
      }
      return toMessageDTO(pending.message, context);
    }
    default:
      throw new Error('Unexpected pending event');
  }
}

// Messages

const messageListener = {
  added: (message: MessageAttributesType) =>
    enqueue(`m:${message.id}`, EventName.MessageAdded, {
      kind: 'message',
      message,
    }),
  updated: (message: MessageAttributesType) =>
    enqueue(`m:${message.id}`, EventName.MessageUpdated, {
      kind: 'message',
      message,
    }),
  removed: (message: MessageAttributesType) =>
    enqueue(`m:${message.id}`, EventName.MessageRemoved, {
      kind: 'removedMessage',
      message,
    }),
};

// Conversations

function getLookup() {
  return window.reduxStore?.getState().conversations.conversationLookup;
}

function startConversations(): void {
  if (unsubscribeStore || storeWaitTimer) {
    return;
  }
  const lookup = getLookup();
  if (!lookup) {
    // Redux is created later in startup than this service.
    storeWaitTimer = setTimeout(() => {
      storeWaitTimer = undefined;
      if (topics.has(EventTopic.Conversations)) {
        startConversations();
      }
    }, STORE_WAIT_MS);
    return;
  }
  // Clients snapshot after subscribing, so the current state is the
  // baseline and produces no events.
  differ.reset(lookup);
  unsubscribeStore = window.reduxStore.subscribe(() => {
    if (!diffTimer) {
      diffTimer = setTimeout(diffConversations, CONVERSATION_DIFF_DELAY_MS);
    }
  });
}

function stopConversations(): void {
  unsubscribeStore?.();
  unsubscribeStore = undefined;
  clearTimeout(storeWaitTimer);
  storeWaitTimer = undefined;
  clearTimeout(diffTimer);
  diffTimer = undefined;
}

function diffConversations(): void {
  diffTimer = undefined;
  const lookup = getLookup();
  if (!lookup || !topics.has(EventTopic.Conversations)) {
    return;
  }
  for (const change of differ.diff(lookup)) {
    if (change.type === 'updated') {
      enqueue(`c:${change.conversation.id}`, EventName.ConversationUpdated, {
        kind: 'data',
        data: change.conversation,
      });
    } else {
      enqueue(`c:${change.conversationId}`, EventName.ConversationRemoved, {
        kind: 'data',
        data: { conversationId: change.conversationId },
      });
    }
  }
}

function setTopics(next: ReadonlySet<EventTopicType>): void {
  topics = next;

  if (topics.has(EventTopic.Messages)) {
    if (messagesSince === Infinity) {
      messagesSince = Date.now();
    }
    setExternalClientMessageListener(messageListener);
  } else {
    messagesSince = Infinity;
    setExternalClientMessageListener(undefined);
  }

  if (topics.has(EventTopic.Conversations)) {
    startConversations();
  } else {
    stopConversations();
  }

  if (topics.size === 0) {
    queue.clear();
    sentMessages.clear();
    overflowed = false;
  }
  log.info(`topics: ${[...topics].join(',') || 'none'}`);
}

export function installExternalClientEvents(): void {
  ipc.on(TOPICS_CHANNEL, (_event, message: unknown) => {
    const parsed = safeParseUnknown(rendererTopicsSchema, message);
    if (!parsed.success) {
      log.warn('dropping malformed topics');
      return;
    }
    setTopics(new Set(parsed.data.topics));
    setMessageNotificationsHandledExternally(parsed.data.notificationsHandled);
  });
  ipc.send(EVENTS_READY_CHANNEL);
}
