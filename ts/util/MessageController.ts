// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageModel } from '../models/messages';
import * as durations from './durations';
import * as log from '../logging/log';
import { map, filter } from './iterables';
import { isNotNil } from './isNotNil';
import type { MessageAttributesType } from '../model-types.d';
import { isEnabled } from '../RemoteConfig';

const FIVE_MINUTES = 5 * durations.MINUTE;

type LookupItemType = {
  timestamp: number;
  message: MessageModel;
};
type LookupType = Record<string, LookupItemType>;

export class MessageController {
  private messageLookup: LookupType = Object.create(null);

  private msgIDsBySender = new Map<string, string>();

  private msgIDsBySentAt = new Map<number, Set<string>>();

  static install(): MessageController {
    const instance = new MessageController();
    window.MessageController = instance;

    instance.startCleanupInterval();
    return instance;
  }

  register(
    id: string,
    data: MessageModel | MessageAttributesType
  ): MessageModel {
    if (!id || !data) {
      throw new Error('MessageController.register: Got falsey id or message');
    }

    const existing = this.messageLookup[id];
    if (existing) {
      this.messageLookup[id] = {
        message: existing.message,
        timestamp: Date.now(),
      };
      return existing.message;
    }

    const message =
      'attributes' in data ? data : new window.Whisper.Message(data);
    this.messageLookup[id] = {
      message,
      timestamp: Date.now(),
    };

    const sentAt = message.get('sent_at');
    const previousIdsBySentAt = this.msgIDsBySentAt.get(sentAt);
    if (previousIdsBySentAt) {
      previousIdsBySentAt.add(id);
    } else {
      this.msgIDsBySentAt.set(sentAt, new Set([id]));
    }

    this.msgIDsBySender.set(message.getSenderIdentifier(), id);

    return message;
  }

  unregister(id: string): void {
    const { message } = this.messageLookup[id] || {};
    if (message) {
      this.msgIDsBySender.delete(message.getSenderIdentifier());

      const sentAt = message.get('sent_at');
      const idsBySentAt = this.msgIDsBySentAt.get(sentAt) || new Set();
      idsBySentAt.delete(id);
      if (!idsBySentAt.size) {
        this.msgIDsBySentAt.delete(sentAt);
      }
    }
    delete this.messageLookup[id];
  }

  cleanup(): void {
    const messages = Object.values(this.messageLookup);
    const now = Date.now();

    for (let i = 0, max = messages.length; i < max; i += 1) {
      const { message, timestamp } = messages[i];
      const conversation = message.getConversation();

      const state = window.reduxStore.getState();
      const selectedId = state?.conversations?.selectedConversationId;
      const inActiveConversation =
        conversation && selectedId && conversation.id === selectedId;

      if (now - timestamp > FIVE_MINUTES && !inActiveConversation) {
        this.unregister(message.id);
      }
    }
  }

  getById(id: string): MessageModel | undefined {
    const existing = this.messageLookup[id];
    return existing && existing.message ? existing.message : undefined;
  }

  filterBySentAt(sentAt: number): Iterable<MessageModel> {
    const ids = this.msgIDsBySentAt.get(sentAt) || [];
    const maybeMessages = map(ids, id => this.getById(id));
    return filter(maybeMessages, isNotNil);
  }

  findBySender(sender: string): MessageModel | undefined {
    const id = this.msgIDsBySender.get(sender);
    if (!id) {
      return undefined;
    }
    return this.getById(id);
  }

  update(predicate: (message: MessageModel) => void): void {
    const values = Object.values(this.messageLookup);
    log.info(
      `MessageController.update: About to process ${values.length} messages`
    );
    values.forEach(({ message }) => predicate(message));
  }

  _get(): LookupType {
    return this.messageLookup;
  }

  startCleanupInterval(): NodeJS.Timeout | number {
    return setInterval(
      this.cleanup.bind(this),
      isEnabled('desktop.messageCleanup') ? FIVE_MINUTES : durations.HOUR
    );
  }
}
