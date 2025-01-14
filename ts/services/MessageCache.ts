// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { throttle } from 'lodash';
import { LRUCache } from 'lru-cache';

import * as log from '../logging/log';
import { MessageModel } from '../models/messages';
import { DataReader, DataWriter } from '../sql/Client';
import { getMessageConversation } from '../util/getMessageConversation';
import { getSenderIdentifier } from '../util/getSenderIdentifier';
import { isNotNil } from '../util/isNotNil';
import { isStory } from '../messages/helpers';
import { getStoryDataFromMessageAttributes } from './storyLoader';
import { postSaveUpdates } from '../util/cleanup';

import type { MessageAttributesType } from '../model-types.d';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import type { StoredJob } from '../jobs/types';

const MAX_THROTTLED_REDUX_UPDATERS = 200;
export class MessageCache {
  static install(): MessageCache {
    const instance = new MessageCache();
    window.MessageCache = instance;
    return instance;
  }

  #state = {
    messages: new Map<string, MessageModel>(),
    messageIdsBySender: new Map<string, string>(),
    messageIdsBySentAt: new Map<number, Array<string>>(),
    lastAccessedAt: new Map<string, number>(),
  };

  public saveMessage(
    message: MessageAttributesType | MessageModel,
    options?: {
      forceSave?: boolean;
      jobToInsert?: Readonly<StoredJob>;
    }
  ): Promise<string> {
    const attributes =
      message instanceof MessageModel ? message.attributes : message;

    return DataWriter.saveMessage(attributes, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
      postSaveUpdates,
      ...options,
    });
  }

  public register(message: MessageModel): MessageModel {
    if (!message || !message.id) {
      throw new Error('MessageCache.register: Got falsey id or message');
    }

    const existing = this.getById(message.id);
    if (existing) {
      return existing;
    }

    this.#addMessageToCache(message);

    return message;
  }

  // Finds a message in the cache by sender identifier
  public findBySender(senderIdentifier: string): MessageModel | undefined {
    const id = this.#state.messageIdsBySender.get(senderIdentifier);
    if (!id) {
      return undefined;
    }

    return this.getById(id);
  }

  // Finds a message in the cache by Id
  public getById(id: string): MessageModel | undefined {
    const message = this.#state.messages.get(id);
    if (!message) {
      return undefined;
    }

    this.#state.lastAccessedAt.set(id, Date.now());

    return message;
  }

  // Finds a message in the cache by sentAt/timestamp
  public async findBySentAt(
    sentAt: number,
    predicate: (model: MessageModel) => boolean
  ): Promise<MessageModel | undefined> {
    const items = this.#state.messageIdsBySentAt.get(sentAt) ?? [];
    const inMemory = items
      .map(id => this.getById(id))
      .filter(isNotNil)
      .find(predicate);

    if (inMemory != null) {
      return inMemory;
    }

    log.info(`findBySentAt(${sentAt}): db lookup needed`);
    const allOnDisk = await DataReader.getMessagesBySentAt(sentAt);
    const onDisk = allOnDisk
      .map(message => this.register(new MessageModel(message)))
      .find(predicate);

    return onDisk;
  }

  // Deletes the message from our cache
  public unregister(id: string): void {
    const message = this.#state.messages.get(id);
    if (!message) {
      return;
    }

    this.#removeMessage(id);
  }

  // Evicts messages from the message cache if they have not been accessed past
  // the expiry time.
  public deleteExpiredMessages(expiryTime: number): void {
    const now = Date.now();

    for (const [messageId, message] of this.#state.messages) {
      const timeLastAccessed = this.#state.lastAccessedAt.get(messageId) ?? 0;
      const conversation = getMessageConversation(message.attributes);

      const state = window.reduxStore.getState();
      const selectedId = state?.conversations?.selectedConversationId;
      const inActiveConversation =
        conversation && selectedId && conversation.id === selectedId;

      if (now - timeLastAccessed > expiryTime && !inActiveConversation) {
        this.unregister(messageId);
      }
    }
  }

  public async upgradeSchema(
    message: MessageModel,
    minSchemaVersion: number
  ): Promise<void> {
    const { schemaVersion } = message.attributes;
    if (!schemaVersion || schemaVersion >= minSchemaVersion) {
      return;
    }
    const startingAttributes = message.attributes;
    const upgradedAttributes =
      await window.Signal.Migrations.upgradeMessageSchema(startingAttributes);
    if (startingAttributes !== upgradedAttributes) {
      message.set(upgradedAttributes);
    }
  }

  public replaceAllObsoleteConversationIds({
    conversationId,
    obsoleteId,
  }: {
    conversationId: string;
    obsoleteId: string;
  }): void {
    const updateSendState = (
      sendState?: SendStateByConversationId
    ): SendStateByConversationId | undefined => {
      if (!sendState?.[obsoleteId]) {
        return sendState;
      }
      const { [obsoleteId]: obsoleteSendState, ...rest } = sendState;
      return {
        [conversationId]: obsoleteSendState,
        ...rest,
      };
    };

    for (const [, message] of this.#state.messages) {
      if (message.get('conversationId') !== obsoleteId) {
        continue;
      }

      const editHistory = message.get('editHistory')?.map(history => {
        return {
          ...history,
          sendStateByConversationId: updateSendState(
            history.sendStateByConversationId
          ),
        };
      });

      message.set({
        conversationId,
        sendStateByConversationId: updateSendState(
          message.get('sendStateByConversationId')
        ),
        editHistory,
      });
    }
  }

  // Semi-public API

  // Should only be called by MessageModel's set() function
  public _updateCaches(message: MessageModel): undefined {
    const existing = this.getById(message.id);

    // If this model hasn't been registered yet, we can't add to cache because we don't
    //   want to force `message` to be the primary MessageModel for this message.
    if (!existing) {
      return;
    }

    this.#state.messageIdsBySender.delete(
      getSenderIdentifier(message.attributes)
    );

    const { id, sent_at: sentAt } = message.attributes;
    const previousIdsBySentAt = this.#state.messageIdsBySentAt.get(sentAt);

    let nextIdsBySentAtSet: Set<string>;
    if (previousIdsBySentAt) {
      nextIdsBySentAtSet = new Set(previousIdsBySentAt);
      nextIdsBySentAtSet.add(id);
    } else {
      nextIdsBySentAtSet = new Set([id]);
    }

    this.#state.lastAccessedAt.set(id, Date.now());
    this.#state.messageIdsBySender.set(
      getSenderIdentifier(message.attributes),
      id
    );

    this.#throttledUpdateRedux(message.attributes);
  }

  // Helpers

  #addMessageToCache(message: MessageModel): void {
    if (!message.id) {
      return;
    }

    if (this.#state.messages.has(message.id)) {
      this.#state.lastAccessedAt.set(message.id, Date.now());
      return;
    }

    const { id, sent_at: sentAt } = message.attributes;
    const previousIdsBySentAt = this.#state.messageIdsBySentAt.get(sentAt);

    let nextIdsBySentAtSet: Set<string>;
    if (previousIdsBySentAt) {
      nextIdsBySentAtSet = new Set(previousIdsBySentAt);
      nextIdsBySentAtSet.add(id);
    } else {
      nextIdsBySentAtSet = new Set([id]);
    }

    this.#state.messages.set(message.id, message);
    this.#state.lastAccessedAt.set(message.id, Date.now());
    this.#state.messageIdsBySentAt.set(sentAt, Array.from(nextIdsBySentAtSet));
    this.#state.messageIdsBySender.set(
      getSenderIdentifier(message.attributes),
      id
    );
  }

  #removeMessage(messageId: string): void {
    const message = this.#state.messages.get(messageId);
    if (!message) {
      return;
    }

    const { id, sent_at: sentAt } = message.attributes;
    const nextIdsBySentAtSet =
      new Set(this.#state.messageIdsBySentAt.get(sentAt)) || new Set();

    nextIdsBySentAtSet.delete(id);

    if (nextIdsBySentAtSet.size) {
      this.#state.messageIdsBySentAt.set(
        sentAt,
        Array.from(nextIdsBySentAtSet)
      );
    } else {
      this.#state.messageIdsBySentAt.delete(sentAt);
    }

    this.#state.messages.delete(messageId);
    this.#state.lastAccessedAt.delete(messageId);
    this.#state.messageIdsBySender.delete(
      getSenderIdentifier(message.attributes)
    );
  }

  #updateRedux(attributes: MessageAttributesType) {
    if (!window.reduxActions) {
      return;
    }
    if (isStory(attributes)) {
      const storyData = getStoryDataFromMessageAttributes({
        ...attributes,
      });

      if (!storyData) {
        return;
      }

      window.reduxActions.stories.storyChanged(storyData);

      // We don't want messageChanged to run
      return;
    }

    window.reduxActions.conversations.messageChanged(
      attributes.id,
      attributes.conversationId,
      attributes
    );
  }

  #throttledReduxUpdaters = new LRUCache<
    string,
    (attributes: MessageAttributesType) => void
  >({
    max: MAX_THROTTLED_REDUX_UPDATERS,
  });

  #throttledUpdateRedux(attributes: MessageAttributesType) {
    let updater = this.#throttledReduxUpdaters.get(attributes.id);
    if (!updater) {
      updater = throttle(this.#updateRedux.bind(this), 200, {
        leading: true,
        trailing: true,
      });
      this.#throttledReduxUpdaters.set(attributes.id, updater);
    }

    updater(attributes);
  }
}
