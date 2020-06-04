import * as Data from '../../../js/modules/data';
import { RawMessage } from '../types/RawMessage';
import { ChatMessage, ContentMessage } from '../messages/outgoing';
import { MessageUtils, PubKey } from '../utils';

// TODO: We should be able to import functions straight from the db here without going through the window object


// This is an abstraction for storing pending messages.
// Ideally we want to store pending messages in the database so that
// on next launch we can re-send the pending messages, but we don't want
// to constantly fetch pending messages from the database.
// Thus we have an intermediary cache which will store pending messagesin
// memory and sync its state with the database on modification (add or remove).

export class PendingMessageCache {
  public cache: Array<RawMessage>;

  constructor() {
    // Load pending messages from the database
    // You must call init() on this class in order to load from DB.
    //    const pendingMessageCache = new PendingMessageCache();
    //    await pendingMessageCache.init()
    //    >> do stuff
    this.cache = [];
  }

  public async add(device: PubKey, message: ContentMessage): Promise<RawMessage> {
    const rawMessage = MessageUtils.toRawMessage(device, message);

    // Does it exist in cache already?
    if(this.find(rawMessage)) {
      return rawMessage;
    }

    this.cache.push(rawMessage);
    await this.syncCacheWithDB();

    return rawMessage;
  }

  public async remove(message: RawMessage): Promise<Array<RawMessage> | undefined> {
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
    await this.syncCacheWithDB();

    return updatedCache;
  }

  public find(message: RawMessage): RawMessage | undefined {
    // Find a message in the cache
    return this.cache.find(
      m => m.device === message.device && m.timestamp === message.timestamp
    );
  }

  public getForDevice(device: PubKey): Array<RawMessage> {
    return this.cache.filter(m => m.device === device.key);
  }

  public async clear() {
    // Clears the cache and syncs to DB
    this.cache = [];
    await this.syncCacheWithDB();
  }

  public getDevices(): Array<PubKey> {
    // Gets all devices with pending messages
    const pubkeys = [...new Set(this.cache.map(m => m.device))];

    return pubkeys.map(d => PubKey.from(d));
  }

  public async init() {
    const messages = await this.getFromStorage();
    this.cache = messages;
  }

  public async getFromStorage(): Promise<Array<RawMessage>> {
    // tslint:disable-next-line: no-backbone-get-set-outside-model
    const pendingMessagesData = await Data.getItemById('pendingMessages');
    const pendingMessagesJSON = pendingMessagesData
      ? String(pendingMessagesData.value)
      : '';

    // tslint:disable-next-line: no-unnecessary-local-variable
    const encodedPendingMessages = pendingMessagesJSON
      ? JSON.parse(pendingMessagesJSON)
      : [];

    // Set pubkey from string to PubKey.from()

     
    // TODO:
    //    Build up Uint8Array from painTextBuffer in JSON
    return encodedPendingMessages;
  }

  public async syncCacheWithDB() {
    // Only call when adding / removing from cache.
    const encodedPendingMessages = JSON.stringify(this.cache) || '';
    await Data.createOrUpdateItem({id: 'pendingMessages', value: encodedPendingMessages});
  }

}