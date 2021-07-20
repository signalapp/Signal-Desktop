// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-bitwise */
/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-syntax */

import { isNumber, map, omit } from 'lodash';
import PQueue from 'p-queue';
import { v4 as getGuid } from 'uuid';
import { connection as WebSocket } from 'websocket';

import {
  DecryptionErrorMessage,
  groupDecrypt,
  PlaintextContent,
  PreKeySignalMessage,
  processSenderKeyDistributionMessage,
  ProtocolAddress,
  PublicKey,
  SealedSenderDecryptionResult,
  sealedSenderDecryptMessage,
  sealedSenderDecryptToUsmc,
  SenderKeyDistributionMessage,
  signalDecrypt,
  signalDecryptPreKey,
  SignalMessage,
  UnidentifiedSenderMessageContent,
} from '@signalapp/signal-client';

import {
  IdentityKeys,
  PreKeys,
  SenderKeys,
  Sessions,
  SignedPreKeys,
} from '../LibSignalStores';
import { verifySignature } from '../Curve';
import { BackOff, FIBONACCI_TIMEOUTS } from '../util/BackOff';
import { assert, strictAssert } from '../util/assert';
import { BatcherType, createBatcher } from '../util/batcher';
import { dropNull } from '../util/dropNull';
import { normalizeUuid } from '../util/normalizeUuid';
import { normalizeNumber } from '../util/normalizeNumber';
import { sleep } from '../util/sleep';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import { Zone } from '../util/Zone';
import { processAttachment, processDataMessage } from './processDataMessage';
import { processSyncMessage } from './processSyncMessage';
import EventTarget, { EventHandler } from './EventTarget';
import { WebAPIType } from './WebAPI';
import utils from './Helpers';
import WebSocketResource, {
  IncomingWebSocketRequest,
  CloseEvent,
} from './WebsocketResources';
import { ConnectTimeoutError } from './Errors';
import * as Bytes from '../Bytes';
import Crypto from './Crypto';
import { deriveMasterKeyFromGroupV1, typedArrayToArrayBuffer } from '../Crypto';
import { ContactBuffer, GroupBuffer } from './ContactsParser';
import { DownloadedAttachmentType } from '../types/Attachment';
import * as MIME from '../types/MIME';
import { SocketStatus } from '../types/SocketStatus';

import { SignalService as Proto } from '../protobuf';

import { UnprocessedType } from '../textsecure.d';
import {
  ProcessedAttachment,
  ProcessedDataMessage,
  ProcessedSyncMessage,
  ProcessedSent,
  ProcessedEnvelope,
} from './Types.d';
import {
  ReconnectEvent,
  EmptyEvent,
  ProgressEvent,
  TypingEvent,
  ErrorEvent,
  DeliveryEvent,
  DecryptionErrorEvent,
  SentEvent,
  ProfileKeyUpdateEvent,
  MessageEvent,
  RetryRequestEvent,
  ReadEvent,
  ConfigurationEvent,
  ViewSyncEvent,
  MessageRequestResponseEvent,
  FetchLatestEvent,
  KeysEvent,
  StickerPackEvent,
  VerifiedEvent,
  ReadSyncEvent,
  ContactEvent,
  ContactSyncEvent,
  GroupEvent,
  GroupSyncEvent,
} from './messageReceiverEvents';

import { deriveGroupFields, MASTER_KEY_LENGTH } from '../groups';

// TODO: remove once we move away from ArrayBuffers
const FIXMEU8 = Uint8Array;

const GROUPV1_ID_LENGTH = 16;
const GROUPV2_ID_LENGTH = 32;
const RETRY_TIMEOUT = 2 * 60 * 1000;

type DecryptedEnvelope = Readonly<
  ProcessedEnvelope & {
    unidentifiedDeliveryReceived?: boolean;
    contentHint?: number;
    groupId?: string;
    usmc?: UnidentifiedSenderMessageContent;
  }
>;

type DecryptResult = Readonly<{
  envelope: DecryptedEnvelope;
  plaintext?: Uint8Array;
}>;

type DecryptSealedSenderResult = Readonly<
  DecryptResult & {
    unsealedPlaintext?: SealedSenderDecryptionResult;
    isBlocked?: boolean;
  }
>;

type InnerDecryptResult = Readonly<
  DecryptResult & {
    isBlocked?: boolean;
  }
>;

type CacheAddItemType = {
  envelope: ProcessedEnvelope;
  data: UnprocessedType;
  request: Pick<IncomingWebSocketRequest, 'respond'>;
};

type LockedStores = {
  readonly sessionStore: Sessions;
  readonly identityKeyStore: IdentityKeys;
  readonly zone?: Zone;
};

enum TaskType {
  Encrypted = 'Encrypted',
  Decrypted = 'Decrypted',
}

class MessageReceiverInner extends EventTarget {
  _onClose?: (code: number, reason: string) => Promise<void>;

  _onWSRClose?: (event: CloseEvent) => void;

  _onError?: (error: Error) => Promise<void>;

  appQueue: PQueue;

  decryptAndCacheBatcher: BatcherType<CacheAddItemType>;

  cacheRemoveBatcher: BatcherType<string>;

  calledClose?: boolean;

  count: number;

  processedCount: number;

  deviceId?: number;

  hasConnected = false;

  incomingQueue: PQueue;

  isEmptied?: boolean;

  number_id?: string;

  password: string;

  encryptedQueue: PQueue;

  decryptedQueue: PQueue;

  retryCachedTimeout: any;

  server: WebAPIType;

  serverTrustRoot: Uint8Array;

  socket?: WebSocket;

  socketStatus = SocketStatus.CLOSED;

  stoppingProcessing?: boolean;

  username: string;

  uuid: string;

  uuid_id?: string;

  wsr?: WebSocketResource;

  private readonly reconnectBackOff = new BackOff(FIBONACCI_TIMEOUTS);

  constructor(
    oldUsername: string,
    username: string,
    password: string,
    options: {
      serverTrustRoot: string;
    }
  ) {
    super();

    this.count = 0;
    this.processedCount = 0;

    this.username = oldUsername;
    this.uuid = username;
    this.password = password;
    this.server = window.WebAPI.connect({
      username: username || oldUsername,
      password,
    });

    if (!options.serverTrustRoot) {
      throw new Error('Server trust root is required!');
    }
    this.serverTrustRoot = Bytes.fromBase64(options.serverTrustRoot);

    this.number_id = oldUsername
      ? utils.unencodeNumber(oldUsername)[0]
      : undefined;
    this.uuid_id = username ? utils.unencodeNumber(username)[0] : undefined;
    this.deviceId =
      username || oldUsername
        ? parseIntOrThrow(
            utils.unencodeNumber(username || oldUsername)[1],
            'MessageReceiver.constructor: username || oldUsername'
          )
        : undefined;

    this.incomingQueue = new PQueue({ concurrency: 1, timeout: 1000 * 60 * 2 });
    this.appQueue = new PQueue({ concurrency: 1, timeout: 1000 * 60 * 2 });

    // All envelopes start in encryptedQueue and progress to decryptedQueue
    this.encryptedQueue = new PQueue({
      concurrency: 1,
      timeout: 1000 * 60 * 2,
    });
    this.decryptedQueue = new PQueue({
      concurrency: 1,
      timeout: 1000 * 60 * 2,
    });

    this.decryptAndCacheBatcher = createBatcher<CacheAddItemType>({
      name: 'MessageReceiver.decryptAndCacheBatcher',
      wait: 75,
      maxSize: 30,
      processBatch: (items: Array<CacheAddItemType>) => {
        // Not returning the promise here because we don't want to stall
        // the batch.
        this.decryptAndCacheBatch(items);
      },
    });
    this.cacheRemoveBatcher = createBatcher<string>({
      name: 'MessageReceiver.cacheRemoveBatcher',
      wait: 75,
      maxSize: 30,
      processBatch: this.cacheRemoveBatch.bind(this),
    });
  }

  async connect(socket?: WebSocket): Promise<void> {
    if (this.calledClose) {
      return;
    }

    // We always process our cache before processing a new websocket message
    this.incomingQueue.add(async () => this.queueAllCached());

    this.count = 0;
    if (this.hasConnected) {
      this.dispatchEvent(new ReconnectEvent());
    }

    this.isEmptied = false;

    this.hasConnected = true;

    if (this.socket && this.socket.connected) {
      this.socket.close();
      this.socket = undefined;
      if (this.wsr) {
        this.wsr.close();
        this.wsr = undefined;
      }
    }
    this.socketStatus = SocketStatus.CONNECTING;

    // initialize the socket and start listening for messages
    try {
      this.socket = socket || (await this.server.getMessageSocket());
    } catch (error) {
      this.socketStatus = SocketStatus.CLOSED;

      if (error instanceof ConnectTimeoutError) {
        await this.onclose(-1, 'Connection timed out');
        return;
      }

      await this.dispatchAndWait(new ErrorEvent(error));
      return;
    }

    this.socketStatus = SocketStatus.OPEN;

    window.log.info('websocket open');
    window.logMessageReceiverConnect();

    if (!this._onClose) {
      this._onClose = this.onclose.bind(this);
    }
    if (!this._onWSRClose) {
      this._onWSRClose = ({ code, reason }: CloseEvent): void => {
        this.onclose(code, reason);
      };
    }
    if (!this._onError) {
      this._onError = this.onerror.bind(this);
    }

    this.socket.on('close', this._onClose);
    this.socket.on('error', this._onError);

    this.wsr = new WebSocketResource(this.socket, {
      handleRequest: this.handleRequest.bind(this),
      keepalive: {
        path: '/v1/keepalive',
        disconnect: true,
      },
    });

    // Because sometimes the socket doesn't properly emit its close event
    if (this._onWSRClose) {
      this.wsr.addEventListener('close', this._onWSRClose);
    }
  }

  async stopProcessing() {
    window.log.info('MessageReceiver: stopProcessing requested');
    this.stoppingProcessing = true;
    return this.close();
  }

  unregisterBatchers() {
    window.log.info('MessageReceiver: unregister batchers');
    this.decryptAndCacheBatcher.unregister();
    this.cacheRemoveBatcher.unregister();
  }

  shutdown() {
    if (this.socket) {
      if (this._onClose) {
        this.socket.removeListener('close', this._onClose);
      }
      if (this._onError) {
        this.socket.removeListener('error', this._onError);
      }

      this.socket = undefined;
    }

    if (this.wsr) {
      if (this._onWSRClose) {
        this.wsr.removeEventListener('close', this._onWSRClose);
      }
      this.wsr = undefined;
    }
  }

  async close() {
    window.log.info('MessageReceiver.close()');
    this.calledClose = true;
    this.socketStatus = SocketStatus.CLOSING;

    // Our WebSocketResource instance will close the socket and emit a 'close' event
    //   if the socket doesn't emit one quickly enough.
    if (this.wsr) {
      this.wsr.close(3000, 'called close');
    }

    this.clearRetryTimeout();

    return this.drain();
  }

  async onerror(error: Error): Promise<void> {
    window.log.error('websocket error', error);
  }

  async dispatchAndWait(event: Event): Promise<void> {
    this.appQueue.add(async () => Promise.all(this.dispatchEvent(event)));
  }

  async onclose(code: number, reason: string): Promise<void> {
    window.log.info(
      'MessageReceiver: websocket closed',
      code,
      reason || '',
      'calledClose:',
      this.calledClose
    );

    this.socketStatus = SocketStatus.CLOSED;

    this.shutdown();

    if (this.calledClose) {
      return;
    }
    if (code === 3000) {
      return;
    }
    if (code === 3001) {
      this.onEmpty();
    }

    const timeout = this.reconnectBackOff.getAndIncrement();

    window.log.info(`MessageReceiver: reconnecting after ${timeout}ms`);
    await sleep(timeout);

    // Try to reconnect (if there is an HTTP error - we'll get an
    // `error` event from `connect()` and hit the secondary retry backoff
    // logic in `ts/background.ts`)
    await this.connect();

    // Successfull reconnect, reset the backoff timeouts
    this.reconnectBackOff.reset();
  }

  checkSocket(): void {
    if (this.wsr) {
      this.wsr.forceKeepAlive();
    }
  }

  handleRequest(request: IncomingWebSocketRequest) {
    // We do the message decryption here, instead of in the ordered pending queue,
    // to avoid exposing the time it took us to process messages through the time-to-ack.

    if (request.path !== '/api/v1/message') {
      window.log.info('got request', request.verb, request.path);
      request.respond(200, 'OK');

      if (request.verb === 'PUT' && request.path === '/api/v1/queue/empty') {
        this.incomingQueue.add(() => {
          this.onEmpty();
        });
      }
      return;
    }

    const job = async () => {
      const headers = request.headers || [];

      if (!request.body) {
        throw new Error(
          'MessageReceiver.handleRequest: request.body was falsey!'
        );
      }

      const plaintext = request.body;

      try {
        const decoded = Proto.Envelope.decode(plaintext);
        const serverTimestamp = normalizeNumber(decoded.serverTimestamp);

        const envelope: ProcessedEnvelope = {
          // Make non-private envelope IDs dashless so they don't get redacted
          //   from logs
          id: getGuid().replace(/-/g, ''),
          receivedAtCounter: window.Signal.Util.incrementMessageCounter(),
          receivedAtDate: Date.now(),
          // Calculate the message age (time on server).
          messageAgeSec: this.calculateMessageAge(headers, serverTimestamp),

          // Proto.Envelope fields
          type: decoded.type,
          source: decoded.source,
          sourceUuid: decoded.sourceUuid
            ? normalizeUuid(
                decoded.sourceUuid,
                'MessageReceiver.handleRequest.sourceUuid'
              )
            : undefined,
          sourceDevice: decoded.sourceDevice,
          timestamp: normalizeNumber(decoded.timestamp),
          legacyMessage: dropNull(decoded.legacyMessage),
          content: dropNull(decoded.content),
          serverGuid: decoded.serverGuid,
          serverTimestamp,
        };

        // After this point, decoding errors are not the server's
        //   fault, and we should handle them gracefully and tell the
        //   user they received an invalid message

        if (envelope.source && this.isBlocked(envelope.source)) {
          request.respond(200, 'OK');
          return;
        }

        if (envelope.sourceUuid && this.isUuidBlocked(envelope.sourceUuid)) {
          request.respond(200, 'OK');
          return;
        }

        this.decryptAndCache(envelope, plaintext, request);
        this.processedCount += 1;
      } catch (e) {
        request.respond(500, 'Bad encrypted websocket message');
        window.log.error(
          'Error handling incoming message:',
          e && e.stack ? e.stack : e
        );
        await this.dispatchAndWait(new ErrorEvent(e));
      }
    };

    this.incomingQueue.add(job);
  }

  calculateMessageAge(
    headers: ReadonlyArray<string>,
    serverTimestamp?: number
  ): number {
    let messageAgeSec = 0; // Default to 0 in case of unreliable parameters.

    if (serverTimestamp) {
      // The 'X-Signal-Timestamp' is usually the last item, so start there.
      let it = headers.length;
      // eslint-disable-next-line no-plusplus
      while (--it >= 0) {
        const match = headers[it].match(/^X-Signal-Timestamp:\s*(\d+)\s*$/);
        if (match && match.length === 2) {
          const timestamp = Number(match[1]);

          // One final sanity check, the timestamp when a message is pulled from
          // the server should be later than when it was pushed.
          if (timestamp > serverTimestamp) {
            messageAgeSec = Math.floor((timestamp - serverTimestamp) / 1000);
          }

          break;
        }
      }
    }

    return messageAgeSec;
  }

  async addToQueue<T>(task: () => Promise<T>, taskType: TaskType): Promise<T> {
    if (taskType === TaskType.Encrypted) {
      this.count += 1;
    }

    const queue =
      taskType === TaskType.Encrypted
        ? this.encryptedQueue
        : this.decryptedQueue;

    try {
      return await queue.add(task);
    } finally {
      this.updateProgress(this.count);
    }
  }

  hasEmptied(): boolean {
    return Boolean(this.isEmptied);
  }

  onEmpty() {
    const emitEmpty = async () => {
      await Promise.all([
        this.decryptAndCacheBatcher.flushAndWait(),
        this.cacheRemoveBatcher.flushAndWait(),
      ]);

      window.log.info("MessageReceiver: emitting 'empty' event");
      this.dispatchEvent(new EmptyEvent());
      this.isEmptied = true;

      this.maybeScheduleRetryTimeout();
    };

    const waitForDecryptedQueue = async () => {
      window.log.info(
        "MessageReceiver: finished processing messages after 'empty', now waiting for application"
      );

      // We don't await here because we don't want this to gate future message processing
      this.appQueue.add(emitEmpty);
    };

    const waitForEncryptedQueue = async () => {
      this.addToQueue(waitForDecryptedQueue, TaskType.Decrypted);
    };

    const waitForIncomingQueue = () => {
      this.addToQueue(waitForEncryptedQueue, TaskType.Encrypted);

      // Note: this.count is used in addToQueue
      // Resetting count so everything from the websocket after this starts at zero
      this.count = 0;
    };

    const waitForCacheAddBatcher = async () => {
      await this.decryptAndCacheBatcher.onIdle();
      this.incomingQueue.add(waitForIncomingQueue);
    };

    waitForCacheAddBatcher();
  }

  async drain() {
    const waitForEncryptedQueue = async () =>
      this.addToQueue(async () => {
        window.log.info('drained');
      }, TaskType.Decrypted);

    const waitForIncomingQueue = async () =>
      this.addToQueue(waitForEncryptedQueue, TaskType.Encrypted);

    return this.incomingQueue.add(waitForIncomingQueue);
  }

  updateProgress(count: number) {
    // count by 10s
    if (count % 10 !== 0) {
      return;
    }
    this.dispatchEvent(new ProgressEvent({ count }));
  }

  async queueAllCached() {
    const items = await this.getAllFromCache();
    const max = items.length;
    for (let i = 0; i < max; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.queueCached(items[i]);
    }
  }

  async queueCached(item: UnprocessedType) {
    window.log.info('MessageReceiver.queueCached', item.id);
    try {
      let envelopePlaintext: Uint8Array;

      if (item.envelope && item.version === 2) {
        envelopePlaintext = Bytes.fromBase64(item.envelope);
      } else if (item.envelope && typeof item.envelope === 'string') {
        envelopePlaintext = Bytes.fromBinary(item.envelope);
      } else {
        throw new Error(
          'MessageReceiver.queueCached: item.envelope was malformed'
        );
      }

      const decoded = Proto.Envelope.decode(envelopePlaintext);

      const envelope: ProcessedEnvelope = {
        id: item.id,
        receivedAtCounter: item.timestamp,
        receivedAtDate: Date.now(),
        messageAgeSec: item.messageAgeSec || 0,

        // Proto.Envelope fields
        type: decoded.type,
        source: decoded.source || item.source,
        sourceUuid: decoded.sourceUuid || item.sourceUuid,
        sourceDevice: decoded.sourceDevice || item.sourceDevice,
        timestamp: normalizeNumber(decoded.timestamp),
        legacyMessage: dropNull(decoded.legacyMessage),
        content: dropNull(decoded.content),
        serverGuid: decoded.serverGuid,
        serverTimestamp: normalizeNumber(
          item.serverTimestamp || decoded.serverTimestamp
        ),
      };

      const { decrypted } = item;
      if (decrypted) {
        let payloadPlaintext: Uint8Array;

        if (item.version === 2) {
          payloadPlaintext = Bytes.fromBase64(decrypted);
        } else if (typeof decrypted === 'string') {
          payloadPlaintext = Bytes.fromBinary(decrypted);
        } else {
          throw new Error('Cached decrypted value was not a string!');
        }

        // Maintain invariant: encrypted queue => decrypted queue
        this.addToQueue(async () => {
          this.queueDecryptedEnvelope(envelope, payloadPlaintext);
        }, TaskType.Encrypted);
      } else {
        this.queueCachedEnvelope(item, envelope);
      }
    } catch (error) {
      window.log.error(
        'queueCached error handling item',
        item.id,
        'removing it. Error:',
        error && error.stack ? error.stack : error
      );

      try {
        const { id } = item;
        await window.textsecure.storage.protocol.removeUnprocessed(id);
      } catch (deleteError) {
        window.log.error(
          'queueCached error deleting item',
          item.id,
          'Error:',
          deleteError && deleteError.stack ? deleteError.stack : deleteError
        );
      }
    }
  }

  getEnvelopeId(envelope: ProcessedEnvelope) {
    const { timestamp } = envelope;

    if (envelope.sourceUuid || envelope.source) {
      const sender = envelope.sourceUuid || envelope.source;
      return `${sender}.${envelope.sourceDevice} ${timestamp} (${envelope.id})`;
    }

    return envelope.id;
  }

  clearRetryTimeout() {
    if (this.retryCachedTimeout) {
      clearInterval(this.retryCachedTimeout);
      this.retryCachedTimeout = null;
    }
  }

  maybeScheduleRetryTimeout() {
    if (this.isEmptied) {
      this.clearRetryTimeout();
      this.retryCachedTimeout = setTimeout(() => {
        this.incomingQueue.add(async () => this.queueAllCached());
      }, RETRY_TIMEOUT);
    }
  }

  async getAllFromCache() {
    window.log.info('getAllFromCache');
    const count = await window.textsecure.storage.protocol.getUnprocessedCount();

    if (count > 1500) {
      await window.textsecure.storage.protocol.removeAllUnprocessed();
      window.log.warn(
        `There were ${count} messages in cache. Deleted all instead of reprocessing`
      );
      return [];
    }

    const items = await window.textsecure.storage.protocol.getAllUnprocessed();
    window.log.info('getAllFromCache loaded', items.length, 'saved envelopes');

    return Promise.all(
      map(items, async item => {
        const attempts = 1 + (item.attempts || 0);

        try {
          if (attempts >= 3) {
            window.log.warn(
              'getAllFromCache final attempt for envelope',
              item.id
            );
            await window.textsecure.storage.protocol.removeUnprocessed(item.id);
          } else {
            await window.textsecure.storage.protocol.updateUnprocessedAttempts(
              item.id,
              attempts
            );
          }
        } catch (error) {
          window.log.error(
            'getAllFromCache error updating item after load:',
            error && error.stack ? error.stack : error
          );
        }

        return item;
      })
    );
  }

  async decryptAndCacheBatch(items: Array<CacheAddItemType>) {
    window.log.info('MessageReceiver.decryptAndCacheBatch', items.length);

    const decrypted: Array<
      Readonly<{
        plaintext: Uint8Array;
        data: UnprocessedType;
        envelope: DecryptedEnvelope;
      }>
    > = [];

    const storageProtocol = window.textsecure.storage.protocol;

    try {
      const zone = new Zone('decryptAndCacheBatch', {
        pendingSessions: true,
        pendingUnprocessed: true,
      });
      const sessionStore = new Sessions({ zone });
      const identityKeyStore = new IdentityKeys({ zone });
      const failed: Array<UnprocessedType> = [];

      // Below we:
      //
      // 1. Enter zone
      // 2. Decrypt all batched envelopes
      // 3. Persist both decrypted envelopes and envelopes that we failed to
      //    decrypt (for future retries, see `attempts` field)
      // 4. Leave zone and commit all pending sessions and unprocesseds
      // 5. Acknowledge envelopes (can't fail)
      // 6. Finally process decrypted envelopes
      await storageProtocol.withZone(zone, 'MessageReceiver', async () => {
        await Promise.all<void>(
          items.map(async ({ data, envelope }) => {
            try {
              const result = await this.queueEncryptedEnvelope(
                { sessionStore, identityKeyStore, zone },
                envelope
              );
              if (result.plaintext) {
                decrypted.push({
                  plaintext: result.plaintext,
                  envelope: result.envelope,
                  data,
                });
              }
            } catch (error) {
              failed.push(data);
              window.log.error(
                'decryptAndCache error when processing the envelope',
                error && error.stack ? error.stack : error
              );
            }
          })
        );

        window.log.info(
          'MessageReceiver.decryptAndCacheBatch storing ' +
            `${decrypted.length} decrypted envelopes`
        );

        // Store both decrypted and failed unprocessed envelopes
        const unprocesseds: Array<UnprocessedType> = decrypted.map(
          ({ envelope, data, plaintext }) => {
            return {
              ...data,

              source: envelope.source,
              sourceUuid: envelope.sourceUuid,
              sourceDevice: envelope.sourceDevice,
              serverGuid: envelope.serverGuid,
              serverTimestamp: envelope.serverTimestamp,
              decrypted: Bytes.toBase64(plaintext),
            };
          }
        );

        await storageProtocol.addMultipleUnprocessed(
          unprocesseds.concat(failed),
          { zone }
        );
      });

      window.log.info(
        'MessageReceiver.decryptAndCacheBatch acknowledging receipt'
      );

      // Acknowledge all envelopes
      for (const { request } of items) {
        try {
          request.respond(200, 'OK');
        } catch (error) {
          window.log.error(
            'decryptAndCacheBatch: Failed to send 200 to server; still queuing envelope'
          );
        }
      }
    } catch (error) {
      window.log.error(
        'decryptAndCache error trying to add messages to cache:',
        error && error.stack ? error.stack : error
      );

      items.forEach(item => {
        item.request.respond(500, 'Failed to cache message');
      });
      return;
    }

    await Promise.all(
      decrypted.map(async ({ envelope, plaintext }) => {
        try {
          await this.queueDecryptedEnvelope(envelope, plaintext);
        } catch (error) {
          window.log.error(
            'decryptAndCache error when processing decrypted envelope',
            error && error.stack ? error.stack : error
          );
        }
      })
    );

    window.log.info('MessageReceiver.decryptAndCacheBatch fully processed');

    this.maybeScheduleRetryTimeout();
  }

  decryptAndCache(
    envelope: ProcessedEnvelope,
    plaintext: Uint8Array,
    request: IncomingWebSocketRequest
  ) {
    const { id } = envelope;
    const data: UnprocessedType = {
      id,
      version: 2,
      envelope: Bytes.toBase64(plaintext),
      timestamp: envelope.receivedAtCounter,
      attempts: 1,
      messageAgeSec: envelope.messageAgeSec,
    };
    this.decryptAndCacheBatcher.add({
      request,
      envelope,
      data,
    });
  }

  async cacheRemoveBatch(items: Array<string>) {
    await window.textsecure.storage.protocol.removeUnprocessed(items);
  }

  removeFromCache(envelope: ProcessedEnvelope) {
    const { id } = envelope;
    this.cacheRemoveBatcher.add(id);
  }

  async queueDecryptedEnvelope(
    envelope: DecryptedEnvelope,
    plaintext: Uint8Array
  ) {
    const id = this.getEnvelopeId(envelope);
    window.log.info('queueing decrypted envelope', id);

    const task = this.handleDecryptedEnvelope.bind(this, envelope, plaintext);
    const taskWithTimeout = window.textsecure.createTaskWithTimeout(
      task,
      `queueDecryptedEnvelope ${id}`
    );

    try {
      await this.addToQueue(taskWithTimeout, TaskType.Decrypted);
    } catch (error) {
      window.log.error(
        `queueDecryptedEnvelope error handling envelope ${id}:`,
        error && error.extra ? JSON.stringify(error.extra) : '',
        error && error.stack ? error.stack : error
      );
    }
  }

  async queueEncryptedEnvelope(
    stores: LockedStores,
    envelope: ProcessedEnvelope
  ): Promise<DecryptResult> {
    const id = this.getEnvelopeId(envelope);
    window.log.info('queueing envelope', id);

    const task = this.decryptEnvelope.bind(this, stores, envelope);
    const taskWithTimeout = window.textsecure.createTaskWithTimeout(
      task,
      `queueEncryptedEnvelope ${id}`
    );

    try {
      return await this.addToQueue(taskWithTimeout, TaskType.Encrypted);
    } catch (error) {
      const args = [
        'queueEncryptedEnvelope error handling envelope',
        this.getEnvelopeId(error.envelope || envelope),
        ':',
        error && error.extra ? JSON.stringify(error.extra) : '',
        error && error.stack ? error.stack : error,
      ];
      if (error.warn) {
        window.log.warn(...args);
      } else {
        window.log.error(...args);
      }
      return {
        plaintext: undefined,
        envelope,
      };
    }
  }

  async queueCachedEnvelope(
    data: UnprocessedType,
    envelope: ProcessedEnvelope
  ): Promise<void> {
    this.decryptAndCacheBatcher.add({
      request: {
        respond(code, status) {
          window.log.info(
            'queueCachedEnvelope: fake response ' +
              `with code ${code} and status ${status}`
          );
        },
      },
      envelope,
      data,
    });
  }

  // Called after `decryptEnvelope` decrypted the message.
  async handleDecryptedEnvelope(
    envelope: DecryptedEnvelope,
    plaintext: Uint8Array
  ): Promise<void> {
    if (this.stoppingProcessing) {
      return;
    }
    // No decryption is required for delivery receipts, so the decrypted field of
    //   the Unprocessed model will never be set

    if (envelope.content) {
      await this.innerHandleContentMessage(envelope, plaintext);

      return;
    }
    if (envelope.legacyMessage) {
      await this.innerHandleLegacyMessage(envelope, plaintext);

      return;
    }

    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  }

  async decryptEnvelope(
    stores: LockedStores,
    envelope: ProcessedEnvelope
  ): Promise<DecryptResult> {
    if (this.stoppingProcessing) {
      return { plaintext: undefined, envelope };
    }

    if (envelope.type === Proto.Envelope.Type.RECEIPT) {
      await this.onDeliveryReceipt(envelope);
      return { plaintext: undefined, envelope };
    }

    if (envelope.content) {
      return this.decryptContentMessage(stores, envelope);
    }
    if (envelope.legacyMessage) {
      return this.decryptLegacyMessage(stores, envelope);
    }

    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  }

  getStatus(): SocketStatus {
    return this.socketStatus;
  }

  async onDeliveryReceipt(envelope: ProcessedEnvelope): Promise<void> {
    await this.dispatchAndWait(
      new DeliveryEvent(
        {
          timestamp: envelope.timestamp,
          source: envelope.source,
          sourceUuid: envelope.sourceUuid,
          sourceDevice: envelope.sourceDevice,
        },
        this.removeFromCache.bind(this, envelope)
      )
    );
  }

  unpad(paddedPlaintext: Uint8Array): Uint8Array {
    for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
      if (paddedPlaintext[i] === 0x80) {
        return new Uint8Array(paddedPlaintext.slice(0, i));
      }
      if (paddedPlaintext[i] !== 0x00) {
        throw new Error('Invalid padding');
      }
    }

    return paddedPlaintext;
  }

  private async decryptSealedSender(
    { sessionStore, identityKeyStore, zone }: LockedStores,
    envelope: ProcessedEnvelope,
    ciphertext: Uint8Array
  ): Promise<{
    error?: Error;
    result: DecryptSealedSenderResult;
  }> {
    const buffer = Buffer.from(ciphertext);

    const localE164 = window.textsecure.storage.user.getNumber();
    const localUuid = window.textsecure.storage.user.getUuid();
    const localDeviceId = parseIntOrThrow(
      window.textsecure.storage.user.getDeviceId(),
      'MessageReceiver.decryptSealedSender: localDeviceId'
    );

    if (!localUuid) {
      throw new Error(
        'MessageReceiver.decryptSealedSender: Failed to fetch local UUID'
      );
    }

    const messageContent: UnidentifiedSenderMessageContent = await sealedSenderDecryptToUsmc(
      buffer,
      identityKeyStore
    );

    // Here we take this sender information and attach it back to the envelope
    //   to make the rest of the app work properly.
    const certificate = messageContent.senderCertificate();

    const originalSource = envelope.source;
    const originalSourceUuid = envelope.sourceUuid;

    const unidentifiedLogId = this.getEnvelopeId(envelope);

    const newEnvelope: DecryptedEnvelope = {
      ...envelope,

      source: dropNull(certificate.senderE164()),
      sourceUuid: normalizeUuid(
        certificate.senderUuid(),
        'MessageReceiver.decryptSealedSender.UNIDENTIFIED_SENDER.sourceUuid'
      ),
      sourceDevice: certificate.senderDeviceId(),
      unidentifiedDeliveryReceived: !(originalSource || originalSourceUuid),
      contentHint: messageContent.contentHint(),
      groupId: messageContent.groupId()?.toString('base64'),
      usmc: messageContent,
    };

    if (
      (newEnvelope.source && this.isBlocked(newEnvelope.source)) ||
      (newEnvelope.sourceUuid && this.isUuidBlocked(newEnvelope.sourceUuid))
    ) {
      window.log.info(
        'MessageReceiver.decryptSealedSender: Dropping blocked message after ' +
          'partial sealed sender decryption'
      );
      return {
        result: { isBlocked: true, envelope: newEnvelope },
      };
    }

    if (!newEnvelope.serverTimestamp) {
      throw new Error(
        'MessageReceiver.decryptSealedSender: ' +
          'Sealed sender message was missing serverTimestamp'
      );
    }

    const serverCertificate = certificate.serverCertificate();

    if (
      !verifySignature(
        typedArrayToArrayBuffer(this.serverTrustRoot),
        typedArrayToArrayBuffer(serverCertificate.certificateData()),
        typedArrayToArrayBuffer(serverCertificate.signature())
      )
    ) {
      throw new Error(
        'MessageReceiver.decryptSealedSender: Server certificate trust root validation failed'
      );
    }

    if (
      !verifySignature(
        typedArrayToArrayBuffer(serverCertificate.key().serialize()),
        typedArrayToArrayBuffer(certificate.certificate()),
        typedArrayToArrayBuffer(certificate.signature())
      )
    ) {
      throw new Error(
        'MessageReceiver.decryptSealedSender: Server certificate server signature validation failed'
      );
    }

    if (newEnvelope.serverTimestamp > certificate.expiration()) {
      const envelopeId = this.getEnvelopeId(newEnvelope);
      throw new Error(
        `MessageReceiver.decryptSealedSender: Sender certificate is expired for envelope ${envelopeId}`
      );
    }

    const unidentifiedSenderTypeEnum =
      Proto.UnidentifiedSenderMessage.Message.Type;

    if (
      messageContent.msgType() === unidentifiedSenderTypeEnum.PLAINTEXT_CONTENT
    ) {
      window.log.info(
        `decrypt/${unidentifiedLogId}: unidentified message/plaintext contents`
      );
      const plaintextContent = PlaintextContent.deserialize(
        messageContent.contents()
      );

      return {
        result: {
          plaintext: plaintextContent.body(),
          envelope: newEnvelope,
        },
      };
    }

    if (
      messageContent.msgType() === unidentifiedSenderTypeEnum.SENDERKEY_MESSAGE
    ) {
      window.log.info(
        `decrypt/${unidentifiedLogId}: unidentified message/sender key contents`
      );
      const sealedSenderIdentifier = certificate.senderUuid();
      const sealedSenderSourceDevice = certificate.senderDeviceId();
      const senderKeyStore = new SenderKeys();

      const address = `${sealedSenderIdentifier}.${sealedSenderSourceDevice}`;

      try {
        const plaintext = await window.textsecure.storage.protocol.enqueueSenderKeyJob(
          address,
          () =>
            groupDecrypt(
              ProtocolAddress.new(
                sealedSenderIdentifier,
                sealedSenderSourceDevice
              ),
              senderKeyStore,
              messageContent.contents()
            ),
          zone
        );
        return {
          result: {
            plaintext,
            envelope: newEnvelope,
          },
        };
      } catch (error) {
        return {
          error,
          result: {
            envelope: newEnvelope,
          },
        };
      }
    }

    window.log.info(
      `decrypt/${unidentifiedLogId}: unidentified message/passing to sealedSenderDecryptMessage`
    );

    const preKeyStore = new PreKeys();
    const signedPreKeyStore = new SignedPreKeys();

    const sealedSenderIdentifier = newEnvelope.sourceUuid || newEnvelope.source;
    const address = `${sealedSenderIdentifier}.${newEnvelope.sourceDevice}`;
    try {
      const unsealedPlaintext = await window.textsecure.storage.protocol.enqueueSessionJob(
        address,
        () =>
          sealedSenderDecryptMessage(
            buffer,
            PublicKey.deserialize(Buffer.from(this.serverTrustRoot)),
            newEnvelope.serverTimestamp,
            localE164 || null,
            localUuid,
            localDeviceId,
            sessionStore,
            identityKeyStore,
            preKeyStore,
            signedPreKeyStore
          ),
        zone
      );

      return {
        result: { unsealedPlaintext, envelope: newEnvelope },
      };
    } catch (error) {
      return {
        error,
        result: {
          envelope: newEnvelope,
        },
      };
    }
  }

  private async innerDecrypt(
    stores: LockedStores,
    envelope: ProcessedEnvelope,
    ciphertext: Uint8Array
  ): Promise<{
    error?: Error;
    result: InnerDecryptResult;
  }> {
    const { sessionStore, identityKeyStore, zone } = stores;

    const logId = this.getEnvelopeId(envelope);
    const envelopeTypeEnum = Proto.Envelope.Type;

    const identifier = envelope.sourceUuid || envelope.source;
    const { sourceDevice } = envelope;

    const preKeyStore = new PreKeys();
    const signedPreKeyStore = new SignedPreKeys();

    if (envelope.type === envelopeTypeEnum.PLAINTEXT_CONTENT) {
      window.log.info(`decrypt/${logId}: plaintext message`);
      const buffer = Buffer.from(ciphertext);
      const plaintextContent = PlaintextContent.deserialize(buffer);

      return {
        result: {
          plaintext: this.unpad(plaintextContent.body()),
          envelope,
        },
      };
    }
    if (envelope.type === envelopeTypeEnum.CIPHERTEXT) {
      window.log.info(`decrypt/${logId}: ciphertext message`);
      if (!identifier) {
        throw new Error(
          'MessageReceiver.innerDecrypt: No identifier for CIPHERTEXT message'
        );
      }
      if (!sourceDevice) {
        throw new Error(
          'MessageReceiver.innerDecrypt: No sourceDevice for CIPHERTEXT message'
        );
      }
      const signalMessage = SignalMessage.deserialize(Buffer.from(ciphertext));

      const address = `${identifier}.${sourceDevice}`;
      const plaintext = await window.textsecure.storage.protocol.enqueueSessionJob(
        address,
        async () =>
          this.unpad(
            await signalDecrypt(
              signalMessage,
              ProtocolAddress.new(identifier, sourceDevice),
              sessionStore,
              identityKeyStore
            )
          ),
        zone
      );
      return {
        result: {
          plaintext,
          envelope,
        },
      };
    }
    if (envelope.type === envelopeTypeEnum.PREKEY_BUNDLE) {
      window.log.info(`decrypt/${logId}: prekey message`);
      if (!identifier) {
        throw new Error(
          'MessageReceiver.innerDecrypt: No identifier for PREKEY_BUNDLE message'
        );
      }
      if (!sourceDevice) {
        throw new Error(
          'MessageReceiver.innerDecrypt: No sourceDevice for PREKEY_BUNDLE message'
        );
      }
      const preKeySignalMessage = PreKeySignalMessage.deserialize(
        Buffer.from(ciphertext)
      );

      const address = `${identifier}.${sourceDevice}`;
      const plaintext = await window.textsecure.storage.protocol.enqueueSessionJob(
        address,
        async () =>
          this.unpad(
            await signalDecryptPreKey(
              preKeySignalMessage,
              ProtocolAddress.new(identifier, sourceDevice),
              sessionStore,
              identityKeyStore,
              preKeyStore,
              signedPreKeyStore
            )
          ),
        zone
      );
      return {
        result: {
          plaintext,
          envelope,
        },
      };
    }
    if (envelope.type === envelopeTypeEnum.UNIDENTIFIED_SENDER) {
      window.log.info(`decrypt/${logId}: unidentified message`);
      const { result, error } = await this.decryptSealedSender(
        stores,
        envelope,
        ciphertext
      );

      if (error) {
        return {
          error,
          result,
        };
      }

      const {
        plaintext,
        unsealedPlaintext,
        isBlocked,
        envelope: newEnvelope,
      } = result;
      if (isBlocked) {
        return {
          result: {
            isBlocked: true,
            envelope: newEnvelope,
          },
        };
      }

      if (plaintext) {
        return {
          result: {
            plaintext: this.unpad(plaintext),
            envelope: newEnvelope,
          },
        };
      }

      if (unsealedPlaintext) {
        const content = unsealedPlaintext.message();

        if (!content) {
          throw new Error(
            'MessageReceiver.innerDecrypt: Content returned was falsey!'
          );
        }

        // Return just the content because that matches the signature of the other
        //   decrypt methods used above.
        return {
          result: {
            plaintext: this.unpad(content),
            envelope: newEnvelope,
          },
        };
      }

      throw new Error('Unexpected lack of plaintext from unidentified sender');
    }
    throw new Error('Unknown message type');
  }

  async decrypt(
    stores: LockedStores,
    envelope: ProcessedEnvelope,
    ciphertext: Uint8Array
  ): Promise<DecryptResult> {
    let newEnvelope: DecryptedEnvelope = envelope;
    try {
      const { result, error } = await this.innerDecrypt(
        stores,
        envelope,
        ciphertext
      );

      newEnvelope = result.envelope || envelope;
      if (error) {
        throw error;
      }

      const { isBlocked, plaintext } = result;

      if (isBlocked) {
        this.removeFromCache(envelope);
        return { plaintext: undefined, envelope: newEnvelope };
      }

      assert(plaintext, 'Should have plaintext from innerDecrypt');
      return { plaintext: new FIXMEU8(plaintext), envelope: newEnvelope };
    } catch (error) {
      this.removeFromCache(newEnvelope);
      const uuid = newEnvelope.sourceUuid;
      const deviceId = newEnvelope.sourceDevice;

      // We don't do a light session reset if it's just a duplicated message
      if (
        error?.message?.includes &&
        error.message.includes('message with old counter')
      ) {
        throw error;
      }

      // We don't do a light session reset if it's an error with the sealed sender
      //   wrapper, since we don't trust the sender information.
      if (
        error?.message?.includes &&
        error.message.includes('trust root validation failed')
      ) {
        throw error;
      }

      if (uuid && deviceId) {
        const { usmc } = newEnvelope;
        const event = new DecryptionErrorEvent({
          cipherTextBytes: usmc
            ? typedArrayToArrayBuffer(usmc.contents())
            : undefined,
          cipherTextType: usmc ? usmc.msgType() : undefined,
          contentHint: newEnvelope.contentHint,
          groupId: newEnvelope.groupId,
          receivedAtCounter: newEnvelope.receivedAtCounter,
          receivedAtDate: newEnvelope.receivedAtDate,
          senderDevice: deviceId,
          senderUuid: uuid,
          timestamp: newEnvelope.timestamp,
        });

        // Avoid deadlocks by scheduling processing on decrypted queue
        this.addToQueue(
          async () => this.dispatchEvent(event),
          TaskType.Decrypted
        );
      } else {
        const envelopeId = this.getEnvelopeId(newEnvelope);
        window.log.error(
          `MessageReceiver.decrypt: Envelope ${envelopeId} missing uuid or deviceId`
        );
      }

      throw error;
    }
  }

  async handleSentMessage(
    envelope: ProcessedEnvelope,
    sentContainer: ProcessedSent
  ) {
    window.log.info(
      'MessageReceiver.handleSentMessage',
      this.getEnvelopeId(envelope)
    );
    const {
      destination,
      destinationUuid,
      timestamp,
      message: msg,
      expirationStartTimestamp,
      unidentifiedStatus,
      isRecipientUpdate,
    } = sentContainer;

    if (!msg) {
      throw new Error('MessageReceiver.handleSentMessage: message was falsey!');
    }

    let p: Promise<any> = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags && msg.flags & Proto.DataMessage.Flags.END_SESSION) {
      const identifier = destination || destinationUuid;
      if (!identifier) {
        throw new Error(
          'MessageReceiver.handleSentMessage: Cannot end session with falsey destination'
        );
      }
      p = this.handleEndSession(identifier);
    }
    await p;

    const message = await this.processDecrypted(envelope, msg);
    const groupId = this.getProcessedGroupId(message);
    const isBlocked = groupId ? this.isGroupBlocked(groupId) : false;
    const { source, sourceUuid } = envelope;
    const ourE164 = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getUuid();
    const isMe =
      (source && ourE164 && source === ourE164) ||
      (sourceUuid && ourUuid && sourceUuid === ourUuid);
    const isLeavingGroup = Boolean(
      !message.groupV2 &&
        message.group &&
        message.group.type === Proto.GroupContext.Type.QUIT
    );

    if (groupId && isBlocked && !(isMe && isLeavingGroup)) {
      window.log.warn(
        `Message ${this.getEnvelopeId(
          envelope
        )} ignored; destined for blocked group`
      );
      this.removeFromCache(envelope);
      return undefined;
    }

    const ev = new SentEvent(
      {
        destination: dropNull(destination),
        destinationUuid: dropNull(destinationUuid),
        timestamp: timestamp ? normalizeNumber(timestamp) : undefined,
        serverTimestamp: envelope.serverTimestamp,
        device: envelope.sourceDevice,
        unidentifiedStatus,
        message,
        isRecipientUpdate: Boolean(isRecipientUpdate),
        receivedAtCounter: envelope.receivedAtCounter,
        receivedAtDate: envelope.receivedAtDate,
        expirationStartTimestamp: expirationStartTimestamp
          ? normalizeNumber(expirationStartTimestamp)
          : undefined,
      },
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(ev);
  }

  async handleDataMessage(
    envelope: DecryptedEnvelope,
    msg: Proto.IDataMessage
  ): Promise<void> {
    window.log.info(
      'MessageReceiver.handleDataMessage',
      this.getEnvelopeId(envelope)
    );
    let p: Promise<any> = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    const destination = envelope.sourceUuid || envelope.source;
    if (!destination) {
      throw new Error(
        'MessageReceiver.handleDataMessage: source and sourceUuid were falsey'
      );
    }

    if (this.isInvalidGroupData(msg, envelope)) {
      this.removeFromCache(envelope);
      return undefined;
    }

    await this.checkGroupV1Data(msg);

    if (msg.flags && msg.flags & Proto.DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(destination);
    }

    if (msg.flags && msg.flags & Proto.DataMessage.Flags.PROFILE_KEY_UPDATE) {
      strictAssert(msg.profileKey, 'PROFILE_KEY_UPDATE without profileKey');

      const ev = new ProfileKeyUpdateEvent(
        {
          source: envelope.source,
          sourceUuid: envelope.sourceUuid,
          profileKey: Bytes.toBase64(msg.profileKey),
        },
        this.removeFromCache.bind(this, envelope)
      );
      return this.dispatchAndWait(ev);
    }
    await p;

    const message = await this.processDecrypted(envelope, msg);
    const groupId = this.getProcessedGroupId(message);
    const isBlocked = groupId ? this.isGroupBlocked(groupId) : false;
    const { source, sourceUuid } = envelope;
    const ourE164 = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getUuid();
    const isMe =
      (source && ourE164 && source === ourE164) ||
      (sourceUuid && ourUuid && sourceUuid === ourUuid);
    const isLeavingGroup = Boolean(
      !message.groupV2 &&
        message.group &&
        message.group.type === Proto.GroupContext.Type.QUIT
    );

    if (groupId && isBlocked && !(isMe && isLeavingGroup)) {
      window.log.warn(
        `Message ${this.getEnvelopeId(
          envelope
        )} ignored; destined for blocked group`
      );
      this.removeFromCache(envelope);
      return undefined;
    }

    const ev = new MessageEvent(
      {
        source: envelope.source,
        sourceUuid: envelope.sourceUuid,
        sourceDevice: envelope.sourceDevice,
        timestamp: envelope.timestamp,
        serverGuid: envelope.serverGuid,
        serverTimestamp: envelope.serverTimestamp,
        unidentifiedDeliveryReceived: Boolean(
          envelope.unidentifiedDeliveryReceived
        ),
        message,
        receivedAtCounter: envelope.receivedAtCounter,
        receivedAtDate: envelope.receivedAtDate,
      },
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(ev);
  }

  async decryptLegacyMessage(
    stores: LockedStores,
    envelope: ProcessedEnvelope
  ): Promise<DecryptResult> {
    window.log.info(
      'MessageReceiver.decryptLegacyMessage',
      this.getEnvelopeId(envelope)
    );
    assert(envelope.legacyMessage, 'Should have `legacyMessage` field');
    const result = await this.decrypt(stores, envelope, envelope.legacyMessage);
    if (!result.plaintext) {
      window.log.warn('decryptLegacyMessage: plaintext was falsey');
    }

    return result;
  }

  async innerHandleLegacyMessage(
    envelope: ProcessedEnvelope,
    plaintext: Uint8Array
  ) {
    const message = Proto.DataMessage.decode(plaintext);
    return this.handleDataMessage(envelope, message);
  }

  async decryptContentMessage(
    stores: LockedStores,
    envelope: ProcessedEnvelope
  ): Promise<DecryptResult> {
    window.log.info(
      'MessageReceiver.decryptContentMessage',
      this.getEnvelopeId(envelope)
    );
    assert(envelope.content, 'Should have `content` field');
    const result = await this.decrypt(stores, envelope, envelope.content);

    if (!result.plaintext) {
      window.log.warn('decryptContentMessage: plaintext was falsey');
      return result;
    }

    // Note: we need to process this as part of decryption, because we might need this
    //   sender key to decrypt the next message in the queue!
    try {
      const content = Proto.Content.decode(result.plaintext);

      if (
        content.senderKeyDistributionMessage &&
        Bytes.isNotEmpty(content.senderKeyDistributionMessage)
      ) {
        await this.handleSenderKeyDistributionMessage(
          stores,
          result.envelope,
          content.senderKeyDistributionMessage
        );
      }
    } catch (error) {
      const errorString = error && error.stack ? error.stack : error;
      window.log.error(
        `decryptContentMessage: Failed to process sender key distribution message: ${errorString}`
      );
    }

    return result;
  }

  async maybeUpdateTimestamp(
    envelope: ProcessedEnvelope
  ): Promise<ProcessedEnvelope> {
    const { retryPlaceholders } = window.Signal.Services;
    if (!retryPlaceholders) {
      window.log.warn(
        'maybeUpdateTimestamp: retry placeholders not available!'
      );
      return envelope;
    }

    const { timestamp } = envelope;
    const identifier =
      envelope.groupId || envelope.sourceUuid || envelope.source;
    const conversation = window.ConversationController.get(identifier);

    try {
      if (!conversation) {
        window.log.info(
          `maybeUpdateTimestamp/${timestamp}: No conversation found for identifier ${identifier}`
        );
        return envelope;
      }

      const logId = `${conversation.idForLogging()}/${timestamp}`;
      const item = await retryPlaceholders.findByMessageAndRemove(
        conversation.id,
        timestamp
      );
      if (item && item.wasOpened) {
        window.log.info(
          `maybeUpdateTimestamp/${logId}: found retry placeholder, but conversation was opened. No updates made.`
        );
      } else if (item) {
        window.log.info(
          `maybeUpdateTimestamp/${logId}: found retry placeholder. Updating receivedAtCounter/receivedAtDate`
        );

        return {
          ...envelope,
          receivedAtCounter: item.receivedAtCounter,
          receivedAtDate: item.receivedAt,
        };
      }
    } catch (error) {
      const errorString = error && error.stack ? error.stack : error;
      window.log.error(
        `maybeUpdateTimestamp/${timestamp}: Failed to process sender key distribution message: ${errorString}`
      );
    }

    return envelope;
  }

  async innerHandleContentMessage(
    incomingEnvelope: ProcessedEnvelope,
    plaintext: Uint8Array
  ): Promise<void> {
    const content = Proto.Content.decode(plaintext);
    const envelope = await this.maybeUpdateTimestamp(incomingEnvelope);

    if (
      content.decryptionErrorMessage &&
      Bytes.isNotEmpty(content.decryptionErrorMessage)
    ) {
      await this.handleDecryptionError(
        envelope,
        content.decryptionErrorMessage
      );
      return;
    }
    if (content.syncMessage) {
      await this.handleSyncMessage(
        envelope,
        processSyncMessage(content.syncMessage)
      );
      return;
    }
    if (content.dataMessage) {
      await this.handleDataMessage(envelope, content.dataMessage);
      return;
    }
    if (content.nullMessage) {
      await this.handleNullMessage(envelope);
      return;
    }
    if (content.callingMessage) {
      await this.handleCallingMessage(envelope, content.callingMessage);
      return;
    }
    if (content.receiptMessage) {
      await this.handleReceiptMessage(envelope, content.receiptMessage);
      return;
    }
    if (content.typingMessage) {
      await this.handleTypingMessage(envelope, content.typingMessage);
      return;
    }

    this.removeFromCache(envelope);

    if (Bytes.isEmpty(content.senderKeyDistributionMessage)) {
      throw new Error('Unsupported content message');
    }
  }

  async handleDecryptionError(
    envelope: DecryptedEnvelope,
    decryptionError: Uint8Array
  ) {
    const logId = this.getEnvelopeId(envelope);
    window.log.info(`handleDecryptionError: ${logId}`);

    const buffer = Buffer.from(decryptionError);
    const request = DecryptionErrorMessage.deserialize(buffer);

    this.removeFromCache(envelope);

    const { sourceUuid, sourceDevice } = envelope;
    if (!sourceUuid || !sourceDevice) {
      window.log.error(
        `handleDecryptionError/${logId}: Missing uuid or device!`
      );
      return;
    }

    const event = new RetryRequestEvent({
      groupId: envelope.groupId,
      requesterDevice: sourceDevice,
      requesterUuid: sourceUuid,
      senderDevice: request.deviceId(),
      sentAt: request.timestamp(),
    });
    await this.dispatchEvent(event);
  }

  async handleSenderKeyDistributionMessage(
    stores: LockedStores,
    envelope: ProcessedEnvelope,
    distributionMessage: Uint8Array
  ): Promise<void> {
    const envelopeId = this.getEnvelopeId(envelope);
    window.log.info(`handleSenderKeyDistributionMessage/${envelopeId}`);

    // Note: we don't call removeFromCache here because this message can be combined
    //   with a dataMessage, for example. That processing will dictate cache removal.

    const identifier = envelope.sourceUuid || envelope.source;
    const { sourceDevice } = envelope;
    if (!identifier) {
      throw new Error(
        `handleSenderKeyDistributionMessage: No identifier for envelope ${envelopeId}`
      );
    }
    if (!isNumber(sourceDevice)) {
      throw new Error(
        `handleSenderKeyDistributionMessage: Missing sourceDevice for envelope ${envelopeId}`
      );
    }

    const sender = ProtocolAddress.new(identifier, sourceDevice);
    const senderKeyDistributionMessage = SenderKeyDistributionMessage.deserialize(
      Buffer.from(distributionMessage)
    );
    const senderKeyStore = new SenderKeys();
    const address = `${identifier}.${sourceDevice}`;

    await window.textsecure.storage.protocol.enqueueSenderKeyJob(
      address,
      () =>
        processSenderKeyDistributionMessage(
          sender,
          senderKeyDistributionMessage,
          senderKeyStore
        ),
      stores.zone
    );
  }

  async handleCallingMessage(
    envelope: ProcessedEnvelope,
    callingMessage: Proto.ICallingMessage
  ): Promise<void> {
    this.removeFromCache(envelope);
    await window.Signal.Services.calling.handleCallingMessage(
      envelope,
      callingMessage
    );
  }

  async handleReceiptMessage(
    envelope: ProcessedEnvelope,
    receiptMessage: Proto.IReceiptMessage
  ): Promise<void> {
    const results = [];
    strictAssert(receiptMessage.timestamp, 'Receipt message without timestamp');
    if (receiptMessage.type === Proto.ReceiptMessage.Type.DELIVERY) {
      for (let i = 0; i < receiptMessage.timestamp.length; i += 1) {
        const ev = new DeliveryEvent(
          {
            timestamp: normalizeNumber(receiptMessage.timestamp[i]),
            envelopeTimestamp: envelope.timestamp,
            source: envelope.source,
            sourceUuid: envelope.sourceUuid,
            sourceDevice: envelope.sourceDevice,
          },
          this.removeFromCache.bind(this, envelope)
        );
        results.push(this.dispatchAndWait(ev));
      }
    } else if (receiptMessage.type === Proto.ReceiptMessage.Type.READ) {
      for (let i = 0; i < receiptMessage.timestamp.length; i += 1) {
        const ev = new ReadEvent(
          {
            timestamp: normalizeNumber(receiptMessage.timestamp[i]),
            envelopeTimestamp: envelope.timestamp,
            source: envelope.source,
            sourceUuid: envelope.sourceUuid,
            sourceDevice: envelope.sourceDevice,
          },
          this.removeFromCache.bind(this, envelope)
        );
        results.push(this.dispatchAndWait(ev));
      }
    }
    await Promise.all(results);
  }

  async handleTypingMessage(
    envelope: ProcessedEnvelope,
    typingMessage: Proto.ITypingMessage
  ): Promise<void> {
    this.removeFromCache(envelope);

    if (envelope.timestamp && typingMessage.timestamp) {
      const envelopeTimestamp = envelope.timestamp;
      const typingTimestamp = normalizeNumber(typingMessage.timestamp);

      if (typingTimestamp !== envelopeTimestamp) {
        window.log.warn(
          `Typing message envelope timestamp (${envelopeTimestamp}) did not match typing timestamp (${typingTimestamp})`
        );
        return;
      }
    }

    strictAssert(
      envelope.sourceDevice !== undefined,
      'TypingMessage requires sourceDevice in the envelope'
    );

    const { groupId, timestamp, action } = typingMessage;

    let groupIdString: string | undefined;
    let groupV2IdString: string | undefined;
    if (groupId && groupId.byteLength > 0) {
      if (groupId.byteLength === GROUPV1_ID_LENGTH) {
        groupIdString = Bytes.toBinary(groupId);
        groupV2IdString = await this.deriveGroupV2FromV1(groupId);
      } else if (groupId.byteLength === GROUPV2_ID_LENGTH) {
        groupV2IdString = Bytes.toBase64(groupId);
      } else {
        window.log.error('handleTypingMessage: Received invalid groupId value');
      }
    }

    await this.dispatchEvent(
      new TypingEvent({
        sender: envelope.source,
        senderUuid: envelope.sourceUuid,
        senderDevice: envelope.sourceDevice,
        typing: {
          typingMessage,
          timestamp: timestamp ? normalizeNumber(timestamp) : Date.now(),
          started: action === Proto.TypingMessage.Action.STARTED,
          stopped: action === Proto.TypingMessage.Action.STOPPED,

          groupId: groupIdString,
          groupV2Id: groupV2IdString,
        },
      })
    );
  }

  handleNullMessage(envelope: ProcessedEnvelope): void {
    window.log.info(
      'MessageReceiver.handleNullMessage',
      this.getEnvelopeId(envelope)
    );
    this.removeFromCache(envelope);
  }

  isInvalidGroupData(
    message: Proto.IDataMessage,
    envelope: ProcessedEnvelope
  ): boolean {
    const { group, groupV2 } = message;

    if (group) {
      const { id } = group;
      strictAssert(id, 'Group data has no id');
      const isInvalid = id.byteLength !== GROUPV1_ID_LENGTH;

      if (isInvalid) {
        window.log.info(
          'isInvalidGroupData: invalid GroupV1 message from',
          this.getEnvelopeId(envelope)
        );
      }

      return isInvalid;
    }

    if (groupV2) {
      const { masterKey } = groupV2;
      strictAssert(masterKey, 'Group v2 data has no masterKey');
      const isInvalid = masterKey.byteLength !== MASTER_KEY_LENGTH;

      if (isInvalid) {
        window.log.info(
          'isInvalidGroupData: invalid GroupV2 message from',
          this.getEnvelopeId(envelope)
        );
      }
      return isInvalid;
    }

    return false;
  }

  async deriveGroupV2FromV1(groupId: Uint8Array): Promise<string> {
    if (groupId.byteLength !== GROUPV1_ID_LENGTH) {
      throw new Error(
        `deriveGroupV2FromV1: had id with wrong byteLength: ${groupId.byteLength}`
      );
    }
    const masterKey = await deriveMasterKeyFromGroupV1(
      typedArrayToArrayBuffer(groupId)
    );
    const data = deriveGroupFields(new FIXMEU8(masterKey));

    return Bytes.toBase64(data.id);
  }

  async checkGroupV1Data(message: Readonly<Proto.IDataMessage>): Promise<void> {
    const { group } = message;

    if (!group) {
      return;
    }

    if (!group.id) {
      throw new Error('deriveGroupV1Data: had falsey id');
    }

    const { id } = group;
    if (id.byteLength !== GROUPV1_ID_LENGTH) {
      throw new Error(
        `deriveGroupV1Data: had id with wrong byteLength: ${id.byteLength}`
      );
    }
  }

  getProcessedGroupId(message: ProcessedDataMessage): string | undefined {
    if (message.groupV2) {
      return message.groupV2.id;
    }
    if (message.group && message.group.id) {
      return message.group.id;
    }
    return undefined;
  }

  getGroupId(message: Proto.IDataMessage): string | undefined {
    if (message.groupV2) {
      strictAssert(message.groupV2.masterKey, 'Missing groupV2.masterKey');
      const { id } = deriveGroupFields(message.groupV2.masterKey);
      return Bytes.toBase64(id);
    }
    if (message.group && message.group.id) {
      return Bytes.toBinary(message.group.id);
    }

    return undefined;
  }

  getDestination(sentMessage: Proto.SyncMessage.ISent) {
    if (sentMessage.message && sentMessage.message.groupV2) {
      return `groupv2(${this.getGroupId(sentMessage.message)})`;
    }
    if (sentMessage.message && sentMessage.message.group) {
      strictAssert(sentMessage.message.group.id, 'group without id');
      return `group(${this.getGroupId(sentMessage.message)})`;
    }
    return sentMessage.destination || sentMessage.destinationUuid;
  }

  async handleSyncMessage(
    envelope: ProcessedEnvelope,
    syncMessage: ProcessedSyncMessage
  ): Promise<void> {
    const fromSelfSource =
      envelope.source && envelope.source === this.number_id;
    const fromSelfSourceUuid =
      envelope.sourceUuid && envelope.sourceUuid === this.uuid_id;
    if (!fromSelfSource && !fromSelfSourceUuid) {
      throw new Error('Received sync message from another number');
    }
    // eslint-disable-next-line eqeqeq
    if (envelope.sourceDevice == this.deviceId) {
      throw new Error('Received sync message from our own device');
    }
    if (syncMessage.sent) {
      const sentMessage = syncMessage.sent;

      if (!sentMessage || !sentMessage.message) {
        throw new Error(
          'MessageReceiver.handleSyncMessage: sync sent message was missing message'
        );
      }

      if (this.isInvalidGroupData(sentMessage.message, envelope)) {
        this.removeFromCache(envelope);
        return undefined;
      }

      await this.checkGroupV1Data(sentMessage.message);

      strictAssert(sentMessage.timestamp, 'sent message without timestamp');

      window.log.info(
        'sent message to',
        this.getDestination(sentMessage),
        normalizeNumber(sentMessage.timestamp),
        'from',
        this.getEnvelopeId(envelope)
      );
      return this.handleSentMessage(envelope, sentMessage);
    }
    if (syncMessage.contacts) {
      this.handleContacts(envelope, syncMessage.contacts);
      return undefined;
    }
    if (syncMessage.groups) {
      this.handleGroups(envelope, syncMessage.groups);
      return undefined;
    }
    if (syncMessage.blocked) {
      return this.handleBlocked(envelope, syncMessage.blocked);
    }
    if (syncMessage.request) {
      window.log.info('Got SyncMessage Request');
      this.removeFromCache(envelope);
      return undefined;
    }
    if (syncMessage.read && syncMessage.read.length) {
      return this.handleRead(envelope, syncMessage.read);
    }
    if (syncMessage.verified) {
      return this.handleVerified(envelope, syncMessage.verified);
    }
    if (syncMessage.configuration) {
      return this.handleConfiguration(envelope, syncMessage.configuration);
    }
    if (
      syncMessage.stickerPackOperation &&
      syncMessage.stickerPackOperation.length > 0
    ) {
      return this.handleStickerPackOperation(
        envelope,
        syncMessage.stickerPackOperation
      );
    }
    if (syncMessage.viewOnceOpen) {
      return this.handleViewOnceOpen(envelope, syncMessage.viewOnceOpen);
    }
    if (syncMessage.messageRequestResponse) {
      return this.handleMessageRequestResponse(
        envelope,
        syncMessage.messageRequestResponse
      );
    }
    if (syncMessage.fetchLatest) {
      return this.handleFetchLatest(envelope, syncMessage.fetchLatest);
    }
    if (syncMessage.keys) {
      return this.handleKeys(envelope, syncMessage.keys);
    }

    this.removeFromCache(envelope);
    window.log.warn(
      `handleSyncMessage/${this.getEnvelopeId(envelope)}: Got empty SyncMessage`
    );
    return Promise.resolve();
  }

  async handleConfiguration(
    envelope: ProcessedEnvelope,
    configuration: Proto.SyncMessage.IConfiguration
  ) {
    window.log.info('got configuration sync message');
    const ev = new ConfigurationEvent(
      configuration,
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(ev);
  }

  async handleViewOnceOpen(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IViewOnceOpen
  ) {
    window.log.info('got view once open sync message');

    const ev = new ViewSyncEvent(
      {
        source: dropNull(sync.sender),
        sourceUuid: sync.senderUuid
          ? normalizeUuid(sync.senderUuid, 'handleViewOnceOpen.senderUuid')
          : undefined,
        timestamp: sync.timestamp ? normalizeNumber(sync.timestamp) : undefined,
      },
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(ev);
  }

  async handleMessageRequestResponse(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IMessageRequestResponse
  ) {
    window.log.info('got message request response sync message');

    const { groupId } = sync;

    let groupIdString: string | undefined;
    let groupV2IdString: string | undefined;
    if (groupId && groupId.byteLength > 0) {
      if (groupId.byteLength === GROUPV1_ID_LENGTH) {
        groupIdString = Bytes.toBinary(groupId);
        groupV2IdString = await this.deriveGroupV2FromV1(groupId);
      } else if (groupId.byteLength === GROUPV2_ID_LENGTH) {
        groupV2IdString = Bytes.toBase64(groupId);
      } else {
        this.removeFromCache(envelope);
        window.log.error('Received message request with invalid groupId');
        return undefined;
      }
    }

    const ev = new MessageRequestResponseEvent(
      {
        threadE164: dropNull(sync.threadE164),
        threadUuid: sync.threadUuid
          ? normalizeUuid(
              sync.threadUuid,
              'handleMessageRequestResponse.threadUuid'
            )
          : undefined,
        messageRequestResponseType: sync.type,
        groupId: groupIdString,
        groupV2Id: groupV2IdString,
      },
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(ev);
  }

  async handleFetchLatest(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IFetchLatest
  ) {
    window.log.info('got fetch latest sync message');

    const ev = new FetchLatestEvent(
      sync.type,
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(ev);
  }

  async handleKeys(envelope: ProcessedEnvelope, sync: Proto.SyncMessage.IKeys) {
    window.log.info('got keys sync message');

    if (!sync.storageService) {
      return undefined;
    }

    const ev = new KeysEvent(
      typedArrayToArrayBuffer(sync.storageService),
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(ev);
  }

  async handleStickerPackOperation(
    envelope: ProcessedEnvelope,
    operations: Array<Proto.SyncMessage.IStickerPackOperation>
  ) {
    const ENUM = Proto.SyncMessage.StickerPackOperation.Type;
    window.log.info('got sticker pack operation sync message');

    const stickerPacks = operations.map(operation => ({
      id: operation.packId ? Bytes.toHex(operation.packId) : undefined,
      key: operation.packKey ? Bytes.toBase64(operation.packKey) : undefined,
      isInstall: operation.type === ENUM.INSTALL,
      isRemove: operation.type === ENUM.REMOVE,
    }));

    const ev = new StickerPackEvent(
      stickerPacks,
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(ev);
  }

  async handleVerified(envelope: ProcessedEnvelope, verified: Proto.IVerified) {
    const ev = new VerifiedEvent(
      {
        state: verified.state,
        destination: dropNull(verified.destination),
        destinationUuid: verified.destinationUuid
          ? normalizeUuid(
              verified.destinationUuid,
              'handleVerified.destinationUuid'
            )
          : undefined,
        identityKey: verified.identityKey
          ? typedArrayToArrayBuffer(verified.identityKey)
          : undefined,
      },
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(ev);
  }

  async handleRead(
    envelope: ProcessedEnvelope,
    read: Array<Proto.SyncMessage.IRead>
  ): Promise<void> {
    window.log.info('MessageReceiver.handleRead', this.getEnvelopeId(envelope));
    const results = [];
    for (const { timestamp, sender, senderUuid } of read) {
      const ev = new ReadSyncEvent(
        {
          envelopeTimestamp: envelope.timestamp,
          timestamp: normalizeNumber(dropNull(timestamp)),
          sender: dropNull(sender),
          senderUuid: senderUuid
            ? normalizeUuid(senderUuid, 'handleRead.senderUuid')
            : undefined,
        },
        this.removeFromCache.bind(this, envelope)
      );
      results.push(this.dispatchAndWait(ev));
    }
    await Promise.all(results);
  }

  async handleContacts(
    envelope: ProcessedEnvelope,
    contacts: Proto.SyncMessage.IContacts
  ) {
    window.log.info('contact sync');
    const { blob } = contacts;
    if (!blob) {
      throw new Error('MessageReceiver.handleContacts: blob field was missing');
    }

    this.removeFromCache(envelope);

    // Note: we do not return here because we don't want to block the next message on
    //   this attachment download and a lot of processing of that attachment.
    const attachmentPointer = await this.handleAttachment(blob);
    const results = [];
    const contactBuffer = new ContactBuffer(attachmentPointer.data);
    let contactDetails = contactBuffer.next();
    while (contactDetails !== undefined) {
      const contactEvent = new ContactEvent(contactDetails);
      results.push(this.dispatchAndWait(contactEvent));

      contactDetails = contactBuffer.next();
    }

    const finalEvent = new ContactSyncEvent();
    results.push(this.dispatchAndWait(finalEvent));

    await Promise.all(results);

    window.log.info('handleContacts: finished');
  }

  async handleGroups(
    envelope: ProcessedEnvelope,
    groups: Proto.SyncMessage.IGroups
  ): Promise<void> {
    window.log.info('group sync');
    const { blob } = groups;

    this.removeFromCache(envelope);

    if (!blob) {
      throw new Error('MessageReceiver.handleGroups: blob field was missing');
    }

    // Note: we do not return here because we don't want to block the next message on
    //   this attachment download and a lot of processing of that attachment.
    const attachmentPointer = await this.handleAttachment(blob);
    const groupBuffer = new GroupBuffer(attachmentPointer.data);
    let groupDetails = groupBuffer.next() as any;
    const promises = [];
    while (groupDetails) {
      strictAssert(groupDetails.id, 'Group details without id');
      groupDetails.id = Bytes.toBinary(groupDetails.id);
      const ev = new GroupEvent(groupDetails);
      const promise = this.dispatchAndWait(ev).catch(e => {
        window.log.error('error processing group', e);
      });
      groupDetails = groupBuffer.next();
      promises.push(promise);
    }

    await Promise.all(promises);

    const ev = new GroupSyncEvent();
    return this.dispatchAndWait(ev);
  }

  async handleBlocked(
    envelope: ProcessedEnvelope,
    blocked: Proto.SyncMessage.IBlocked
  ) {
    window.log.info('Setting these numbers as blocked:', blocked.numbers);
    if (blocked.numbers) {
      await window.textsecure.storage.put('blocked', blocked.numbers);
    }
    if (blocked.uuids) {
      const uuids = blocked.uuids.map((uuid, index) => {
        return normalizeUuid(uuid, `handleBlocked.uuids.${index}`);
      });
      window.log.info('Setting these uuids as blocked:', uuids);
      await window.textsecure.storage.put('blocked-uuids', uuids);
    }

    const groupIds = map(blocked.groupIds, groupId => Bytes.toBinary(groupId));
    window.log.info(
      'Setting these groups as blocked:',
      groupIds.map(groupId => `group(${groupId})`)
    );
    await window.textsecure.storage.put('blocked-groups', groupIds);

    this.removeFromCache(envelope);
  }

  isBlocked(number: string) {
    return window.textsecure.storage.blocked.isBlocked(number);
  }

  isUuidBlocked(uuid: string) {
    return window.textsecure.storage.blocked.isUuidBlocked(uuid);
  }

  isGroupBlocked(groupId: string) {
    return window.textsecure.storage.blocked.isGroupBlocked(groupId);
  }

  async downloadAttachment(
    attachment: ProcessedAttachment
  ): Promise<DownloadedAttachmentType> {
    const cdnId = attachment.cdnId || attachment.cdnKey;
    const { cdnNumber } = attachment;

    if (!cdnId) {
      throw new Error('downloadAttachment: Attachment was missing cdnId!');
    }

    strictAssert(cdnId, 'attachment without cdnId');
    const encrypted = await this.server.getAttachment(
      cdnId,
      dropNull(cdnNumber)
    );
    const { key, digest, size, contentType } = attachment;

    if (!digest) {
      throw new Error('Failure: Ask sender to update Signal and resend.');
    }

    strictAssert(key, 'attachment has no key');
    strictAssert(digest, 'attachment has no digest');

    const paddedData = await Crypto.decryptAttachment(
      encrypted,
      typedArrayToArrayBuffer(Bytes.fromBase64(key)),
      typedArrayToArrayBuffer(Bytes.fromBase64(digest))
    );

    if (!isNumber(size)) {
      throw new Error(
        `downloadAttachment: Size was not provided, actual size was ${paddedData.byteLength}`
      );
    }

    const data = window.Signal.Crypto.getFirstBytes(paddedData, size);

    return {
      ...omit(attachment, 'digest', 'key'),

      contentType: contentType
        ? MIME.fromString(contentType)
        : MIME.APPLICATION_OCTET_STREAM,
      data,
    };
  }

  async handleAttachment(
    attachment: Proto.IAttachmentPointer
  ): Promise<DownloadedAttachmentType> {
    const cleaned = processAttachment(attachment);
    return this.downloadAttachment(cleaned);
  }

  async handleEndSession(identifier: string) {
    window.log.info(`handleEndSession: closing sessions for ${identifier}`);
    await window.textsecure.storage.protocol.archiveAllSessions(identifier);
  }

  async processDecrypted(
    envelope: ProcessedEnvelope,
    decrypted: Proto.IDataMessage
  ): Promise<ProcessedDataMessage> {
    return processDataMessage(decrypted, envelope.timestamp);
  }
}

export default class MessageReceiver {
  private readonly inner: MessageReceiverInner;

  constructor(
    oldUsername: string,
    username: string,
    password: string,
    options: {
      serverTrustRoot: string;
      retryCached?: string;
      socket?: WebSocket;
    }
  ) {
    const inner = new MessageReceiverInner(
      oldUsername,
      username,
      password,
      options
    );
    this.inner = inner;

    this.close = inner.close.bind(inner);
    this.downloadAttachment = inner.downloadAttachment.bind(inner);
    this.getStatus = inner.getStatus.bind(inner);
    this.hasEmptied = inner.hasEmptied.bind(inner);
    this.stopProcessing = inner.stopProcessing.bind(inner);
    this.checkSocket = inner.checkSocket.bind(inner);
    this.unregisterBatchers = inner.unregisterBatchers.bind(inner);

    inner.connect(options.socket);
    this.getProcessedCount = () => inner.processedCount;
  }

  public addEventListener(
    name: 'reconnect',
    handler: (ev: ReconnectEvent) => void
  ): void;

  public addEventListener(
    name: 'empty',
    handler: (ev: EmptyEvent) => void
  ): void;

  public addEventListener(
    name: 'progress',
    handler: (ev: ProgressEvent) => void
  ): void;

  public addEventListener(
    name: 'typing',
    handler: (ev: TypingEvent) => void
  ): void;

  public addEventListener(
    name: 'error',
    handler: (ev: ErrorEvent) => void
  ): void;

  public addEventListener(
    name: 'delivery',
    handler: (ev: DeliveryEvent) => void
  ): void;

  public addEventListener(
    name: 'decryption-error',
    handler: (ev: DecryptionErrorEvent) => void
  ): void;

  public addEventListener(name: 'sent', handler: (ev: SentEvent) => void): void;

  public addEventListener(
    name: 'profileKeyUpdate',
    handler: (ev: ProfileKeyUpdateEvent) => void
  ): void;

  public addEventListener(
    name: 'message',
    handler: (ev: MessageEvent) => void
  ): void;

  public addEventListener(
    name: 'retry-request',
    handler: (ev: RetryRequestEvent) => void
  ): void;

  public addEventListener(name: 'read', handler: (ev: ReadEvent) => void): void;

  public addEventListener(
    name: 'configuration',
    handler: (ev: ConfigurationEvent) => void
  ): void;

  public addEventListener(
    name: 'viewSync',
    handler: (ev: ViewSyncEvent) => void
  ): void;

  public addEventListener(
    name: 'messageRequestResponse',
    handler: (ev: MessageRequestResponseEvent) => void
  ): void;

  public addEventListener(
    name: 'fetchLatest',
    handler: (ev: FetchLatestEvent) => void
  ): void;

  public addEventListener(name: 'keys', handler: (ev: KeysEvent) => void): void;

  public addEventListener(
    name: 'sticker-pack',
    handler: (ev: StickerPackEvent) => void
  ): void;

  public addEventListener(
    name: 'verified',
    handler: (ev: VerifiedEvent) => void
  ): void;

  public addEventListener(
    name: 'readSync',
    handler: (ev: ReadSyncEvent) => void
  ): void;

  public addEventListener(
    name: 'contact',
    handler: (ev: ContactEvent) => void
  ): void;

  public addEventListener(
    name: 'contactSync',
    handler: (ev: ContactSyncEvent) => void
  ): void;

  public addEventListener(
    name: 'group',
    handler: (ev: GroupEvent) => void
  ): void;

  public addEventListener(
    name: 'groupSync',
    handler: (ev: GroupSyncEvent) => void
  ): void;

  public addEventListener(name: string, handler: EventHandler): void {
    return this.inner.addEventListener(name, handler);
  }

  public removeEventListener(name: string, handler: EventHandler): void {
    return this.inner.removeEventListener(name, handler);
  }

  close: () => Promise<void>;

  downloadAttachment: (
    attachment: ProcessedAttachment
  ) => Promise<DownloadedAttachmentType>;

  getStatus: () => SocketStatus;

  hasEmptied: () => boolean;

  stopProcessing: () => Promise<void>;

  unregisterBatchers: () => void;

  checkSocket: () => void;

  getProcessedCount: () => number;
}
