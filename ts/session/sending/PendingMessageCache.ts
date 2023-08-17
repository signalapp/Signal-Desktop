import _ from 'lodash';
import { Data } from '../../data/data';
import { Storage } from '../../util/storage';
import { SnodeNamespaces } from '../apis/snode_api/namespaces';
import { ContentMessage } from '../messages/outgoing';
import { PubKey } from '../types';
import { PartialRawMessage, RawMessage } from '../types/RawMessage';
import { MessageUtils } from '../utils';

// This is an abstraction for storing pending messages.
// Ideally we want to store pending messages in the database so that
// on next launch we can re-send the pending messages, but we don't want
// to constantly fetch pending messages from the database.
// Thus we have an intermediary cache which will store pending messagesin
// memory and sync its state with the database on modification (add or remove).

export class PendingMessageCache {
  public callbacks: Map<string, (message: RawMessage) => Promise<void>> = new Map();

  protected loadPromise: Promise<void> | undefined;
  protected cache: Array<RawMessage> = [];

  public async getAllPending(): Promise<Array<RawMessage>> {
    await this.loadFromDBIfNeeded();
    // Get all pending from cache
    return [...this.cache];
  }

  public async getForDevice(device: PubKey): Promise<Array<RawMessage>> {
    const pending = await this.getAllPending();
    return pending.filter(m => m.device === device.key);
  }

  public async getDevices(): Promise<Array<PubKey>> {
    await this.loadFromDBIfNeeded();

    // Gets all unique devices with pending messages
    const pubkeyStrings = _.uniq(this.cache.map(m => m.device));

    return pubkeyStrings.map(PubKey.from).filter((k): k is PubKey => !!k);
  }

  public async add(
    destinationPubKey: PubKey,
    message: ContentMessage,
    namespace: SnodeNamespaces,
    sentCb?: (message: any) => Promise<void>,
    isGroup = false
  ): Promise<RawMessage> {
    await this.loadFromDBIfNeeded();
    const rawMessage = await MessageUtils.toRawMessage(
      destinationPubKey,
      message,
      namespace,
      isGroup
    );

    // Does it exist in cache already?
    if (this.find(rawMessage)) {
      return rawMessage;
    }

    this.cache.push(rawMessage);
    if (sentCb) {
      this.callbacks.set(rawMessage.identifier, sentCb);
    }
    await this.saveToDB();

    return rawMessage;
  }

  public async remove(message: RawMessage): Promise<Array<RawMessage> | undefined> {
    await this.loadFromDBIfNeeded();
    // Should only be called after message is processed

    // Return if message doesn't exist in cache
    if (!this.find(message)) {
      return undefined;
    }

    // Remove item from cache and sync with database
    const updatedCache = this.cache.filter(
      cached => !(cached.device === message.device && cached.identifier === message.identifier)
    );
    this.cache = updatedCache;
    this.callbacks.delete(message.identifier);
    await this.saveToDB();

    return updatedCache;
  }

  public find(message: RawMessage): RawMessage | undefined {
    // Find a message in the cache
    return this.cache.find(m => m.device === message.device && m.identifier === message.identifier);
  }

  public async clear() {
    // Clears the cache and syncs to DB
    this.cache = [];
    this.callbacks = new Map();
    await this.saveToDB();
  }

  protected async loadFromDBIfNeeded() {
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromDB();
    }

    await this.loadPromise;
  }

  protected async loadFromDB() {
    const messages = await this.getFromStorage();
    this.cache = messages;
  }

  protected async getFromStorage(): Promise<Array<RawMessage>> {
    const data = await Data.getItemById('pendingMessages');
    if (!data || !data.value) {
      return [];
    }

    const barePending = JSON.parse(String(data.value)) as Array<PartialRawMessage>;

    // Rebuild plainTextBuffer
    return barePending.map((message: PartialRawMessage) => {
      return {
        ...message,
        plainTextBuffer: new Uint8Array(message.plainTextBuffer),
      } as RawMessage;
    });
  }

  protected async saveToDB() {
    // For each plainTextBuffer in cache, save in as a simple Array<number> to avoid
    // Node issues with JSON stringifying Buffer without strict typing
    const encodedCache = [...this.cache].map(item => {
      const plainTextBuffer = Array.from(item.plainTextBuffer);

      return { ...item, plainTextBuffer };
    });

    const encodedPendingMessages = JSON.stringify(encodedCache) || '[]';
    await Storage.put('pendingMessages', encodedPendingMessages);
  }
}
