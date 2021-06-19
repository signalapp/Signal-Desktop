// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MessageModel } from '../models/messages';

const SECOND = 1000;
const MINUTE = SECOND * 60;
const FIVE_MINUTES = MINUTE * 5;
const HOUR = MINUTE * 60;

type LookupItemType = {
  timestamp: number;
  message: MessageModel;
};
type LookupType = Record<string, LookupItemType>;

export class MessageController {
  private messageLookup: LookupType = Object.create(null);

  private msgIDsBySender = new Map<string, string>();

  private msgIDsBySentAt = new Map<number, string>();

  static install(): MessageController {
    const instance = new MessageController();
    window.MessageController = instance;

    instance.startCleanupInterval();
    return instance;
  }

  register(id: string, message: MessageModel): MessageModel {
    if (!id || !message) {
      return message;
    }

    const existing = this.messageLookup[id];
    if (existing) {
      this.messageLookup[id] = {
        message: existing.message,
        timestamp: Date.now(),
      };
      return existing.message;
    }

    this.messageLookup[id] = {
      message,
      timestamp: Date.now(),
    };

    this.msgIDsBySentAt.set(message.get('sent_at'), id);
    this.msgIDsBySender.set(message.getSenderIdentifier(), id);

    return message;
  }

  unregister(id: string): void {
    const { message } = this.messageLookup[id] || {};
    if (message) {
      this.msgIDsBySender.delete(message.getSenderIdentifier());
      this.msgIDsBySentAt.delete(message.get('sent_at'));
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

  findBySentAt(sentAt: number): MessageModel | undefined {
    const id = this.msgIDsBySentAt.get(sentAt);
    if (!id) {
      return undefined;
    }
    return this.getById(id);
  }

  findBySender(sender: string): MessageModel | undefined {
    const id = this.msgIDsBySender.get(sender);
    if (!id) {
      return undefined;
    }
    return this.getById(id);
  }

  _get(): LookupType {
    return this.messageLookup;
  }

  startCleanupInterval(): NodeJS.Timeout | number {
    return setInterval(this.cleanup.bind(this), HOUR);
  }
}
