// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import cloneDeep from 'lodash/cloneDeep';
import { throttle } from 'lodash';
import LRU from 'lru-cache';
import type {
  MessageAttributesType,
  ReadonlyMessageAttributesType,
} from '../model-types.d';
import type { MessageModel } from '../models/messages';
import { DataReader, DataWriter } from '../sql/Client';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { getEnvironment, Environment } from '../environment';
import { getMessageConversation } from '../util/getMessageConversation';
import { getMessageModelLogger } from '../util/MessageModelLogger';
import { getSenderIdentifier } from '../util/getSenderIdentifier';
import { isNotNil } from '../util/isNotNil';
import { softAssert, strictAssert } from '../util/assert';
import { isStory } from '../messages/helpers';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import { getStoryDataFromMessageAttributes } from './storyLoader';

const MAX_THROTTLED_REDUX_UPDATERS = 200;
export class MessageCache {
  private state = {
    messages: new Map<string, MessageAttributesType>(),
    messageIdsBySender: new Map<string, string>(),
    messageIdsBySentAt: new Map<number, Array<string>>(),
    lastAccessedAt: new Map<string, number>(),
  };

  // Stores the models so that __DEPRECATED$register always returns the existing
  // copy instead of a new model.
  private modelCache = new Map<string, MessageModel>();

  // Synchronously access a message's attributes from internal cache. Will
  // return undefined if the message does not exist in memory.
  public accessAttributes(
    messageId: string
  ): Readonly<MessageAttributesType> | undefined {
    const messageAttributes = this.state.messages.get(messageId);
    return messageAttributes
      ? this.freezeAttributes(messageAttributes)
      : undefined;
  }

  // Synchronously access a message's attributes from internal cache. Throws
  // if the message does not exist in memory.
  public accessAttributesOrThrow(
    source: string,
    messageId: string
  ): Readonly<MessageAttributesType> {
    const messageAttributes = this.accessAttributes(messageId);
    strictAssert(
      messageAttributes,
      `MessageCache.accessAttributesOrThrow/${source}: no message for id ${messageId}`
    );
    return messageAttributes;
  }

  // Evicts messages from the message cache if they have not been accessed past
  // the expiry time.
  public deleteExpiredMessages(expiryTime: number): void {
    const now = Date.now();

    for (const [messageId, messageAttributes] of this.state.messages) {
      const timeLastAccessed = this.state.lastAccessedAt.get(messageId) ?? 0;
      const conversation = getMessageConversation(messageAttributes);

      const state = window.reduxStore.getState();
      const selectedId = state?.conversations?.selectedConversationId;
      const inActiveConversation =
        conversation && selectedId && conversation.id === selectedId;

      if (now - timeLastAccessed > expiryTime && !inActiveConversation) {
        this.__DEPRECATED$unregister(messageId);
      }
    }
  }

  // Finds a message in the cache by sender identifier
  public findBySender(
    senderIdentifier: string
  ): Readonly<MessageAttributesType> | undefined {
    const id = this.state.messageIdsBySender.get(senderIdentifier);
    if (!id) {
      return undefined;
    }

    return this.accessAttributes(id);
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

    for (const [messageId, messageAttributes] of this.state.messages) {
      if (messageAttributes.conversationId !== obsoleteId) {
        continue;
      }

      const editHistory = messageAttributes.editHistory?.map(history => {
        return {
          ...history,
          sendStateByConversationId: updateSendState(
            history.sendStateByConversationId
          ),
        };
      });

      this.setAttributes({
        messageId,
        messageAttributes: {
          conversationId,
          sendStateByConversationId: updateSendState(
            messageAttributes.sendStateByConversationId
          ),
          editHistory,
        },
        skipSaveToDatabase: true,
      });
    }
  }

  // Find the message's attributes whether in memory or in the database.
  // Refresh the attributes in the cache if they exist. Throw if we cannot find
  // a matching message.
  public async resolveAttributes(
    source: string,
    messageId: string
  ): Promise<Readonly<MessageAttributesType>> {
    const inMemoryMessageAttributes = this.accessAttributes(messageId);

    if (inMemoryMessageAttributes) {
      return inMemoryMessageAttributes;
    }

    let messageAttributesFromDatabase: MessageAttributesType | undefined;
    try {
      messageAttributesFromDatabase =
        await DataReader.getMessageById(messageId);
    } catch (err: unknown) {
      log.error(
        `MessageCache.resolveAttributes(${messageId}): db error ${Errors.toLogFormat(
          err
        )}`
      );
    }

    strictAssert(
      messageAttributesFromDatabase,
      `MessageCache.resolveAttributes/${source}: no message for id ${messageId}`
    );

    return this.freezeAttributes(messageAttributesFromDatabase);
  }

  // Updates a message's attributes and saves the message to cache and to the
  // database. Option to skip the save to the database.

  // Overload #1: if skipSaveToDatabase = true, returns void
  public setAttributes({
    messageId,
    messageAttributes,
    skipSaveToDatabase,
  }: {
    messageId: string;
    messageAttributes: Partial<MessageAttributesType>;
    skipSaveToDatabase: true;
  }): void;

  // Overload #2: if skipSaveToDatabase = false, returns DB save promise
  public setAttributes({
    messageId,
    messageAttributes,
    skipSaveToDatabase,
  }: {
    messageId: string;
    messageAttributes: Partial<MessageAttributesType>;
    skipSaveToDatabase: false;
  }): Promise<string>;

  // Implementation
  public setAttributes({
    messageId,
    messageAttributes: partialMessageAttributes,
    skipSaveToDatabase,
  }: {
    messageId: string;
    messageAttributes: Partial<MessageAttributesType>;
    skipSaveToDatabase: boolean;
  }): Promise<string> | undefined {
    let messageAttributes = this.accessAttributes(messageId);

    softAssert(messageAttributes, 'could not find message attributes');
    if (!messageAttributes) {
      // We expect message attributes to be defined in cache if one is trying to
      // set new attributes. In the case that the attributes are missing in cache
      // we'll add whatever we currently have to cache as a defensive measure so
      // that the code continues to work properly downstream. The softAssert above
      // that logs/debugger should be addressed upstream immediately by ensuring
      // that message is in cache.
      const partiallyCachedMessage = {
        id: messageId,
        ...partialMessageAttributes,
      } as MessageAttributesType;

      this.addMessageToCache(partiallyCachedMessage);
      messageAttributes = partiallyCachedMessage;
    }

    this.state.messageIdsBySender.delete(
      getSenderIdentifier(messageAttributes)
    );

    const nextMessageAttributes = {
      ...messageAttributes,
      ...partialMessageAttributes,
    };

    const { id, sent_at: sentAt } = nextMessageAttributes;
    const previousIdsBySentAt = this.state.messageIdsBySentAt.get(sentAt);

    let nextIdsBySentAtSet: Set<string>;
    if (previousIdsBySentAt) {
      nextIdsBySentAtSet = new Set(previousIdsBySentAt);
      nextIdsBySentAtSet.add(id);
    } else {
      nextIdsBySentAtSet = new Set([id]);
    }

    this.state.messages.set(id, nextMessageAttributes);
    this.state.lastAccessedAt.set(id, Date.now());
    this.state.messageIdsBySender.set(
      getSenderIdentifier(messageAttributes),
      id
    );

    this.markModelStale(nextMessageAttributes);

    this.throttledUpdateRedux(nextMessageAttributes);

    if (skipSaveToDatabase) {
      return;
    }

    return DataWriter.saveMessage(nextMessageAttributes, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  }

  private throttledReduxUpdaters = new LRU<string, typeof this.updateRedux>({
    max: MAX_THROTTLED_REDUX_UPDATERS,
  });

  private throttledUpdateRedux(attributes: MessageAttributesType) {
    let updater = this.throttledReduxUpdaters.get(attributes.id);
    if (!updater) {
      updater = throttle(this.updateRedux.bind(this), 200, {
        leading: true,
        trailing: true,
      });
      this.throttledReduxUpdaters.set(attributes.id, updater);
    }

    updater(attributes);
  }

  private updateRedux(attributes: MessageAttributesType) {
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

  // When you already have the message attributes from the db and want to
  // ensure that they're added to the cache. The latest attributes from cache
  // are returned if they exist, if not the attributes passed in are returned.
  public toMessageAttributes(
    messageAttributes: MessageAttributesType
  ): Readonly<MessageAttributesType> {
    this.addMessageToCache(messageAttributes);

    const nextMessageAttributes = this.state.messages.get(messageAttributes.id);
    strictAssert(
      nextMessageAttributes,
      `MessageCache.toMessageAttributes: no message for id ${messageAttributes.id}`
    );

    if (getEnvironment() === Environment.Development) {
      return Object.freeze(cloneDeep(nextMessageAttributes));
    }
    return nextMessageAttributes;
  }

  static install(): MessageCache {
    const instance = new MessageCache();
    window.MessageCache = instance;
    return instance;
  }

  private addMessageToCache(messageAttributes: MessageAttributesType): void {
    if (!messageAttributes.id) {
      return;
    }

    if (this.state.messages.has(messageAttributes.id)) {
      this.state.lastAccessedAt.set(messageAttributes.id, Date.now());
      return;
    }

    const { id, sent_at: sentAt } = messageAttributes;
    const previousIdsBySentAt = this.state.messageIdsBySentAt.get(sentAt);

    let nextIdsBySentAtSet: Set<string>;
    if (previousIdsBySentAt) {
      nextIdsBySentAtSet = new Set(previousIdsBySentAt);
      nextIdsBySentAtSet.add(id);
    } else {
      nextIdsBySentAtSet = new Set([id]);
    }

    this.state.messages.set(messageAttributes.id, { ...messageAttributes });
    this.state.lastAccessedAt.set(messageAttributes.id, Date.now());
    this.state.messageIdsBySentAt.set(sentAt, Array.from(nextIdsBySentAtSet));
    this.state.messageIdsBySender.set(
      getSenderIdentifier(messageAttributes),
      id
    );
  }

  private freezeAttributes(
    messageAttributes: MessageAttributesType
  ): Readonly<MessageAttributesType> {
    this.addMessageToCache(messageAttributes);

    if (getEnvironment() === Environment.Development) {
      return Object.freeze(cloneDeep(messageAttributes));
    }
    return messageAttributes;
  }

  private removeMessage(messageId: string): void {
    const messageAttributes = this.state.messages.get(messageId);
    if (!messageAttributes) {
      return;
    }

    const { id, sent_at: sentAt } = messageAttributes;
    const nextIdsBySentAtSet =
      new Set(this.state.messageIdsBySentAt.get(sentAt)) || new Set();

    nextIdsBySentAtSet.delete(id);

    if (nextIdsBySentAtSet.size) {
      this.state.messageIdsBySentAt.set(sentAt, Array.from(nextIdsBySentAtSet));
    } else {
      this.state.messageIdsBySentAt.delete(sentAt);
    }

    this.state.messages.delete(messageId);
    this.state.lastAccessedAt.delete(messageId);
    this.state.messageIdsBySender.delete(
      getSenderIdentifier(messageAttributes)
    );
  }

  // Deprecated methods below

  // Adds the message into the cache and eturns a Proxy that resembles
  // a MessageModel
  public __DEPRECATED$register(
    id: string,
    data: MessageModel | MessageAttributesType,
    location: string
  ): MessageModel {
    if (!id || !data) {
      throw new Error(
        'MessageCache.__DEPRECATED$register: Got falsey id or message'
      );
    }

    const existing = this.__DEPRECATED$getById(id);

    if (existing) {
      this.addMessageToCache(existing.attributes);
      return existing;
    }

    const modelProxy = this.toModel(data);
    const messageAttributes = 'attributes' in data ? data.attributes : data;
    this.addMessageToCache(messageAttributes);
    modelProxy.registerLocations.add(location);

    return modelProxy;
  }

  // Deletes the message from our cache
  public __DEPRECATED$unregister(id: string): void {
    const model = this.modelCache.get(id);
    if (!model) {
      return;
    }

    this.removeMessage(id);
    this.modelCache.delete(id);
  }

  // Finds a message in the cache by Id
  public __DEPRECATED$getById(id: string): MessageModel | undefined {
    const data = this.state.messages.get(id);
    if (!data) {
      return undefined;
    }

    return this.toModel(data);
  }

  public async upgradeSchema(
    attributes: MessageAttributesType,
    minSchemaVersion: number
  ): Promise<MessageAttributesType> {
    const { schemaVersion } = attributes;
    if (!schemaVersion || schemaVersion >= minSchemaVersion) {
      return attributes;
    }
    const upgradedAttributes =
      await window.Signal.Migrations.upgradeMessageSchema(attributes);
    await this.setAttributes({
      messageId: upgradedAttributes.id,
      messageAttributes: upgradedAttributes,
      skipSaveToDatabase: false,
    });
    return upgradedAttributes;
  }

  // Finds a message in the cache by sentAt/timestamp
  public async findBySentAt(
    sentAt: number,
    predicate: (attributes: ReadonlyMessageAttributesType) => boolean
  ): Promise<MessageAttributesType | undefined> {
    const items = this.state.messageIdsBySentAt.get(sentAt) ?? [];
    const inMemory = items
      .map(id => this.accessAttributes(id))
      .filter(isNotNil)
      .find(predicate);

    if (inMemory != null) {
      return inMemory;
    }

    log.info(`findBySentAt(${sentAt}): db lookup needed`);
    const allOnDisk = await DataReader.getMessagesBySentAt(sentAt);
    const onDisk = allOnDisk.find(predicate);

    if (onDisk != null) {
      this.addMessageToCache(onDisk);
    }
    return onDisk;
  }

  // Marks cached model as "should be stale" to discourage continued use.
  // The model's attributes are directly updated so that the model is in sync
  // with the in-memory attributes.
  private markModelStale(messageAttributes: MessageAttributesType): void {
    const { id } = messageAttributes;
    const model = this.modelCache.get(id);

    if (!model) {
      return;
    }

    model.attributes = { ...messageAttributes };

    if (getEnvironment() === Environment.Development) {
      log.warn('MessageCache: stale model', {
        cid: model.cid,
        locations: Array.from(model.registerLocations).join('+'),
      });
    }
  }

  // Creates a proxy object for MessageModel which logs usage in development
  // so that we're able to migrate off of models
  private toModel(
    messageAttributes: MessageAttributesType | MessageModel
  ): MessageModel {
    const existingModel = this.modelCache.get(messageAttributes.id);

    if (existingModel) {
      return existingModel;
    }

    const model =
      'attributes' in messageAttributes
        ? messageAttributes
        : new window.Whisper.Message(messageAttributes);

    const proxy = getMessageModelLogger(model);

    this.modelCache.set(messageAttributes.id, proxy);

    return proxy;
  }
}
