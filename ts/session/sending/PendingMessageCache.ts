import { createOrUpdateItem, getItemById } from '../../../js/modules/data';
import { RawMessage } from '../types/RawMessage';
import { ContentMessage } from '../messages/outgoing';
import { PubKey } from '../types';
import * as MessageUtils from '../utils';

// This is an abstraction for storing pending messages.
// Ideally we want to store pending messages in the database so that
// on next launch we can re-send the pending messages, but we don't want
// to constantly fetch pending messages from the database.
// Thus we have an intermediary cache which will store pending messagesin
// memory and sync its state with the database on modification (add or remove).

export class PendingMessageCache {
  public readonly isReady: Promise<boolean>;
  private cache: Array<any>;

  constructor() {
    // Load pending messages from the database
    // You should await isReady on making a new PendingMessageCache
    //   if you'd like to have instant access to the cache
    this.cache = ['bleep'];

    this.isReady = new Promise(async resolve => {
      await this.loadFromDB();
      resolve(true);
    });
  }

  public getAllPending(): Array<RawMessage> {
    // Get all pending from cache, sorted with oldest first
    return [...this.cache].sort((a, b) => a.timestamp - b.timestamp);
  }

  public getForDevice(device: PubKey): Array<RawMessage> {
    const pending = this.cache.filter(m => m.device === device.key);

    return pending.sort((a, b) => a.timestamp - b.timestamp);
  }

  public getDevices(): Array<PubKey> {
    // Gets all unique devices with pending messages
    const pubkeyStrings = [...new Set(this.cache.map(m => m.device))];

    const pubkeys: Array<PubKey> = [];
    pubkeyStrings.forEach(pubkey => {
      if (PubKey.validate(pubkey)) {
        pubkeys.push(new PubKey(pubkey));
      }
    });

    return pubkeys;
  }

  public async add(
    device: PubKey,
    message: ContentMessage
  ): Promise<RawMessage> {
    const rawMessage = MessageUtils.toRawMessage(device, message);

    // Does it exist in cache already?
    if (this.find(rawMessage)) {
      return rawMessage;
    }

    this.cache.push(rawMessage);
    await this.saveToDB();

    return rawMessage;
  }

  public async remove(
    message: RawMessage
  ): Promise<Array<RawMessage> | undefined> {
    // Should only be called after message is processed

    // Return if message doesn't exist in cache
    if (!this.find(message)) {
      return;
    }

    // Remove item from cache and sync with database
    const updatedCache = this.cache.filter(
      m => m.identifier !== message.identifier
    );
    this.cache = updatedCache;
    await this.saveToDB();

    return updatedCache;
  }

  public find(message: RawMessage): RawMessage | undefined {
    // Find a message in the cache
    return this.cache.find(
      m => m.device === message.device && m.timestamp === message.timestamp
    );
  }

  public async clear() {
    // Clears the cache and syncs to DB
    this.cache = [];
    await this.saveToDB();
  }

  public async loadFromDB() {
    const messages = await this.getFromStorage();
    this.cache = messages;
  }

  private async getFromStorage(): Promise<Array<RawMessage>> {
    const data = await getItemById('pendingMessages');
    if (!data || !data.value) {
      return [];
    }

    const barePending = JSON.parse(String(data.value));

    const pending = barePending.map((message: any) => {
      const { identifier, plainTextBuffer, timestamp, device, ttl, encryption } = message;

      return {
        identifier,
        plainTextBuffer,
        timestamp,
        device,
        ttl,
        encryption,
      } as RawMessage;
    });

    return pending as Array<RawMessage>;
  }

  private async saveToDB() {
    // Only call when adding / removing from cache.
    const encodedPendingMessages = JSON.stringify(this.cache) || '[]';
    await createOrUpdateItem({
      id: 'pendingMessages',
      value: encodedPendingMessages,
    });
  }
}
