// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-bitwise */

import { isBoolean, isNumber, isString, noop, omit } from 'lodash';
import PQueue from 'p-queue';
import { v4 as getGuid } from 'uuid';

import type {
  SealedSenderDecryptionResult,
  SenderCertificate,
  UnidentifiedSenderMessageContent,
} from '@signalapp/libsignal-client';
import {
  ContentHint,
  CiphertextMessageType,
  DecryptionErrorMessage,
  groupDecrypt,
  PlaintextContent,
  PreKeySignalMessage,
  Pni,
  processSenderKeyDistributionMessage,
  ProtocolAddress,
  PublicKey,
  sealedSenderDecryptMessage,
  sealedSenderDecryptToUsmc,
  SenderKeyDistributionMessage,
  signalDecrypt,
  signalDecryptPreKey,
  SignalMessage,
} from '@signalapp/libsignal-client';

import {
  IdentityKeys,
  KyberPreKeys,
  PreKeys,
  SenderKeys,
  Sessions,
  SignedPreKeys,
} from '../LibSignalStores';
import { verifySignature } from '../Curve';
import { strictAssert, assertDev } from '../util/assert';
import type { BatcherType } from '../util/batcher';
import { createBatcher } from '../util/batcher';
import { drop } from '../util/drop';
import { dropNull } from '../util/dropNull';
import { parseIntOrThrow } from '../util/parseIntOrThrow';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { Zone } from '../util/Zone';
import { DurationInSeconds, SECOND } from '../util/durations';
import type { AttachmentType } from '../types/Attachment';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { normalizeStoryDistributionId } from '../types/StoryDistributionId';
import type { ServiceIdString } from '../types/ServiceId';
import {
  ServiceIdKind,
  normalizeServiceId,
  normalizePni,
  isPniString,
  isUntaggedPniString,
  isServiceIdString,
  fromPniObject,
  toTaggedPni,
} from '../types/ServiceId';
import { normalizeAci } from '../util/normalizeAci';
import { isAciString } from '../util/isAciString';
import * as Errors from '../types/errors';

import { SignalService as Proto } from '../protobuf';
import { deriveGroupFields, MASTER_KEY_LENGTH } from '../groups';

import createTaskWithTimeout from './TaskWithTimeout';
import {
  processAttachment,
  processDataMessage,
  processPreview,
  processGroupV2Context,
} from './processDataMessage';
import { processSyncMessage } from './processSyncMessage';
import type { EventHandler } from './EventTarget';
import EventTarget from './EventTarget';
import { downloadAttachment } from './downloadAttachment';
import type { IncomingWebSocketRequest } from './WebsocketResources';
import { parseContactsV2 } from './ContactsParser';
import type { WebAPIType } from './WebAPI';
import type { Storage } from './Storage';
import { WarnOnlyError } from './Errors';
import * as Bytes from '../Bytes';
import type {
  ProcessedAttachment,
  ProcessedDataMessage,
  ProcessedPreview,
  ProcessedSyncMessage,
  ProcessedSent,
  ProcessedEnvelope,
  IRequestHandler,
  UnprocessedType,
} from './Types.d';
import {
  CallEventSyncEvent,
  EmptyEvent,
  EnvelopeQueuedEvent,
  EnvelopeUnsealedEvent,
  ProgressEvent,
  TypingEvent,
  ErrorEvent,
  DeliveryEvent,
  DecryptionErrorEvent,
  SentEvent,
  ProfileKeyUpdateEvent,
  InvalidPlaintextEvent,
  MessageEvent,
  RetryRequestEvent,
  ReadEvent,
  ViewEvent,
  ConfigurationEvent,
  ViewOnceOpenSyncEvent,
  MessageRequestResponseEvent,
  FetchLatestEvent,
  KeysEvent,
  StickerPackEvent,
  ReadSyncEvent,
  ViewSyncEvent,
  ContactSyncEvent,
  StoryRecipientUpdateEvent,
  CallLogEventSyncEvent,
  CallLinkUpdateSyncEvent,
  DeleteForMeSyncEvent,
} from './messageReceiverEvents';
import type {
  MessageToDelete,
  DeleteForMeSyncEventData,
  DeleteForMeSyncTarget,
  ConversationToDelete,
  ViewSyncEventData,
  ReadSyncEventData,
} from './messageReceiverEvents';
import * as log from '../logging/log';
import * as durations from '../util/durations';
import { areArraysMatchingSets } from '../util/areArraysMatchingSets';
import { generateBlurHash } from '../util/generateBlurHash';
import { TEXT_ATTACHMENT } from '../types/MIME';
import type { SendTypesType } from '../util/handleMessageSend';
import { getStoriesBlocked } from '../util/stories';
import { isNotNil } from '../util/isNotNil';
import { chunk } from '../util/iterables';
import { inspectUnknownFieldTags } from '../util/inspectProtobufs';
import { incrementMessageCounter } from '../util/incrementMessageCounter';
import { filterAndClean } from '../types/BodyRange';
import {
  getCallEventForProto,
  getCallLogEventForProto,
} from '../util/callDisposition';
import { checkOurPniIdentityKey } from '../util/checkOurPniIdentityKey';
import { CallLinkUpdateSyncType } from '../types/CallLink';
import { bytesToUuid } from '../util/uuidToBytes';

const GROUPV2_ID_LENGTH = 32;
const RETRY_TIMEOUT = 2 * 60 * 1000;

type UnsealedEnvelope = Readonly<
  Omit<ProcessedEnvelope, 'sourceServiceId'> & {
    sourceServiceId: ServiceIdString;
    unidentifiedDeliveryReceived?: boolean;
    contentHint?: number;
    groupId?: string;
    cipherTextBytes?: Uint8Array;
    cipherTextType?: number;
    certificate?: SenderCertificate;
    unsealedContent?: UnidentifiedSenderMessageContent;
  }
>;

type DecryptResult = Readonly<
  | {
      envelope: UnsealedEnvelope;
      plaintext: Uint8Array;
    }
  | {
      envelope?: UnsealedEnvelope;
      plaintext?: undefined;
    }
>;

type DecryptSealedSenderResult = Readonly<{
  plaintext?: Uint8Array;
  unsealedPlaintext?: SealedSenderDecryptionResult;
  wasEncrypted: boolean;
}>;

type InnerDecryptResultType = Readonly<{
  plaintext: Uint8Array;
  wasEncrypted: boolean;
}>;

type CacheAddItemType = {
  envelope: ProcessedEnvelope;
  data: UnprocessedType;
  request: Pick<IncomingWebSocketRequest, 'respond'>;
};

type LockedStores = {
  readonly senderKeyStore: SenderKeys;
  readonly sessionStore: Sessions;
  readonly identityKeyStore: IdentityKeys;
  readonly zone?: Zone;
};

enum TaskType {
  Encrypted = 'Encrypted',
  Decrypted = 'Decrypted',
}

export type MessageReceiverOptions = {
  server: WebAPIType;
  storage: Storage;
  serverTrustRoot: string;
};

const TASK_WITH_TIMEOUT_OPTIONS = {
  timeout: 2 * durations.MINUTE,
};

const LOG_UNEXPECTED_URGENT_VALUES = false;
const MUST_BE_URGENT_TYPES: Array<SendTypesType> = [
  'message',
  'deleteForEveryone',
  'reaction',
  'readSync',
];
const CAN_BE_URGENT_TYPES: Array<SendTypesType> = [
  'callingMessage',
  'senderKeyDistributionMessage',

  // Deprecated
  'resetSession',
  'legacyGroupChange',
];

function logUnexpectedUrgentValue(
  envelope: ProcessedEnvelope,
  type: SendTypesType
) {
  if (!LOG_UNEXPECTED_URGENT_VALUES) {
    return;
  }

  const mustBeUrgent = MUST_BE_URGENT_TYPES.includes(type);
  const canBeUrgent = mustBeUrgent || CAN_BE_URGENT_TYPES.includes(type);

  if (envelope.urgent && !canBeUrgent) {
    const envelopeId = getEnvelopeId(envelope);
    log.warn(
      `${envelopeId}: Message of type '${type}' was marked urgent, but shouldn't be!`
    );
  }
  if (!envelope.urgent && mustBeUrgent) {
    const envelopeId = getEnvelopeId(envelope);
    log.warn(
      `${envelopeId}: Message of type '${type}' wasn't marked urgent, but should be!`
    );
  }
}

function getEnvelopeId(envelope: ProcessedEnvelope): string {
  const { timestamp } = envelope;

  let prefix = '';

  if (envelope.sourceServiceId || envelope.source) {
    const sender = envelope.sourceServiceId || envelope.source;
    prefix += `${sender}.${envelope.sourceDevice} `;
  }

  prefix += `> ${envelope.destinationServiceId}`;

  return `${prefix} ${timestamp} (${envelope.id})`;
}

/* eslint-disable @typescript-eslint/brace-style -- Prettier conflicts with ESLint */
export default class MessageReceiver
  extends EventTarget
  implements IRequestHandler
{
  /* eslint-enable @typescript-eslint/brace-style */

  private server: WebAPIType;

  private storage: Storage;

  private appQueue: PQueue;

  private decryptAndCacheBatcher: BatcherType<CacheAddItemType>;

  private cacheRemoveBatcher: BatcherType<string>;

  private count: number;

  private processedCount: number;

  private incomingQueue: PQueue;

  private isEmptied?: boolean;

  private encryptedQueue: PQueue;

  private decryptedQueue: PQueue;

  private retryCachedTimeout: NodeJS.Timeout | undefined;

  private serverTrustRoot: Uint8Array;

  private stoppingProcessing?: boolean;

  private pniIdentityKeyCheckRequired?: boolean;

  private isAppReadyForProcessing: boolean = false;

  constructor({ server, storage, serverTrustRoot }: MessageReceiverOptions) {
    super();

    this.server = server;
    this.storage = storage;

    this.count = 0;
    this.processedCount = 0;

    if (!serverTrustRoot) {
      throw new Error('Server trust root is required!');
    }
    this.serverTrustRoot = Bytes.fromBase64(serverTrustRoot);

    this.incomingQueue = new PQueue({
      concurrency: 1,
      throwOnTimeout: true,
    });
    this.appQueue = new PQueue({
      concurrency: 1,
      throwOnTimeout: true,
    });

    // All envelopes start in encryptedQueue and progress to decryptedQueue
    this.encryptedQueue = new PQueue({
      concurrency: 1,
      throwOnTimeout: true,
    });
    this.decryptedQueue = new PQueue({
      concurrency: 1,
      throwOnTimeout: true,
    });

    this.decryptAndCacheBatcher = createBatcher<CacheAddItemType>({
      name: 'MessageReceiver.decryptAndCacheBatcher',
      wait: 75,
      maxSize: 30,
      processBatch: (items: Array<CacheAddItemType>) => {
        return this.decryptAndCacheBatch(items);
      },
    });
    this.cacheRemoveBatcher = createBatcher<string>({
      name: 'MessageReceiver.cacheRemoveBatcher',
      wait: 75,
      maxSize: 30,
      processBatch: this.cacheRemoveBatch.bind(this),
    });

    window.Whisper.events.on('app-ready-for-processing', () => {
      this.isAppReadyForProcessing = true;
      this.reset();
    });

    window.Whisper.events.on('online', () => {
      this.reset();
    });
  }

  public getAndResetProcessedCount(): number {
    const count = this.processedCount;
    this.processedCount = 0;
    return count;
  }

  public handleRequest(request: IncomingWebSocketRequest): void {
    // We do the message decryption here, instead of in the ordered pending queue,
    // to avoid exposing the time it took us to process messages through the time-to-ack.
    log.info('MessageReceiver: got request', request.verb, request.path);
    if (request.path !== '/api/v1/message') {
      request.respond(200, 'OK');

      if (request.verb === 'PUT' && request.path === '/api/v1/queue/empty') {
        drop(
          this.incomingQueue.add(
            createTaskWithTimeout(
              async () => {
                this.onEmpty();
              },
              'incomingQueue/onEmpty',
              TASK_WITH_TIMEOUT_OPTIONS
            )
          )
        );
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
        const serverTimestamp = decoded.serverTimestamp?.toNumber() ?? 0;

        const ourAci = this.storage.user.getCheckedAci();

        const envelope: ProcessedEnvelope = {
          // Make non-private envelope IDs dashless so they don't get redacted
          //   from logs
          id: getGuid().replace(/-/g, ''),
          receivedAtCounter: incrementMessageCounter(),
          receivedAtDate: Date.now(),
          // Calculate the message age (time on server).
          messageAgeSec: this.calculateMessageAge(headers, serverTimestamp),

          // Proto.Envelope fields
          type: decoded.type ?? Proto.Envelope.Type.UNKNOWN,
          sourceServiceId: decoded.sourceServiceId
            ? normalizeServiceId(
                decoded.sourceServiceId,
                'MessageReceiver.handleRequest.sourceServiceId'
              )
            : undefined,
          sourceDevice: decoded.sourceDevice ?? 1,
          destinationServiceId: decoded.destinationServiceId
            ? normalizeServiceId(
                decoded.destinationServiceId,
                'MessageReceiver.handleRequest.destinationServiceId'
              )
            : ourAci,
          updatedPni:
            decoded.updatedPni && isUntaggedPniString(decoded.updatedPni)
              ? normalizePni(
                  toTaggedPni(decoded.updatedPni),
                  'MessageReceiver.handleRequest.updatedPni'
                )
              : undefined,
          timestamp: decoded.timestamp?.toNumber() ?? 0,
          content: dropNull(decoded.content),
          serverGuid: decoded.serverGuid ?? getGuid(),
          serverTimestamp,
          urgent: isBoolean(decoded.urgent) ? decoded.urgent : true,
          story: decoded.story ?? false,
          reportingToken: decoded.reportingToken?.length
            ? decoded.reportingToken
            : undefined,
        };

        // After this point, decoding errors are not the server's
        //   fault, and we should handle them gracefully and tell the
        //   user they received an invalid message

        this.decryptAndCache(envelope, plaintext, request);
        this.processedCount += 1;
      } catch (e) {
        request.respond(500, 'Bad encrypted websocket message');
        log.error('Error handling incoming message:', Errors.toLogFormat(e));
        await this.dispatchAndWait('websocket request', new ErrorEvent(e));
      }
    };

    drop(
      this.incomingQueue.add(
        createTaskWithTimeout(
          job,
          'incomingQueue/websocket',
          TASK_WITH_TIMEOUT_OPTIONS
        )
      )
    );
  }

  public reset(): void {
    log.info('MessageReceiver.reset');
    this.count = 0;
    this.isEmptied = false;
    this.stoppingProcessing = false;

    if (!this.isAppReadyForProcessing) {
      log.info('MessageReceiver.reset: not ready yet, returning early');
      return;
    }

    drop(this.addCachedMessagesToQueue());
  }

  private addCachedMessagesToQueue(): Promise<void> {
    log.info('MessageReceiver.addCachedMessagesToQueue');
    return this.incomingQueue.add(
      createTaskWithTimeout(
        async () => this.queueAllCached(),
        'incomingQueue/queueAllCached',
        {
          timeout: 10 * durations.MINUTE,
        }
      )
    );
  }

  public stopProcessing(): void {
    log.info('MessageReceiver.stopProcessing');
    this.stoppingProcessing = true;
    this.isAppReadyForProcessing = false;
  }

  public hasEmptied(): boolean {
    return Boolean(this.isEmptied);
  }

  public async drain(): Promise<void> {
    const waitForEncryptedQueue = async () =>
      this.addToQueue(
        async () => {
          log.info('drained');
        },
        'drain/waitForDecrypted',
        TaskType.Decrypted
      );

    const waitForIncomingQueue = async () =>
      this.addToQueue(
        waitForEncryptedQueue,
        'drain/waitForEncrypted',
        TaskType.Encrypted
      );

    return this.incomingQueue.add(
      createTaskWithTimeout(
        waitForIncomingQueue,
        'drain/waitForIncoming',
        TASK_WITH_TIMEOUT_OPTIONS
      )
    );
  }

  //
  // EventTarget types
  //

  public override addEventListener(
    name: 'empty',
    handler: (ev: EmptyEvent) => void
  ): void;

  public override addEventListener(
    name: 'progress',
    handler: (ev: ProgressEvent) => void
  ): void;

  public override addEventListener(
    name: 'typing',
    handler: (ev: TypingEvent) => void
  ): void;

  public override addEventListener(
    name: 'error',
    handler: (ev: ErrorEvent) => void
  ): void;

  public override addEventListener(
    name: 'delivery',
    handler: (ev: DeliveryEvent) => void
  ): void;

  public override addEventListener(
    name: 'decryption-error',
    handler: (ev: DecryptionErrorEvent) => void
  ): void;

  public override addEventListener(
    name: 'invalid-plaintext',
    handler: (ev: InvalidPlaintextEvent) => void
  ): void;

  public override addEventListener(
    name: 'sent',
    handler: (ev: SentEvent) => void
  ): void;

  public override addEventListener(
    name: 'profileKeyUpdate',
    handler: (ev: ProfileKeyUpdateEvent) => void
  ): void;

  public override addEventListener(
    name: 'message',
    handler: (ev: MessageEvent) => void
  ): void;

  public override addEventListener(
    name: 'retry-request',
    handler: (ev: RetryRequestEvent) => void
  ): void;

  public override addEventListener(
    name: 'read',
    handler: (ev: ReadEvent) => void
  ): void;

  public override addEventListener(
    name: 'view',
    handler: (ev: ViewEvent) => void
  ): void;

  public override addEventListener(
    name: 'configuration',
    handler: (ev: ConfigurationEvent) => void
  ): void;

  public override addEventListener(
    name: 'viewOnceOpenSync',
    handler: (ev: ViewOnceOpenSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'messageRequestResponse',
    handler: (ev: MessageRequestResponseEvent) => void
  ): void;

  public override addEventListener(
    name: 'fetchLatest',
    handler: (ev: FetchLatestEvent) => void
  ): void;

  public override addEventListener(
    name: 'keys',
    handler: (ev: KeysEvent) => void
  ): void;

  public override addEventListener(
    name: 'sticker-pack',
    handler: (ev: StickerPackEvent) => void
  ): void;

  public override addEventListener(
    name: 'readSync',
    handler: (ev: ReadSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'viewSync',
    handler: (ev: ViewSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'contactSync',
    handler: (ev: ContactSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'envelopeQueued',
    handler: (ev: EnvelopeQueuedEvent) => void
  ): void;

  public override addEventListener(
    name: 'envelopeUnsealed',
    handler: (ev: EnvelopeUnsealedEvent) => void
  ): void;

  public override addEventListener(
    name: 'storyRecipientUpdate',
    handler: (ev: StoryRecipientUpdateEvent) => void
  ): void;

  public override addEventListener(
    name: 'callEventSync',
    handler: (ev: CallEventSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'callLinkUpdateSync',
    handler: (ev: CallLinkUpdateSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'callLogEventSync',
    handler: (ev: CallLogEventSyncEvent) => void
  ): void;

  public override addEventListener(
    name: 'deleteForMeSync',
    handler: (ev: DeleteForMeSyncEvent) => void
  ): void;

  public override addEventListener(name: string, handler: EventHandler): void {
    return super.addEventListener(name, handler);
  }

  public override removeEventListener(
    name: string,
    handler: EventHandler
  ): void {
    return super.removeEventListener(name, handler);
  }

  //
  // Private
  //

  private async dispatchAndWait(id: string, event: Event): Promise<void> {
    drop(
      this.appQueue.add(
        createTaskWithTimeout(
          async () => Promise.all(this.dispatchEvent(event)),
          `dispatchEvent(${event.type}, ${id})`,
          TASK_WITH_TIMEOUT_OPTIONS
        )
      )
    );
  }

  private calculateMessageAge(
    headers: ReadonlyArray<string>,
    serverTimestamp?: number
  ): number {
    let messageAgeSec = 0; // Default to 0 in case of unreliable parameters.

    if (serverTimestamp) {
      // The 'X-Signal-Timestamp' is usually the last item, so start there.
      let it = headers.length;
      // eslint-disable-next-line no-plusplus
      while (--it >= 0) {
        const match = headers[it].match(/^X-Signal-Timestamp:\s*(\d+)\s*$/i);
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

  private async addToQueue<T>(
    task: () => Promise<T>,
    id: string,
    taskType: TaskType
  ): Promise<T> {
    if (taskType === TaskType.Encrypted) {
      this.count += 1;
    }

    const queue =
      taskType === TaskType.Encrypted
        ? this.encryptedQueue
        : this.decryptedQueue;

    try {
      return await queue.add(
        createTaskWithTimeout(task, id, TASK_WITH_TIMEOUT_OPTIONS)
      );
    } finally {
      this.updateProgress(this.count);
    }
  }

  private onEmpty(): void {
    const emitEmpty = async () => {
      await Promise.all([
        this.decryptAndCacheBatcher.flushAndWait(),
        this.cacheRemoveBatcher.flushAndWait(),
      ]);

      if (this.pniIdentityKeyCheckRequired) {
        log.warn(
          "MessageReceiver: got 'empty' event, " +
            'running scheduled pni identity key check'
        );
        drop(checkOurPniIdentityKey());
      }
      this.pniIdentityKeyCheckRequired = false;

      log.info("MessageReceiver: emitting 'empty' event");
      this.dispatchEvent(new EmptyEvent());
      this.isEmptied = true;

      this.maybeScheduleRetryTimeout();
    };

    const waitForDecryptedQueue = async () => {
      log.info(
        "MessageReceiver: finished processing messages after 'empty', now waiting for application"
      );

      // We don't await here because we don't want this to gate future message processing
      drop(
        this.appQueue.add(
          createTaskWithTimeout(
            emitEmpty,
            'emitEmpty',
            TASK_WITH_TIMEOUT_OPTIONS
          )
        )
      );
    };

    const waitForEncryptedQueue = async () => {
      drop(
        this.addToQueue(
          waitForDecryptedQueue,
          'onEmpty/waitForDecrypted',
          TaskType.Decrypted
        )
      );
    };

    const waitForIncomingQueue = async () => {
      // Note: this.count is used in addToQueue
      // Resetting count so everything from the websocket after this starts at zero
      this.count = 0;

      drop(
        this.addToQueue(
          waitForEncryptedQueue,
          'onEmpty/waitForEncrypted',
          TaskType.Encrypted
        )
      );
    };

    const waitForCacheAddBatcher = async () => {
      await this.decryptAndCacheBatcher.onIdle();
      drop(
        this.incomingQueue.add(
          createTaskWithTimeout(
            waitForIncomingQueue,
            'onEmpty/waitForIncoming',
            TASK_WITH_TIMEOUT_OPTIONS
          )
        )
      );
    };

    drop(waitForCacheAddBatcher());
  }

  private updateProgress(count: number): void {
    // count by 10s
    if (count % 10 !== 0) {
      return;
    }
    this.dispatchEvent(new ProgressEvent({ count }));
  }

  private async queueAllCached(): Promise<void> {
    if (this.stoppingProcessing) {
      log.info(
        'MessageReceiver.queueAllCached: not running due to stopped processing'
      );
      return;
    }

    for await (const batch of this.getAllFromCache()) {
      const max = batch.length;
      for (let i = 0; i < max; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await this.queueCached(batch[i]);
      }
    }
    log.info('MessageReceiver.queueAllCached - finished');
  }

  private async queueCached(item: UnprocessedType): Promise<void> {
    log.info('MessageReceiver.queueCached', item.id);
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

      const ourAci = this.storage.user.getCheckedAci();

      const envelope: ProcessedEnvelope = {
        id: item.id,
        receivedAtCounter: item.receivedAtCounter ?? item.timestamp,
        receivedAtDate:
          item.receivedAtCounter == null ? Date.now() : item.timestamp,
        messageAgeSec: item.messageAgeSec || 0,

        // Proto.Envelope fields
        type: decoded.type ?? Proto.Envelope.Type.UNKNOWN,
        source: item.source,
        sourceServiceId: normalizeServiceId(
          item.sourceServiceId || decoded.sourceServiceId,
          'CachedEnvelope.sourceServiceId'
        ),
        sourceDevice: decoded.sourceDevice || item.sourceDevice,
        destinationServiceId: normalizeServiceId(
          decoded.destinationServiceId || item.destinationServiceId || ourAci,
          'CachedEnvelope.destinationServiceId'
        ),
        updatedPni: isUntaggedPniString(decoded.updatedPni)
          ? normalizePni(
              toTaggedPni(decoded.updatedPni),
              'CachedEnvelope.updatedPni'
            )
          : undefined,
        timestamp: decoded.timestamp?.toNumber() ?? 0,
        content: dropNull(decoded.content),
        serverGuid: decoded.serverGuid ?? getGuid(),
        serverTimestamp:
          item.serverTimestamp || decoded.serverTimestamp?.toNumber() || 0,
        urgent: isBoolean(item.urgent) ? item.urgent : true,
        story: Boolean(item.story),
        reportingToken: item.reportingToken
          ? Bytes.fromBase64(item.reportingToken)
          : undefined,
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

        strictAssert(
          envelope.sourceServiceId,
          'Decrypted envelope must have source uuid'
        );

        // Pacify typescript
        const decryptedEnvelope = {
          ...envelope,
          sourceServiceId: envelope.sourceServiceId,
        };

        // Maintain invariant: encrypted queue => decrypted queue
        const envelopeId = getEnvelopeId(decryptedEnvelope);
        const taskId = `queueCached(EnvelopeEvent(${envelopeId}))`;
        drop(
          this.addToQueue(
            async () =>
              this.dispatchAndWait(
                taskId,
                new EnvelopeQueuedEvent(decryptedEnvelope)
              ),
            taskId,
            TaskType.Decrypted
          )
        );
        drop(
          this.addToQueue(
            async () => {
              void this.queueDecryptedEnvelope(
                decryptedEnvelope,
                payloadPlaintext
              );
            },
            `queueDecryptedEnvelope(${getEnvelopeId(decryptedEnvelope)})`,
            TaskType.Encrypted
          )
        );
      } else {
        void this.queueCachedEnvelope(item, envelope);
      }
    } catch (error) {
      log.error(
        'queueCached error handling item',
        item.id,
        'removing it. Error:',
        Errors.toLogFormat(error)
      );

      try {
        const { id } = item;
        await this.storage.protocol.removeUnprocessed(id);
      } catch (deleteError) {
        log.error(
          'queueCached error deleting item',
          item.id,
          'Error:',
          Errors.toLogFormat(deleteError)
        );
      }
    }
  }

  private clearRetryTimeout(): void {
    clearTimeoutIfNecessary(this.retryCachedTimeout);
    this.retryCachedTimeout = undefined;
  }

  private maybeScheduleRetryTimeout(): void {
    if (this.isEmptied) {
      this.clearRetryTimeout();
      this.retryCachedTimeout = setTimeout(() => {
        drop(
          this.incomingQueue.add(
            createTaskWithTimeout(
              async () => this.queueAllCached(),
              'queueAllCached',
              TASK_WITH_TIMEOUT_OPTIONS
            )
          )
        );
      }, RETRY_TIMEOUT);
    }
  }

  private async *getAllFromCache(): AsyncIterable<Array<UnprocessedType>> {
    log.info('getAllFromCache');

    const ids = await this.storage.protocol.getAllUnprocessedIds();

    log.info(`getAllFromCache - ${ids.length} unprocessed`);

    for (const batch of chunk(ids, 1000)) {
      log.info(`getAllFromCache - yielding batch of ${batch.length}`);
      yield this.storage.protocol.getUnprocessedByIdsAndIncrementAttempts(
        batch
      );
    }
    log.info(`getAllFromCache - done retrieving ${ids.length} unprocessed`);
  }

  private async decryptAndCacheBatch(
    items: Array<CacheAddItemType>
  ): Promise<void> {
    log.info('MessageReceiver.decryptAndCacheBatch', items.length);

    const decrypted: Array<
      Readonly<{
        plaintext: Uint8Array;
        data: UnprocessedType;
        envelope: UnsealedEnvelope;
      }>
    > = [];

    const storageProtocol = this.storage.protocol;

    try {
      const zone = new Zone('decryptAndCacheBatch', {
        pendingSenderKeys: true,
        pendingSessions: true,
        pendingUnprocessed: true,
      });

      const storesMap = new Map<ServiceIdString, LockedStores>();
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
              const { destinationServiceId } = envelope;

              let stores = storesMap.get(destinationServiceId);
              if (!stores) {
                stores = {
                  senderKeyStore: new SenderKeys({
                    ourServiceId: destinationServiceId,
                    zone,
                  }),
                  sessionStore: new Sessions({
                    zone,
                    ourServiceId: destinationServiceId,
                  }),
                  identityKeyStore: new IdentityKeys({
                    zone,
                    ourServiceId: destinationServiceId,
                  }),
                  zone,
                };
                storesMap.set(destinationServiceId, stores);
              }

              const result = await this.queueEncryptedEnvelope(
                stores,
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
              log.error(
                'MessageReceiver.decryptAndCacheBatch error when ' +
                  'processing the envelope',
                Errors.toLogFormat(error)
              );
            }
          })
        );

        log.info(
          'MessageReceiver.decryptAndCacheBatch storing ' +
            `${decrypted.length} decrypted envelopes, keeping ` +
            `${failed.length} failed envelopes.`
        );

        // Store both decrypted and failed unprocessed envelopes
        const unprocesseds: Array<UnprocessedType> = decrypted.map(
          ({ envelope, data, plaintext }) => {
            return {
              ...data,

              source: envelope.source,
              sourceServiceId: envelope.sourceServiceId,
              sourceDevice: envelope.sourceDevice,
              destinationServiceId: envelope.destinationServiceId,
              updatedPni: envelope.updatedPni,
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

      log.info('MessageReceiver.decryptAndCacheBatch acknowledging receipt');

      // Acknowledge all envelopes
      for (const { request } of items) {
        try {
          request.respond(200, 'OK');
        } catch (error) {
          log.error(
            'decryptAndCacheBatch: Failed to send 200 to server; still queuing envelope'
          );
        }
      }
    } catch (error) {
      log.error(
        'decryptAndCache error trying to add messages to cache:',
        Errors.toLogFormat(error)
      );

      items.forEach(item => {
        item.request.respond(500, 'Failed to cache message');
      });
      return;
    }

    // Now, queue and process decrypted envelopes. We drop the promise so that the next
    // decryptAndCacheBatch batch does not have to wait for the decrypted envelopes to be
    // processed, which can be an asynchronous blocking operation
    drop(this.queueAllDecryptedEnvelopes(decrypted));
  }

  // The final step in decryptAndCacheBatch: queue the decrypted envelopes for processing
  private async queueAllDecryptedEnvelopes(
    decrypted: Array<Required<DecryptResult>>
  ): Promise<void> {
    await Promise.all(
      decrypted.map(async ({ envelope, plaintext }) => {
        try {
          await this.queueDecryptedEnvelope(envelope, plaintext);
        } catch (error) {
          log.error(
            'decryptAndCache error when processing decrypted envelope',
            Errors.toLogFormat(error)
          );
        }
      })
    );

    log.info('MessageReceiver.decryptAndCacheBatch fully processed');

    this.maybeScheduleRetryTimeout();
  }

  private decryptAndCache(
    envelope: ProcessedEnvelope,
    plaintext: Uint8Array,
    request: IncomingWebSocketRequest
  ): void {
    const { id } = envelope;
    const data: UnprocessedType = {
      id,
      version: 2,

      // This field is only used for aging items out of the cache. The original
      //   envelope's timestamp will be used when retrying this item.
      timestamp: envelope.receivedAtDate,

      attempts: 0,
      envelope: Bytes.toBase64(plaintext),
      messageAgeSec: envelope.messageAgeSec,
      receivedAtCounter: envelope.receivedAtCounter,
      urgent: envelope.urgent,
      story: envelope.story,
      reportingToken: envelope.reportingToken
        ? Bytes.toBase64(envelope.reportingToken)
        : undefined,
    };
    this.decryptAndCacheBatcher.add({
      request,
      envelope,
      data,
    });
  }

  private async cacheRemoveBatch(items: Array<string>): Promise<void> {
    await this.storage.protocol.removeUnprocessed(items);
  }

  private removeFromCache(envelope: ProcessedEnvelope): void {
    const { id } = envelope;
    this.cacheRemoveBatcher.add(id);
  }

  private async queueDecryptedEnvelope(
    envelope: UnsealedEnvelope,
    plaintext: Uint8Array
  ): Promise<void> {
    const id = getEnvelopeId(envelope);
    log.info('queueing decrypted envelope', id);

    const task = this.handleDecryptedEnvelope.bind(this, envelope, plaintext);
    const taskWithTimeout = createTaskWithTimeout(
      task,
      `queueDecryptedEnvelope ${id}`,
      TASK_WITH_TIMEOUT_OPTIONS
    );

    try {
      await this.addToQueue(
        taskWithTimeout,
        `handleDecryptedEnvelope(${id})`,
        TaskType.Decrypted
      );
    } catch (error) {
      log.error(
        `queueDecryptedEnvelope error handling envelope ${id}:`,
        Errors.toLogFormat(error)
      );
    }
  }

  private async queueEncryptedEnvelope(
    stores: LockedStores,
    envelope: ProcessedEnvelope
  ): Promise<DecryptResult> {
    let logId = getEnvelopeId(envelope);
    log.info('queueing envelope', logId);

    const task = async (): Promise<DecryptResult> => {
      const { destinationServiceId } = envelope;
      const serviceIdKind =
        this.storage.user.getOurServiceIdKind(destinationServiceId);
      if (serviceIdKind === ServiceIdKind.Unknown) {
        log.warn(
          'MessageReceiver.decryptAndCacheBatch: ' +
            `Rejecting envelope ${getEnvelopeId(envelope)}, ` +
            `unknown serviceId: ${destinationServiceId}`
        );
        return { plaintext: undefined, envelope: undefined };
      }

      const unsealedEnvelope = await this.unsealEnvelope(
        stores,
        envelope,
        serviceIdKind
      );

      // Dropped early
      if (!unsealedEnvelope) {
        return { plaintext: undefined, envelope: undefined };
      }

      logId = getEnvelopeId(unsealedEnvelope);

      const taskId = `dispatchEvent(EnvelopeUnsealedEvent(${logId}))`;
      drop(
        this.addToQueue(
          async () =>
            this.dispatchAndWait(
              taskId,
              new EnvelopeUnsealedEvent(unsealedEnvelope)
            ),
          taskId,
          TaskType.Decrypted
        )
      );

      return this.decryptEnvelope(stores, unsealedEnvelope, serviceIdKind);
    };

    try {
      return await this.addToQueue(
        task,
        `MessageReceiver: unseal and decrypt ${logId}`,
        TaskType.Encrypted
      );
    } catch (error) {
      const args = [
        'queueEncryptedEnvelope error handling envelope',
        logId,
        ':',
        Errors.toLogFormat(error),
      ];
      if (error instanceof WarnOnlyError) {
        log.warn(...args);
      } else {
        log.error(...args);
      }
      throw error;
    }
  }

  private async queueCachedEnvelope(
    data: UnprocessedType,
    envelope: ProcessedEnvelope
  ): Promise<void> {
    this.decryptAndCacheBatcher.add({
      request: {
        respond(code, status) {
          log.info(
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
  private async handleDecryptedEnvelope(
    envelope: UnsealedEnvelope,
    plaintext: Uint8Array
  ): Promise<void> {
    if (this.stoppingProcessing) {
      return;
    }

    if (!envelope.content) {
      this.removeFromCache(envelope);
      throw new Error('Received message with no content');
    }

    await this.innerHandleContentMessage(envelope, plaintext);
  }

  private async unsealEnvelope(
    stores: LockedStores,
    envelope: ProcessedEnvelope,
    serviceIdKind: ServiceIdKind
  ): Promise<UnsealedEnvelope | undefined> {
    const logId = getEnvelopeId(envelope);

    if (this.stoppingProcessing) {
      log.warn(`MessageReceiver.unsealEnvelope(${logId}): dropping`);
      throw new Error('Sealed envelope dropped due to stopping processing');
    }

    if (envelope.type !== Proto.Envelope.Type.UNIDENTIFIED_SENDER) {
      strictAssert(
        envelope.sourceServiceId,
        'Unsealed envelope must have source uuid'
      );
      return {
        ...envelope,
        sourceServiceId: envelope.sourceServiceId,
        cipherTextBytes: envelope.content,
        cipherTextType: envelopeTypeToCiphertextType(envelope.type),
      };
    }

    if (serviceIdKind === ServiceIdKind.PNI) {
      log.warn(`MessageReceiver.unsealEnvelope(${logId}): dropping for PNI`);
      return undefined;
    }

    strictAssert(
      serviceIdKind === ServiceIdKind.ACI,
      'Sealed non-ACI envelope'
    );

    const ciphertext = envelope.content;
    if (!ciphertext) {
      this.removeFromCache(envelope);
      throw new Error('Received message with no content');
    }

    log.info(`MessageReceiver.unsealEnvelope(${logId}): unidentified message`);
    const messageContent = await sealedSenderDecryptToUsmc(
      Buffer.from(ciphertext),
      stores.identityKeyStore
    );

    // Here we take this sender information and attach it back to the envelope
    //   to make the rest of the app work properly.
    const certificate = messageContent.senderCertificate();

    const originalSource = envelope.source;
    const originalSourceUuid = envelope.sourceServiceId;

    const newEnvelope: UnsealedEnvelope = {
      ...envelope,

      cipherTextBytes: messageContent.contents(),
      cipherTextType: messageContent.msgType(),

      // Overwrite Envelope fields
      source: dropNull(certificate.senderE164()),
      sourceServiceId: normalizeServiceId(
        certificate.senderUuid(),
        'MessageReceiver.unsealEnvelope.UNIDENTIFIED_SENDER.sourceServiceId'
      ),
      sourceDevice: certificate.senderDeviceId(),

      // UnsealedEnvelope-only fields
      unidentifiedDeliveryReceived: !(originalSource || originalSourceUuid),
      contentHint: messageContent.contentHint(),
      groupId: messageContent.groupId()?.toString('base64'),
      certificate,
      unsealedContent: messageContent,
    };

    // This will throw if there's a problem
    this.validateUnsealedEnvelope(newEnvelope);

    return newEnvelope;
  }

  private async decryptEnvelope(
    stores: LockedStores,
    envelope: UnsealedEnvelope,
    serviceIdKind: ServiceIdKind
  ): Promise<DecryptResult> {
    const logId = `MessageReceiver.decryptEnvelope(${getEnvelopeId(envelope)})`;

    if (this.stoppingProcessing) {
      log.warn(`${logId}: dropping unsealed`);
      throw new Error('Unsealed envelope dropped due to stopping processing');
    }

    if (envelope.type === Proto.Envelope.Type.RECEIPT) {
      strictAssert(
        envelope.sourceServiceId,
        'Unsealed delivery receipt must have sourceServiceId'
      );
      await this.onDeliveryReceipt(envelope);
      return { plaintext: undefined, envelope };
    }

    let ciphertext: Uint8Array;
    if (envelope.content) {
      ciphertext = envelope.content;
    } else {
      this.removeFromCache(envelope);
      strictAssert(
        false,
        'Contentless envelope should be handled by unsealEnvelope'
      );
    }

    log.info(logId);
    const decryptResult = await this.decrypt(
      stores,
      envelope,
      ciphertext,
      serviceIdKind
    );

    if (!decryptResult) {
      log.warn(`${logId}: plaintext was falsey`);
      return { plaintext: undefined, envelope };
    }

    const { plaintext, wasEncrypted } = decryptResult;

    // Note: we need to process this as part of decryption, because we might need this
    //   sender key to decrypt the next message in the queue!
    let isGroupV2 = false;

    let inProgressMessageType = '';
    try {
      const content = Proto.Content.decode(plaintext);
      if (!wasEncrypted && Bytes.isEmpty(content.decryptionErrorMessage)) {
        log.warn(
          `${logId}: dropping plaintext envelope without decryption error message`
        );

        const { sourceServiceId: senderAci } = envelope;
        strictAssert(isAciString(senderAci), 'Sender uuid must be an ACI');

        const event = new InvalidPlaintextEvent({
          senderDevice: envelope.sourceDevice ?? 1,
          senderAci,
          timestamp: envelope.timestamp,
        });

        this.removeFromCache(envelope);

        const envelopeId = getEnvelopeId(envelope);

        // Avoid deadlocks by scheduling processing on decrypted queue
        drop(
          this.addToQueue(
            async () => this.dispatchEvent(event),
            `decrypted/dispatchEvent/InvalidPlaintextEvent(${envelopeId})`,
            TaskType.Decrypted
          )
        );

        return { plaintext: undefined, envelope };
      }

      isGroupV2 =
        Boolean(content.dataMessage?.groupV2) ||
        Boolean(content.storyMessage?.group);

      if (
        wasEncrypted &&
        content.senderKeyDistributionMessage &&
        Bytes.isNotEmpty(content.senderKeyDistributionMessage)
      ) {
        inProgressMessageType = 'sender key distribution';
        await this.handleSenderKeyDistributionMessage(
          stores,
          envelope,
          content.senderKeyDistributionMessage
        );
      }

      const isStoryReply = Boolean(content.dataMessage?.storyContext);
      const isGroupStoryReply = Boolean(
        isStoryReply && content.dataMessage?.groupV2
      );
      const isStory = Boolean(content.storyMessage);
      const isDeleteForEveryone = Boolean(content.dataMessage?.delete);

      if (
        envelope.story &&
        !(isGroupStoryReply || isStory) &&
        !isDeleteForEveryone
      ) {
        log.warn(
          `${logId}: Dropping story message - story=true on envelope, but message was not a group story send or delete`
        );
        this.removeFromCache(envelope);
        return { plaintext: undefined, envelope };
      }

      if (!envelope.story && (isGroupStoryReply || isStory)) {
        log.warn(
          `${logId}: Malformed story - story=false on envelope, but was a group story send`
        );
      }

      const areStoriesBlocked = getStoriesBlocked();
      // Note that there are other story-related message types which aren't captured
      //   here. Look for other calls to getStoriesBlocked down-file.
      if (areStoriesBlocked && (isStoryReply || isStory)) {
        log.warn(
          `${logId}: Dropping story message - stories are disabled or unavailable`
        );
        this.removeFromCache(envelope);
        return { plaintext: undefined, envelope };
      }

      const sender = window.ConversationController.get(
        envelope.sourceServiceId || envelope.source
      );
      if (
        (isStoryReply || isStory) &&
        !isGroupV2 &&
        (!sender || !sender.get('profileSharing'))
      ) {
        log.warn(
          `${logId}: Dropping story message - !profileSharing for sender`
        );
        this.removeFromCache(envelope);
        return { plaintext: undefined, envelope };
      }

      if (wasEncrypted && content.pniSignatureMessage) {
        inProgressMessageType = 'pni signature';
        await this.handlePniSignatureMessage(
          envelope,
          content.pniSignatureMessage
        );
      }

      // Some sync messages have to be fully processed in the middle of
      // decryption queue since subsequent envelopes use their key material.
      const { syncMessage } = content;
      if (wasEncrypted && syncMessage?.pniChangeNumber) {
        inProgressMessageType = 'pni change number';
        await this.handlePNIChangeNumber(envelope, syncMessage.pniChangeNumber);
        this.removeFromCache(envelope);
        return { plaintext: undefined, envelope };
      }

      inProgressMessageType = '';
    } catch (error) {
      log.error(
        `${logId}: Failed to process ${inProgressMessageType} ` +
          `message: ${Errors.toLogFormat(error)}`
      );
    }

    if (
      (envelope.source && this.isBlocked(envelope.source)) ||
      (envelope.sourceServiceId &&
        this.isServiceIdBlocked(envelope.sourceServiceId))
    ) {
      log.info(`${logId}: Dropping message from blocked sender`);
      this.removeFromCache(envelope);
      return { plaintext: undefined, envelope };
    }

    return { plaintext, envelope };
  }

  private validateUnsealedEnvelope(envelope: UnsealedEnvelope): void {
    const { unsealedContent: messageContent, certificate } = envelope;
    strictAssert(
      messageContent !== undefined,
      'Missing message content for sealed sender message'
    );
    strictAssert(
      certificate !== undefined,
      'Missing sender certificate for sealed sender message'
    );

    if (!envelope.serverTimestamp) {
      throw new Error(
        'MessageReceiver.decryptSealedSender: ' +
          'Sealed sender message was missing serverTimestamp'
      );
    }

    const serverCertificate = certificate.serverCertificate();

    if (
      !verifySignature(
        this.serverTrustRoot,
        serverCertificate.certificateData(),
        serverCertificate.signature()
      )
    ) {
      throw new Error(
        'MessageReceiver.validateUnsealedEnvelope: ' +
          'Server certificate trust root validation failed'
      );
    }

    if (
      !verifySignature(
        serverCertificate.key().serialize(),
        certificate.certificate(),
        certificate.signature()
      )
    ) {
      throw new Error(
        'MessageReceiver.validateUnsealedEnvelope: ' +
          'Server certificate server signature validation failed'
      );
    }

    const logId = getEnvelopeId(envelope);

    if (envelope.serverTimestamp > certificate.expiration()) {
      throw new Error(
        'MessageReceiver.validateUnsealedEnvelope: ' +
          `Sender certificate is expired for envelope ${logId}, ` +
          `serverTimestamp: ${envelope.serverTimestamp}, ` +
          `expiration: ${certificate.expiration()}`
      );
    }

    return undefined;
  }

  private async onDeliveryReceipt(envelope: ProcessedEnvelope): Promise<void> {
    logUnexpectedUrgentValue(envelope, 'deliveryReceipt');

    await this.dispatchAndWait(
      getEnvelopeId(envelope),
      new DeliveryEvent(
        [
          {
            timestamp: envelope.timestamp,
            source: envelope.source,
            sourceServiceId: envelope.sourceServiceId,
            sourceDevice: envelope.sourceDevice,
            wasSentEncrypted: false,
          },
        ],
        envelope.id,
        envelope.timestamp,
        this.removeFromCache.bind(this, envelope)
      )
    );
  }

  private unpad(paddedPlaintext: Uint8Array): Uint8Array {
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
    { senderKeyStore, sessionStore, identityKeyStore, zone }: LockedStores,
    envelope: UnsealedEnvelope,
    ciphertext: Uint8Array
  ): Promise<DecryptSealedSenderResult> {
    const localE164 = this.storage.user.getNumber();
    const { destinationServiceId } = envelope;
    const localDeviceId = parseIntOrThrow(
      this.storage.user.getDeviceId(),
      'MessageReceiver.decryptSealedSender: localDeviceId'
    );

    const logId = getEnvelopeId(envelope);

    const { unsealedContent: messageContent, certificate } = envelope;
    strictAssert(
      messageContent !== undefined,
      'Missing message content for sealed sender message'
    );
    strictAssert(
      certificate !== undefined,
      'Missing sender certificate for sealed sender message'
    );

    const unidentifiedSenderTypeEnum =
      Proto.UnidentifiedSenderMessage.Message.Type;

    if (
      messageContent.msgType() === unidentifiedSenderTypeEnum.PLAINTEXT_CONTENT
    ) {
      log.info(
        `MessageReceiver.decryptSealedSender(${logId}): ` +
          'unidentified message/plaintext contents'
      );
      const plaintextContent = PlaintextContent.deserialize(
        messageContent.contents()
      );

      return {
        plaintext: plaintextContent.body(),
        wasEncrypted: false,
      };
    }

    if (
      messageContent.msgType() === unidentifiedSenderTypeEnum.SENDERKEY_MESSAGE
    ) {
      log.info(
        `MessageReceiver.decryptSealedSender(${logId}): ` +
          'unidentified message/sender key contents'
      );
      const sealedSenderIdentifier = certificate.senderUuid();
      const sealedSenderSourceDevice = certificate.senderDeviceId();

      strictAssert(
        isServiceIdString(sealedSenderIdentifier),
        'Sealed sender identifier is service id'
      );
      const address = new QualifiedAddress(
        destinationServiceId,
        Address.create(sealedSenderIdentifier, sealedSenderSourceDevice)
      );

      const plaintext = await this.storage.protocol.enqueueSenderKeyJob(
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
      return { plaintext, wasEncrypted: true };
    }

    log.info(
      `MessageReceiver.decryptSealedSender(${logId}): ` +
        'unidentified message/passing to sealedSenderDecryptMessage'
    );

    const preKeyStore = new PreKeys({ ourServiceId: destinationServiceId });
    const signedPreKeyStore = new SignedPreKeys({
      ourServiceId: destinationServiceId,
    });
    const kyberPreKeyStore = new KyberPreKeys({
      ourServiceId: destinationServiceId,
    });

    const sealedSenderIdentifier = envelope.sourceServiceId;
    strictAssert(
      sealedSenderIdentifier !== undefined,
      'Empty sealed sender identifier'
    );
    strictAssert(
      envelope.sourceDevice !== undefined,
      'Empty sealed sender device'
    );
    const address = new QualifiedAddress(
      destinationServiceId,
      Address.create(sealedSenderIdentifier, envelope.sourceDevice)
    );
    const unsealedPlaintext = await this.storage.protocol.enqueueSessionJob(
      address,
      `sealedSenderDecryptMessage(${address.toString()})`,
      () =>
        sealedSenderDecryptMessage(
          Buffer.from(ciphertext),
          PublicKey.deserialize(Buffer.from(this.serverTrustRoot)),
          envelope.serverTimestamp,
          localE164 || null,
          destinationServiceId,
          localDeviceId,
          sessionStore,
          identityKeyStore,
          preKeyStore,
          signedPreKeyStore,
          kyberPreKeyStore
        ),
      zone
    );

    return { unsealedPlaintext, wasEncrypted: true };
  }

  private async innerDecrypt(
    stores: LockedStores,
    envelope: UnsealedEnvelope,
    ciphertext: Uint8Array,
    serviceIdKind: ServiceIdKind
  ): Promise<InnerDecryptResultType | undefined> {
    const { sessionStore, identityKeyStore, zone } = stores;

    const logId = getEnvelopeId(envelope);
    const envelopeTypeEnum = Proto.Envelope.Type;

    const identifier = envelope.sourceServiceId;
    const { sourceDevice } = envelope;

    const { destinationServiceId } = envelope;
    const preKeyStore = new PreKeys({ ourServiceId: destinationServiceId });
    const signedPreKeyStore = new SignedPreKeys({
      ourServiceId: destinationServiceId,
    });
    const kyberPreKeyStore = new KyberPreKeys({
      ourServiceId: destinationServiceId,
    });

    strictAssert(identifier !== undefined, 'Empty identifier');
    strictAssert(sourceDevice !== undefined, 'Empty source device');

    const address = new QualifiedAddress(
      destinationServiceId,
      Address.create(identifier, sourceDevice)
    );

    if (
      serviceIdKind === ServiceIdKind.PNI &&
      envelope.type !== envelopeTypeEnum.PREKEY_BUNDLE
    ) {
      log.warn(
        `MessageReceiver.innerDecrypt(${logId}): ` +
          'non-PreKey envelope on PNI'
      );
      return undefined;
    }

    strictAssert(
      serviceIdKind === ServiceIdKind.PNI ||
        serviceIdKind === ServiceIdKind.ACI,
      `Unsupported serviceIdKind: ${serviceIdKind}`
    );

    if (envelope.type === envelopeTypeEnum.PLAINTEXT_CONTENT) {
      log.info(`decrypt/${logId}: plaintext message`);
      const buffer = Buffer.from(ciphertext);
      const plaintextContent = PlaintextContent.deserialize(buffer);

      return {
        plaintext: this.unpad(plaintextContent.body()),
        wasEncrypted: false,
      };
    }
    if (envelope.type === envelopeTypeEnum.CIPHERTEXT) {
      log.info(`decrypt/${logId}: ciphertext message`);
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

      const plaintext = await this.storage.protocol.enqueueSessionJob(
        address,
        `signalDecrypt(${address.toString()})`,
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
      return { plaintext, wasEncrypted: true };
    }
    if (envelope.type === envelopeTypeEnum.PREKEY_BUNDLE) {
      log.info(`decrypt/${logId}: prekey message`);
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

      const plaintext = await this.storage.protocol.enqueueSessionJob(
        address,
        `signalDecryptPreKey(${address.toString()})`,
        async () =>
          this.unpad(
            await signalDecryptPreKey(
              preKeySignalMessage,
              ProtocolAddress.new(identifier, sourceDevice),
              sessionStore,
              identityKeyStore,
              preKeyStore,
              signedPreKeyStore,
              kyberPreKeyStore
            )
          ),
        zone
      );
      return { plaintext, wasEncrypted: true };
    }
    if (envelope.type === envelopeTypeEnum.UNIDENTIFIED_SENDER) {
      log.info(`decrypt/${logId}: unidentified message`);
      const { plaintext, unsealedPlaintext, wasEncrypted } =
        await this.decryptSealedSender(stores, envelope, ciphertext);

      if (plaintext) {
        return { plaintext: this.unpad(plaintext), wasEncrypted };
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
        return { plaintext: this.unpad(content), wasEncrypted };
      }

      throw new Error('Unexpected lack of plaintext from unidentified sender');
    }
    throw new Error('Unknown message type');
  }

  private async decrypt(
    stores: LockedStores,
    envelope: UnsealedEnvelope,
    ciphertext: Uint8Array,
    serviceIdKind: ServiceIdKind
  ): Promise<InnerDecryptResultType | undefined> {
    try {
      return await this.innerDecrypt(
        stores,
        envelope,
        ciphertext,
        serviceIdKind
      );
    } catch (error) {
      const uuid = envelope.sourceServiceId;
      const deviceId = envelope.sourceDevice;

      const ourAci = this.storage.user.getCheckedAci();
      const isFromMe = ourAci === uuid;

      // Job timed out, not a decryption error
      if (
        error?.name === 'TimeoutError' ||
        error?.message?.includes?.('task did not complete in time')
      ) {
        this.removeFromCache(envelope);
        throw error;
      }

      // We don't do anything if it's just a duplicated message
      if (error?.message?.includes?.('message with old counter')) {
        this.removeFromCache(envelope);
        throw error;
      }

      // We don't do a light session reset if it's an error with the sealed sender
      //   wrapper, since we don't trust the sender information.
      if (error?.message?.includes?.('trust root validation failed')) {
        this.removeFromCache(envelope);
        throw error;
      }

      if (
        (envelope.source && this.isBlocked(envelope.source)) ||
        (envelope.sourceServiceId &&
          this.isServiceIdBlocked(envelope.sourceServiceId))
      ) {
        log.info(
          'MessageReceiver.decrypt: Error from blocked sender; no further processing'
        );
        this.removeFromCache(envelope);
        throw error;
      }

      const envelopeId = getEnvelopeId(envelope);

      if (uuid && deviceId) {
        const senderAci = uuid;
        if (!isAciString(senderAci)) {
          log.info(
            'MessageReceiver.decrypt: Error from PNI; no further processing'
          );
          this.removeFromCache(envelope);
          throw error;
        }

        if (serviceIdKind === ServiceIdKind.PNI) {
          log.info(
            'MessageReceiver.decrypt: Error on PNI; no further processing; ' +
              'queueing pni identity check'
          );
          this.pniIdentityKeyCheckRequired = true;
          this.removeFromCache(envelope);
          throw error;
        }

        const { cipherTextBytes, cipherTextType } = envelope;
        const event = new DecryptionErrorEvent(
          {
            cipherTextBytes,
            cipherTextType,
            contentHint:
              envelope.contentHint ??
              (isFromMe ? ContentHint.Resendable : undefined),
            groupId: envelope.groupId,
            receivedAtCounter: envelope.receivedAtCounter,
            receivedAtDate: envelope.receivedAtDate,
            senderDevice: deviceId,
            senderAci,
            timestamp: envelope.timestamp,
          },
          () => this.removeFromCache(envelope)
        );

        // Avoid deadlocks by scheduling processing on decrypted queue
        drop(
          this.addToQueue(
            async () => this.dispatchEvent(event),
            `decrypted/dispatchEvent/DecryptionErrorEvent(${envelopeId})`,
            TaskType.Decrypted
          )
        );
      } else {
        this.removeFromCache(envelope);
        log.error(
          `MessageReceiver.decrypt: Envelope ${envelopeId} missing uuid or deviceId`
        );
      }

      throw error;
    }
  }

  private async handleSentMessage(
    envelope: ProcessedEnvelope,
    sentContainer: ProcessedSent
  ) {
    log.info('MessageReceiver.handleSentMessage', getEnvelopeId(envelope));

    logUnexpectedUrgentValue(envelope, 'sentSync');

    const {
      destination,
      destinationServiceId,
      timestamp,
      message: msg,
      expirationStartTimestamp,
      unidentifiedStatus,
      isRecipientUpdate,
    } = sentContainer;

    if (!msg) {
      throw new Error('MessageReceiver.handleSentMessage: message was falsey!');
    }

    // TODO: DESKTOP-5804
    if (msg.flags && msg.flags & Proto.DataMessage.Flags.END_SESSION) {
      if (destinationServiceId) {
        await this.handleEndSession(envelope, destinationServiceId);
      } else {
        throw new Error(
          'MessageReceiver.handleSentMessage: Cannot end session with falsey destination'
        );
      }
    }

    const message = this.processDecrypted(envelope, msg);
    const groupId = this.getProcessedGroupId(message);
    const isBlocked = groupId ? this.isGroupBlocked(groupId) : false;

    if (groupId && isBlocked) {
      log.warn(
        `Message ${getEnvelopeId(envelope)} ignored; destined for blocked group`
      );
      this.removeFromCache(envelope);
      return undefined;
    }

    const ev = new SentEvent(
      {
        envelopeId: envelope.id,
        destination: dropNull(destination),
        destinationServiceId,
        timestamp: timestamp?.toNumber(),
        serverTimestamp: envelope.serverTimestamp,
        device: envelope.sourceDevice,
        unidentifiedStatus,
        message,
        isRecipientUpdate: Boolean(isRecipientUpdate),
        receivedAtCounter: envelope.receivedAtCounter,
        receivedAtDate: envelope.receivedAtDate,
        expirationStartTimestamp: expirationStartTimestamp?.toNumber(),
      },
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(getEnvelopeId(envelope), ev);
  }

  private async handleStoryMessage(
    envelope: UnsealedEnvelope,
    msg: Proto.IStoryMessage,
    sentMessage?: ProcessedSent
  ): Promise<void> {
    const envelopeId = getEnvelopeId(envelope);
    const logId = `MessageReceiver.handleStoryMessage(${envelopeId})`;

    logUnexpectedUrgentValue(envelope, 'story');

    if (getStoriesBlocked()) {
      log.info(`${logId}: dropping`);
      this.removeFromCache(envelope);
      return;
    }

    log.info(`${logId} starting`);

    const { sourceServiceId: sourceAci } = envelope;
    strictAssert(
      isAciString(sourceAci),
      'MessageReceiver.handleStoryMessage: received message from PNI'
    );

    const attachments: Array<ProcessedAttachment> = [];
    let preview: ReadonlyArray<ProcessedPreview> | undefined;

    if (msg.fileAttachment) {
      const attachment = processAttachment(msg.fileAttachment);
      attachments.push(attachment);
    }

    if (msg.textAttachment) {
      // If a text attachment has a link preview we remove it from the
      // textAttachment data structure and instead process the preview and add
      // it as a "preview" property for the message attributes.
      const { text, preview: unprocessedPreview } = msg.textAttachment;
      if (unprocessedPreview) {
        preview = processPreview([unprocessedPreview]);
      } else if (!text) {
        throw new Error('Text attachments must have text or link preview!');
      }

      attachments.push({
        size: text?.length ?? 0,
        contentType: TEXT_ATTACHMENT,
        textAttachment: omit(msg.textAttachment, 'preview'),
        blurHash: generateBlurHash(
          (msg.textAttachment.color ||
            msg.textAttachment.gradient?.startColor) ??
            undefined
        ),
      });
    }

    const groupV2 = msg.group ? processGroupV2Context(msg.group) : undefined;
    if (groupV2 && this.isGroupBlocked(groupV2.id)) {
      log.warn(`${logId}: ignored; destined for blocked group`);
      this.removeFromCache(envelope);
      return;
    }

    const timeRemaining = Math.min(
      Math.floor(envelope.timestamp + durations.DAY - Date.now()),
      durations.DAY
    );

    if (timeRemaining <= 0) {
      log.info(`${logId}: story already expired`);
      this.removeFromCache(envelope);
      return;
    }

    const message: ProcessedDataMessage = {
      attachments,

      bodyRanges: filterAndClean(msg.bodyRanges),
      preview,
      canReplyToStory: Boolean(msg.allowsReplies),
      expireTimer: DurationInSeconds.DAY,
      flags: 0,
      groupV2,
      isStory: true,
      isViewOnce: false,
      timestamp: envelope.timestamp,
    };

    if (sentMessage && message.groupV2) {
      log.warn(`${logId}: envelope is a sent group story`);
      const ev = new SentEvent(
        {
          envelopeId: envelope.id,
          destinationServiceId: envelope.destinationServiceId,
          device: envelope.sourceDevice,
          isRecipientUpdate: Boolean(sentMessage.isRecipientUpdate),
          message,
          receivedAtCounter: envelope.receivedAtCounter,
          receivedAtDate: envelope.receivedAtDate,
          serverTimestamp: envelope.serverTimestamp,
          timestamp: envelope.timestamp,
          unidentifiedStatus: sentMessage.storyMessageRecipients
            ?.map(({ destinationServiceId, isAllowedToReply }) => {
              if (!destinationServiceId) {
                return;
              }

              return {
                destinationServiceId,
                isAllowedToReplyToStory: Boolean(isAllowedToReply),
              };
            })
            .filter(isNotNil),
        },
        this.removeFromCache.bind(this, envelope)
      );
      void this.dispatchAndWait(logId, ev);
      return;
    }

    if (sentMessage) {
      log.warn(`${logId}: envelope is a sent distribution list story`);
      const { storyMessageRecipients } = sentMessage;
      const recipients = storyMessageRecipients ?? [];

      const isAllowedToReply = new Map<ServiceIdString, boolean>();
      const distributionListToSentServiceId = new Map<
        string,
        Set<ServiceIdString>
      >();

      recipients.forEach(recipient => {
        const { destinationServiceId } = recipient;
        if (!destinationServiceId) {
          return;
        }

        if (recipient.distributionListIds) {
          recipient.distributionListIds.forEach(listId => {
            const sentServiceIds: Set<ServiceIdString> =
              distributionListToSentServiceId.get(listId) || new Set();
            sentServiceIds.add(destinationServiceId);
            distributionListToSentServiceId.set(listId, sentServiceIds);
          });
        } else {
          assertDev(
            false,
            `${logId}: missing distribution list id for: ${destinationServiceId}`
          );
        }

        isAllowedToReply.set(
          destinationServiceId,
          recipient.isAllowedToReply !== false
        );
      });

      distributionListToSentServiceId.forEach((sentToServiceIds, listId) => {
        const ev = new SentEvent(
          {
            envelopeId: envelope.id,
            destinationServiceId: envelope.destinationServiceId,
            timestamp: envelope.timestamp,
            serverTimestamp: envelope.serverTimestamp,
            device: envelope.sourceDevice,
            unidentifiedStatus: Array.from(sentToServiceIds).map(
              destinationServiceId => ({
                destinationServiceId,
                isAllowedToReplyToStory:
                  isAllowedToReply.has(destinationServiceId),
              })
            ),
            message,
            isRecipientUpdate: Boolean(sentMessage.isRecipientUpdate),
            receivedAtCounter: envelope.receivedAtCounter,
            receivedAtDate: envelope.receivedAtDate,
            storyDistributionListId: normalizeStoryDistributionId(
              listId,
              'storyDistributionListId'
            ),
          },
          this.removeFromCache.bind(this, envelope)
        );
        void this.dispatchAndWait(logId, ev);
      });
      return;
    }

    log.warn(`${logId}: envelope is a received story`);
    const ev = new MessageEvent(
      {
        envelopeId: envelope.id,
        source: envelope.source,
        sourceAci,
        sourceDevice: envelope.sourceDevice,
        destinationServiceId: envelope.destinationServiceId,
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
    return this.dispatchAndWait(logId, ev);
  }

  private async handleEditMessage(
    envelope: UnsealedEnvelope,
    msg: Proto.IEditMessage
  ): Promise<void> {
    const logId = `MessageReceiver.handleEditMessage(${getEnvelopeId(
      envelope
    )})`;
    log.info(logId);

    if (!msg.targetSentTimestamp) {
      log.info(`${logId}: cannot edit message. No targetSentTimestamp`);
      this.removeFromCache(envelope);
      return;
    }

    if (!msg.dataMessage) {
      log.info(`${logId}: cannot edit message. No dataMessage`);
      this.removeFromCache(envelope);
      return;
    }

    const message = this.processDecrypted(envelope, msg.dataMessage);
    const groupId = this.getProcessedGroupId(message);
    const isBlocked = groupId ? this.isGroupBlocked(groupId) : false;

    if (groupId && isBlocked) {
      log.warn(
        `Message ${getEnvelopeId(envelope)} ignored; destined for blocked group`
      );
      this.removeFromCache(envelope);
      return;
    }

    const { sourceServiceId: sourceAci } = envelope;
    strictAssert(
      isAciString(sourceAci),
      'MessageReceiver.handleEditMesage: received message from PNI'
    );

    const ev = new MessageEvent(
      {
        envelopeId: envelope.id,
        source: envelope.source,
        sourceAci,
        sourceDevice: envelope.sourceDevice,
        destinationServiceId: envelope.destinationServiceId,
        timestamp: envelope.timestamp,
        serverGuid: envelope.serverGuid,
        serverTimestamp: envelope.serverTimestamp,
        unidentifiedDeliveryReceived: Boolean(
          envelope.unidentifiedDeliveryReceived
        ),
        message: {
          ...message,
          editedMessageTimestamp: msg.targetSentTimestamp.toNumber(),
        },
        receivedAtCounter: envelope.receivedAtCounter,
        receivedAtDate: envelope.receivedAtDate,
      },
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(logId, ev);
  }

  private async handleDataMessage(
    envelope: UnsealedEnvelope,
    msg: Proto.IDataMessage
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleDataMessage', logId);

    if (getStoriesBlocked() && msg.storyContext) {
      log.info(
        `MessageReceiver.handleDataMessage/${logId}: Dropping incoming dataMessage with storyContext field`
      );
      this.removeFromCache(envelope);
      return;
    }

    let p: Promise<void> = Promise.resolve();
    const { sourceServiceId: sourceAci } = envelope;
    if (!sourceAci) {
      throw new Error(
        'MessageReceiver.handleDataMessage: sourceAci was falsey'
      );
    }

    strictAssert(
      isAciString(sourceAci),
      'MessageReceiver.handleDataMessage: received message from PNI'
    );

    if (this.isInvalidGroupData(msg, envelope)) {
      this.removeFromCache(envelope);
      return undefined;
    }

    if (msg.flags && msg.flags & Proto.DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(envelope, sourceAci);
    }

    const { profileKey } = msg;
    const hasProfileKey = profileKey && profileKey.length > 0;
    const isProfileKeyUpdate =
      msg.flags && msg.flags & Proto.DataMessage.Flags.PROFILE_KEY_UPDATE;

    if (isProfileKeyUpdate) {
      strictAssert(hasProfileKey, 'PROFILE_KEY_UPDATE without profileKey');
      logUnexpectedUrgentValue(envelope, 'profileKeyUpdate');
    }

    if (hasProfileKey) {
      const ev = new ProfileKeyUpdateEvent(
        {
          source: envelope.source,
          sourceAci,
          profileKey: Bytes.toBase64(profileKey),
        },
        isProfileKeyUpdate ? 'profileKeyUpdate' : 'profileKeyHarvest',
        isProfileKeyUpdate ? this.removeFromCache.bind(this, envelope) : noop
      );

      if (isProfileKeyUpdate) {
        return this.dispatchAndWait(logId, ev);
      }

      drop(this.dispatchAndWait(logId, ev));
    }
    await p;

    let type: SendTypesType = 'message';

    if (msg.storyContext || msg.body) {
      type = 'message';
    } else if (msg.reaction) {
      type = 'reaction';
    } else if (msg.delete) {
      type = 'deleteForEveryone';
    } else if (
      msg.flags &&
      msg.flags & Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
    ) {
      type = 'expirationTimerUpdate';
    }
    // Note: other data messages without any of these attributes will fall into the
    //   'message' bucket - like stickers, gift badges, etc.

    logUnexpectedUrgentValue(envelope, type);

    const message = this.processDecrypted(envelope, msg);
    const groupId = this.getProcessedGroupId(message);
    const isBlocked = groupId ? this.isGroupBlocked(groupId) : false;

    if (groupId && isBlocked) {
      log.warn(
        `Message ${getEnvelopeId(envelope)} ignored; destined for blocked group`
      );
      this.removeFromCache(envelope);
      return undefined;
    }

    const ev = new MessageEvent(
      {
        envelopeId: envelope.id,
        source: envelope.source,
        sourceAci,
        sourceDevice: envelope.sourceDevice,
        destinationServiceId: envelope.destinationServiceId,
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

    return this.dispatchAndWait(logId, ev);
  }

  private async maybeUpdateTimestamp(
    envelope: UnsealedEnvelope
  ): Promise<UnsealedEnvelope> {
    const { retryPlaceholders } = window.Signal.Services;
    if (!retryPlaceholders) {
      log.warn('maybeUpdateTimestamp: retry placeholders not available!');
      return envelope;
    }

    const { timestamp } = envelope;
    const identifier = envelope.groupId || envelope.sourceServiceId;
    const conversation = window.ConversationController.get(identifier);

    try {
      if (!conversation) {
        const idForLogging = envelope.groupId
          ? `groupv2(${envelope.groupId})`
          : envelope.sourceServiceId;
        log.info(
          `maybeUpdateTimestamp/${timestamp}: No conversation found for identifier ${idForLogging}`
        );
        return envelope;
      }

      const logId = `${conversation.idForLogging()}/${timestamp}`;
      const item = await retryPlaceholders.findByMessageAndRemove(
        conversation.id,
        timestamp
      );
      if (item && item.wasOpened) {
        log.info(
          `maybeUpdateTimestamp/${logId}: found retry placeholder, but conversation was opened. No updates made.`
        );
      } else if (item) {
        log.info(
          `maybeUpdateTimestamp/${logId}: found retry placeholder. Updating receivedAtCounter/receivedAtDate`
        );

        return {
          ...envelope,
          receivedAtCounter: item.receivedAtCounter,
          receivedAtDate: item.receivedAt,
        };
      }
    } catch (error) {
      log.error(
        `maybeUpdateTimestamp/${timestamp}: Failed to process message: ${Errors.toLogFormat(
          error
        )}`
      );
    }

    return envelope;
  }

  private async innerHandleContentMessage(
    incomingEnvelope: UnsealedEnvelope,
    plaintext: Uint8Array
  ): Promise<void> {
    const content = Proto.Content.decode(plaintext);
    const envelope = await this.maybeUpdateTimestamp(incomingEnvelope);

    if (
      content.decryptionErrorMessage &&
      Bytes.isNotEmpty(content.decryptionErrorMessage)
    ) {
      this.handleDecryptionError(envelope, content.decryptionErrorMessage);
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
      this.handleNullMessage(envelope);
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
      this.handleTypingMessage(envelope, content.typingMessage);
      return;
    }

    if (content.storyMessage) {
      await this.handleStoryMessage(envelope, content.storyMessage);
      return;
    }

    if (content.editMessage) {
      await this.handleEditMessage(envelope, content.editMessage);
      return;
    }

    this.removeFromCache(envelope);

    if (Bytes.isEmpty(content.senderKeyDistributionMessage)) {
      throw new Error('Unsupported content message');
    }
  }

  private handleDecryptionError(
    envelope: UnsealedEnvelope,
    decryptionError: Uint8Array
  ): void {
    const logId = getEnvelopeId(envelope);
    log.info(`handleDecryptionError: ${logId}`);

    logUnexpectedUrgentValue(envelope, 'retryRequest');

    const buffer = Buffer.from(decryptionError);
    const request = DecryptionErrorMessage.deserialize(buffer);

    const { sourceServiceId: sourceAci, sourceDevice } = envelope;
    if (!sourceAci || !sourceDevice) {
      log.error(`handleDecryptionError/${logId}: Missing uuid or device!`);
      this.removeFromCache(envelope);
      return;
    }

    strictAssert(isAciString(sourceAci), 'Source uuid must be ACI');

    const event = new RetryRequestEvent(
      {
        groupId: envelope.groupId,
        requesterDevice: sourceDevice,
        requesterAci: sourceAci,
        ratchetKey: request.ratchetKey(),
        senderDevice: request.deviceId(),
        sentAt: request.timestamp(),
      },
      () => this.removeFromCache(envelope)
    );
    this.dispatchEvent(event);
  }

  private async handleSenderKeyDistributionMessage(
    stores: LockedStores,
    envelope: UnsealedEnvelope,
    distributionMessage: Uint8Array
  ): Promise<void> {
    const envelopeId = getEnvelopeId(envelope);
    log.info(`handleSenderKeyDistributionMessage/${envelopeId}`);

    logUnexpectedUrgentValue(envelope, 'senderKeyDistributionMessage');

    // Note: we don't call removeFromCache here because this message can be combined
    //   with a dataMessage, for example. That processing will dictate cache removal.

    const { sourceServiceId, sourceDevice } = envelope;
    if (!sourceServiceId) {
      throw new Error(
        `handleSenderKeyDistributionMessage: Missing sourceServiceId for envelope ${envelopeId}`
      );
    }
    if (!isNumber(sourceDevice)) {
      throw new Error(
        `handleSenderKeyDistributionMessage: Missing sourceDevice for envelope ${envelopeId}`
      );
    }

    const sender = ProtocolAddress.new(sourceServiceId, sourceDevice);
    const senderKeyDistributionMessage =
      SenderKeyDistributionMessage.deserialize(
        Buffer.from(distributionMessage)
      );
    const { destinationServiceId } = envelope;
    const address = new QualifiedAddress(
      destinationServiceId,
      Address.create(sourceServiceId, sourceDevice)
    );

    await this.storage.protocol.enqueueSenderKeyJob(
      address,
      () =>
        processSenderKeyDistributionMessage(
          sender,
          senderKeyDistributionMessage,
          stores.senderKeyStore
        ),
      stores.zone
    );
  }

  private async handlePniSignatureMessage(
    envelope: UnsealedEnvelope,
    pniSignatureMessage: Proto.IPniSignatureMessage
  ): Promise<void> {
    const envelopeId = getEnvelopeId(envelope);
    const logId = `handlePniSignatureMessage/${envelopeId}`;
    log.info(logId);

    // Note: we don't call removeFromCache here because this message can be combined
    //   with a dataMessage, for example. That processing will dictate cache removal.

    const aci = envelope.sourceServiceId;

    const { pni: pniBytes, signature } = pniSignatureMessage;
    strictAssert(Bytes.isNotEmpty(pniBytes), `${logId}: missing PNI bytes`);
    const pni = fromPniObject(Pni.fromUuidBytes(Buffer.from(pniBytes)));
    strictAssert(pni, `${logId}: missing PNI`);
    strictAssert(Bytes.isNotEmpty(signature), `${logId}: empty signature`);
    strictAssert(isAciString(aci), `${logId}: invalid ACI`);
    strictAssert(isPniString(pni), `${logId}: invalid PNI`);

    const isValid = await this.storage.protocol.verifyAlternateIdentity({
      aci,
      pni,
      signature,
    });

    if (isValid) {
      log.info(`${logId}: merging pni=${pni} aci=${aci}`);
      const { mergePromises } =
        window.ConversationController.maybeMergeContacts({
          pni,
          aci,
          e164: window.ConversationController.get(pni)?.get('e164'),
          fromPniSignature: true,
          reason: logId,
        });

      if (mergePromises.length) {
        await Promise.all(mergePromises);
      }
    }
  }

  private async handleCallingMessage(
    envelope: UnsealedEnvelope,
    callingMessage: Proto.ICallingMessage
  ): Promise<void> {
    logUnexpectedUrgentValue(envelope, 'callingMessage');

    this.removeFromCache(envelope);

    const logId = `MessageReceiver.handleCallingMessage(${getEnvelopeId(
      envelope
    )})`;

    if (
      (envelope.source && this.isBlocked(envelope.source)) ||
      (envelope.sourceServiceId &&
        this.isServiceIdBlocked(envelope.sourceServiceId))
    ) {
      log.info(`${logId}: Dropping calling message from blocked sender`);
      this.removeFromCache(envelope);
      return;
    }

    log.info(`${logId}: Passing to ringrtc`);
    await window.Signal.Services.calling.handleCallingMessage(
      envelope,
      callingMessage
    );
  }

  private async handleReceiptMessage(
    envelope: UnsealedEnvelope,
    receiptMessage: Proto.IReceiptMessage
  ): Promise<void> {
    strictAssert(receiptMessage.timestamp, 'Receipt message without timestamp');

    let EventClass: typeof DeliveryEvent | typeof ReadEvent | typeof ViewEvent;
    let type: SendTypesType;
    switch (receiptMessage.type) {
      case Proto.ReceiptMessage.Type.DELIVERY:
        EventClass = DeliveryEvent;
        type = 'deliveryReceipt';
        break;
      case Proto.ReceiptMessage.Type.READ:
        EventClass = ReadEvent;
        type = 'readReceipt';
        break;
      case Proto.ReceiptMessage.Type.VIEWED:
        EventClass = ViewEvent;
        type = 'viewedReceipt';
        break;
      default:
        // This can happen if we get a receipt type we don't know about yet, which
        //   is totally fine.
        return;
    }

    logUnexpectedUrgentValue(envelope, type);

    const logId = getEnvelopeId(envelope);

    const receipts = receiptMessage.timestamp.map(rawTimestamp => ({
      timestamp: rawTimestamp?.toNumber(),
      source: envelope.source,
      sourceServiceId: envelope.sourceServiceId,
      sourceDevice: envelope.sourceDevice,
      wasSentEncrypted: true as const,
    }));

    await this.dispatchAndWait(
      logId,
      new EventClass(
        receipts,
        envelope.id,
        envelope.timestamp,
        this.removeFromCache.bind(this, envelope)
      )
    );
  }

  private handleTypingMessage(
    envelope: UnsealedEnvelope,
    typingMessage: Proto.ITypingMessage
  ): void {
    this.removeFromCache(envelope);

    logUnexpectedUrgentValue(envelope, 'typing');

    if (envelope.timestamp && typingMessage.timestamp) {
      const envelopeTimestamp = envelope.timestamp;
      const typingTimestamp = typingMessage.timestamp?.toNumber();

      if (typingTimestamp !== envelopeTimestamp) {
        log.warn(
          `Typing message envelope timestamp (${envelopeTimestamp}) did not match typing timestamp (${typingTimestamp})`
        );
        return;
      }
    }

    strictAssert(
      envelope.sourceDevice !== undefined,
      'TypingMessage requires sourceDevice in the envelope'
    );
    strictAssert(
      isAciString(envelope.sourceServiceId),
      'Sender of typing indicator must be an ACI'
    );

    const { groupId, timestamp, action } = typingMessage;

    let groupV2IdString: string | undefined;
    if (groupId?.byteLength) {
      if (groupId.byteLength === GROUPV2_ID_LENGTH) {
        groupV2IdString = Bytes.toBase64(groupId);
      } else {
        log.error('handleTypingMessage: Received invalid groupId value');
      }
    }

    this.dispatchEvent(
      new TypingEvent({
        sender: envelope.source,
        senderAci: envelope.sourceServiceId,
        senderDevice: envelope.sourceDevice,
        typing: {
          groupV2Id: groupV2IdString,
          typingMessage,
          timestamp: timestamp?.toNumber() ?? Date.now(),
          started: action === Proto.TypingMessage.Action.STARTED,
          stopped: action === Proto.TypingMessage.Action.STOPPED,
        },
      })
    );
  }

  private handleNullMessage(envelope: UnsealedEnvelope): void {
    log.info('MessageReceiver.handleNullMessage', getEnvelopeId(envelope));

    logUnexpectedUrgentValue(envelope, 'nullMessage');

    this.removeFromCache(envelope);
  }

  private isInvalidGroupData(
    message: Proto.IDataMessage,
    envelope: ProcessedEnvelope
  ): boolean {
    const { groupV2 } = message;

    if (groupV2) {
      const { masterKey } = groupV2;
      strictAssert(masterKey, 'Group v2 data has no masterKey');
      const isInvalid = masterKey.byteLength !== MASTER_KEY_LENGTH;

      if (isInvalid) {
        log.info(
          'isInvalidGroupData: invalid GroupV2 message from',
          getEnvelopeId(envelope)
        );
      }
      return isInvalid;
    }

    return false;
  }

  private getProcessedGroupId(
    message: ProcessedDataMessage
  ): string | undefined {
    if (message.groupV2) {
      return message.groupV2.id;
    }
    return undefined;
  }

  private getGroupId(message: Proto.IDataMessage): string | undefined {
    if (message.groupV2) {
      strictAssert(message.groupV2.masterKey, 'Missing groupV2.masterKey');
      const { id } = deriveGroupFields(message.groupV2.masterKey);
      return Bytes.toBase64(id);
    }

    return undefined;
  }

  private getDestination(sentMessage: ProcessedSent) {
    if (sentMessage.message && sentMessage.message.groupV2) {
      return `groupv2(${this.getGroupId(sentMessage.message)})`;
    }
    return sentMessage.destinationServiceId;
  }

  private async handleSyncMessage(
    envelope: UnsealedEnvelope,
    syncMessage: ProcessedSyncMessage
  ): Promise<void> {
    const ourNumber = this.storage.user.getNumber();
    const ourAci = this.storage.user.getCheckedAci();

    const fromSelfSource = envelope.source && envelope.source === ourNumber;
    const fromSelfSourceUuid =
      envelope.sourceServiceId && envelope.sourceServiceId === ourAci;
    if (!fromSelfSource && !fromSelfSourceUuid) {
      throw new Error('Received sync message from another number');
    }

    const ourDeviceId = this.storage.user.getDeviceId();
    // eslint-disable-next-line eqeqeq
    if (envelope.sourceDevice == ourDeviceId) {
      throw new Error('Received sync message from our own device');
    }
    if (syncMessage.sent) {
      const sentMessage = syncMessage.sent;

      if (sentMessage.editMessage) {
        return this.handleSentEditMessage(envelope, sentMessage);
      }

      if (
        sentMessage.storyMessageRecipients?.length &&
        sentMessage.isRecipientUpdate
      ) {
        if (getStoriesBlocked()) {
          log.info(
            'MessageReceiver.handleSyncMessage: dropping story recipients update',
            getEnvelopeId(envelope)
          );
          this.removeFromCache(envelope);
          return;
        }

        log.info(
          'MessageReceiver.handleSyncMessage: handling story recipients update',
          getEnvelopeId(envelope)
        );
        const ev = new StoryRecipientUpdateEvent(
          {
            destinationServiceId: envelope.destinationServiceId,
            timestamp: envelope.timestamp,
            storyMessageRecipients: sentMessage.storyMessageRecipients,
          },
          this.removeFromCache.bind(this, envelope)
        );
        const logId = getEnvelopeId(envelope);
        return this.dispatchAndWait(logId, ev);
      }

      if (sentMessage.storyMessage) {
        return this.handleStoryMessage(
          envelope,
          sentMessage.storyMessage,
          sentMessage
        );
      }

      if (!sentMessage || !sentMessage.message) {
        throw new Error(
          'MessageReceiver.handleSyncMessage: sync sent message was missing message'
        );
      }

      if (this.isInvalidGroupData(sentMessage.message, envelope)) {
        this.removeFromCache(envelope);
        return;
      }

      strictAssert(sentMessage.timestamp, 'sent message without timestamp');

      log.info(
        'sent message to',
        this.getDestination(sentMessage),
        sentMessage.timestamp?.toNumber(),
        'from',
        getEnvelopeId(envelope)
      );

      return this.handleSentMessage(envelope, sentMessage);
    }
    if (syncMessage.contacts) {
      // Note: this method will download attachment and thus might block
      // message processing, but we would like to fully process contact sync
      // before moving on since it updates conversation state.
      return this.handleContacts(envelope, syncMessage.contacts);
    }
    if (syncMessage.blocked) {
      return this.handleBlocked(envelope, syncMessage.blocked);
    }
    if (syncMessage.request) {
      log.info('Got SyncMessage Request');
      this.removeFromCache(envelope);
      return;
    }
    if (syncMessage.read && syncMessage.read.length) {
      return this.handleRead(envelope, syncMessage.read);
    }
    if (syncMessage.verified) {
      log.info('Got verified sync message, dropping');
      this.removeFromCache(envelope);
      return;
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
    if (syncMessage.viewed && syncMessage.viewed.length) {
      return this.handleViewed(envelope, syncMessage.viewed);
    }
    if (syncMessage.callEvent) {
      return this.handleCallEvent(envelope, syncMessage.callEvent);
    }
    if (syncMessage.callLinkUpdate) {
      return this.handleCallLinkUpdate(envelope, syncMessage.callLinkUpdate);
    }
    if (syncMessage.callLogEvent) {
      return this.handleCallLogEvent(envelope, syncMessage.callLogEvent);
    }
    if (syncMessage.deleteForMe) {
      return this.handleDeleteForMeSync(envelope, syncMessage.deleteForMe);
    }

    this.removeFromCache(envelope);
    const envelopeId = getEnvelopeId(envelope);
    const unknownFieldTags = inspectUnknownFieldTags(syncMessage).join(',');
    log.warn(
      `handleSyncMessage/${envelopeId}: Got unknown SyncMessage (Unknown field tags: ${unknownFieldTags})`
    );
  }

  private async handleSentEditMessage(
    envelope: UnsealedEnvelope,
    sentMessage: ProcessedSent
  ): Promise<void> {
    const logId = `MessageReceiver.handleSentEditMessage(${getEnvelopeId(
      envelope
    )})`;
    log.info(logId);

    const { editMessage } = sentMessage;

    if (!editMessage) {
      log.warn(`${logId}: cannot edit message. No editMessage in proto`);
      this.removeFromCache(envelope);
      return;
    }

    if (!editMessage.targetSentTimestamp) {
      log.warn(`${logId}: cannot edit message. No targetSentTimestamp`);
      this.removeFromCache(envelope);
      return;
    }

    if (!editMessage.dataMessage) {
      log.warn(`${logId}: cannot edit message. No dataMessage`);
      this.removeFromCache(envelope);
      return;
    }

    const {
      destination,
      destinationServiceId,
      expirationStartTimestamp,
      unidentifiedStatus,
      isRecipientUpdate,
    } = sentMessage;

    const message = this.processDecrypted(envelope, editMessage.dataMessage);

    const ev = new SentEvent(
      {
        envelopeId: envelope.id,
        destination: dropNull(destination),
        destinationServiceId,
        timestamp: envelope.timestamp,
        serverTimestamp: envelope.serverTimestamp,
        device: envelope.sourceDevice,
        unidentifiedStatus,
        message: {
          ...message,
          editedMessageTimestamp: editMessage.targetSentTimestamp.toNumber(),
        },
        isRecipientUpdate: Boolean(isRecipientUpdate),
        receivedAtCounter: envelope.receivedAtCounter,
        receivedAtDate: envelope.receivedAtDate,
        expirationStartTimestamp: expirationStartTimestamp?.toNumber(),
      },
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(getEnvelopeId(envelope), ev);
  }

  private async handleConfiguration(
    envelope: ProcessedEnvelope,
    configuration: Proto.SyncMessage.IConfiguration
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('got configuration sync message', logId);

    logUnexpectedUrgentValue(envelope, 'configurationSync');

    const ev = new ConfigurationEvent(
      configuration,
      this.removeFromCache.bind(this, envelope)
    );
    return this.dispatchAndWait(logId, ev);
  }

  private async handleViewOnceOpen(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IViewOnceOpen
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('got view once open sync message', logId);

    logUnexpectedUrgentValue(envelope, 'viewOnceSync');

    const ev = new ViewOnceOpenSyncEvent(
      {
        source: dropNull(sync.sender),
        sourceAci: sync.senderAci
          ? normalizeAci(sync.senderAci, 'handleViewOnceOpen.senderUuid')
          : undefined,
        timestamp: sync.timestamp?.toNumber(),
      },
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(logId, ev);
  }

  private async handleMessageRequestResponse(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IMessageRequestResponse
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('got message request response sync message', logId);

    logUnexpectedUrgentValue(envelope, 'messageRequestSync');

    const { groupId } = sync;

    let groupV2IdString: string | undefined;
    if (groupId?.byteLength) {
      if (groupId.byteLength === GROUPV2_ID_LENGTH) {
        groupV2IdString = Bytes.toBase64(groupId);
      } else {
        this.removeFromCache(envelope);
        log.error('Received message request with invalid groupId');
        return undefined;
      }
    }

    const ev = new MessageRequestResponseEvent(
      {
        envelopeId: envelope.id,
        threadE164: dropNull(sync.threadE164),
        threadAci: sync.threadAci
          ? normalizeAci(
              sync.threadAci,
              'handleMessageRequestResponse.threadUuid'
            )
          : undefined,
        messageRequestResponseType: sync.type,
        groupV2Id: groupV2IdString,
      },
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(logId, ev);
  }

  private async handleFetchLatest(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IFetchLatest
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('got fetch latest sync message', logId);

    logUnexpectedUrgentValue(envelope, 'fetchLatestManifestSync');

    const ev = new FetchLatestEvent(
      sync.type,
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(logId, ev);
  }

  private async handleKeys(
    envelope: ProcessedEnvelope,
    sync: Proto.SyncMessage.IKeys
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('got keys sync message', logId);

    logUnexpectedUrgentValue(envelope, 'keySync');

    if (!sync.storageService && !sync.master) {
      return undefined;
    }

    const ev = new KeysEvent(
      {
        storageServiceKey: Bytes.isNotEmpty(sync.storageService)
          ? sync.storageService
          : undefined,
        masterKey: Bytes.isNotEmpty(sync.master) ? sync.master : undefined,
      },
      this.removeFromCache.bind(this, envelope)
    );

    return this.dispatchAndWait(logId, ev);
  }

  // Runs on TaskType.Encrypted queue
  private async handlePNIChangeNumber(
    envelope: ProcessedEnvelope,
    {
      identityKeyPair,
      signedPreKey,
      lastResortKyberPreKey,
      registrationId,
      newE164,
    }: Proto.SyncMessage.IPniChangeNumber
  ): Promise<void> {
    const ourAci = this.storage.user.getCheckedAci();

    if (envelope.sourceServiceId !== ourAci) {
      throw new Error('Received pni change number from another number');
    }

    log.info('MessageReceiver: got pni change number sync message');

    logUnexpectedUrgentValue(envelope, 'pniIdentitySync');

    const { updatedPni } = envelope;
    if (!updatedPni) {
      log.warn('MessageReceiver: missing pni in change number sync message');
      return;
    }

    // TDOO: DESKTOP-5652
    if (
      !Bytes.isNotEmpty(identityKeyPair) ||
      !Bytes.isNotEmpty(signedPreKey) ||
      !isNumber(registrationId) ||
      !isString(newE164)
    ) {
      log.warn('MessageReceiver: empty pni change number sync message');
      return;
    }

    if (this.pniIdentityKeyCheckRequired) {
      log.warn('MessageReceiver: canceling pni identity key check');
    }
    this.pniIdentityKeyCheckRequired = false;

    const manager = window.getAccountManager();
    await manager.setPni(updatedPni, {
      identityKeyPair,
      lastResortKyberPreKey: dropNull(lastResortKyberPreKey),
      signedPreKey,
      registrationId,
    });
    await window.storage.user.setNumber(newE164);
  }

  private async handleStickerPackOperation(
    envelope: ProcessedEnvelope,
    operations: Array<Proto.SyncMessage.IStickerPackOperation>
  ): Promise<void> {
    const ENUM = Proto.SyncMessage.StickerPackOperation.Type;
    const logId = getEnvelopeId(envelope);
    log.info('got sticker pack operation sync message', logId);
    logUnexpectedUrgentValue(envelope, 'stickerPackSync');

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

    return this.dispatchAndWait(logId, ev);
  }

  private async handleRead(
    envelope: ProcessedEnvelope,
    read: Array<Proto.SyncMessage.IRead>
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleRead', logId);

    logUnexpectedUrgentValue(envelope, 'readSync');

    const reads = read.map(
      ({ timestamp, sender, senderAci }): ReadSyncEventData => ({
        envelopeId: envelope.id,
        envelopeTimestamp: envelope.timestamp,
        timestamp: timestamp?.toNumber(),
        sender: dropNull(sender),
        senderAci: senderAci
          ? normalizeAci(senderAci, 'handleRead.senderAci')
          : undefined,
      })
    );

    await this.dispatchAndWait(
      logId,
      new ReadSyncEvent(
        reads,
        envelope.id,
        envelope.timestamp,
        this.removeFromCache.bind(this, envelope)
      )
    );
  }

  private async handleViewed(
    envelope: ProcessedEnvelope,
    viewed: ReadonlyArray<Proto.SyncMessage.IViewed>
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleViewed', logId);

    logUnexpectedUrgentValue(envelope, 'viewSync');

    const views = viewed.map(
      ({ timestamp, senderE164, senderAci }): ViewSyncEventData => ({
        timestamp: timestamp?.toNumber(),
        senderE164: dropNull(senderE164),
        senderAci: senderAci
          ? normalizeAci(senderAci, 'handleViewed.senderAci')
          : undefined,
      })
    );

    await this.dispatchAndWait(
      logId,
      new ViewSyncEvent(
        views,
        envelope.id,
        envelope.timestamp,
        this.removeFromCache.bind(this, envelope)
      )
    );
  }

  private async handleCallEvent(
    envelope: ProcessedEnvelope,
    callEvent: Proto.SyncMessage.ICallEvent
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleCallEvent', logId);

    logUnexpectedUrgentValue(envelope, 'callEventSync');

    const { receivedAtCounter, receivedAtDate: receivedAtMS } = envelope;

    const callEventDetails = getCallEventForProto(
      callEvent,
      'MessageReceiver.handleCallEvent'
    );

    const callEventSync = new CallEventSyncEvent(
      {
        callEventDetails,
        receivedAtCounter,
        receivedAtMS,
      },
      this.removeFromCache.bind(this, envelope)
    );
    await this.dispatchAndWait(logId, callEventSync);

    log.info('handleCallEvent: finished');
  }

  private async handleCallLinkUpdate(
    envelope: ProcessedEnvelope,
    callLinkUpdate: Proto.SyncMessage.ICallLinkUpdate
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleCallLinkUpdate', logId);

    logUnexpectedUrgentValue(envelope, 'callLinkUpdateSync');

    let callLinkUpdateSyncType: CallLinkUpdateSyncType;
    if (callLinkUpdate.type == null) {
      throw new Error('MessageReceiver.handleCallLinkUpdate: type was null');
    } else if (
      callLinkUpdate.type === Proto.SyncMessage.CallLinkUpdate.Type.UPDATE
    ) {
      callLinkUpdateSyncType = CallLinkUpdateSyncType.Update;
    } else if (
      callLinkUpdate.type === Proto.SyncMessage.CallLinkUpdate.Type.DELETE
    ) {
      callLinkUpdateSyncType = CallLinkUpdateSyncType.Delete;
    } else {
      throw new Error(
        `MessageReceiver.handleCallLinkUpdate: unknown type ${callLinkUpdate.type}`
      );
    }

    const rootKey = Bytes.isNotEmpty(callLinkUpdate.rootKey)
      ? callLinkUpdate.rootKey
      : undefined;
    const adminKey = Bytes.isNotEmpty(callLinkUpdate.adminPasskey)
      ? callLinkUpdate.adminPasskey
      : undefined;

    const ev = new CallLinkUpdateSyncEvent(
      {
        type: callLinkUpdateSyncType,
        rootKey,
        adminKey,
      },
      this.removeFromCache.bind(this, envelope)
    );

    await this.dispatchAndWait(logId, ev);

    log.info('handleCallLinkUpdate: finished');
  }

  private async handleCallLogEvent(
    envelope: ProcessedEnvelope,
    callLogEvent: Proto.SyncMessage.ICallLogEvent
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleCallLogEvent', logId);

    logUnexpectedUrgentValue(envelope, 'callLogEventSync');

    const { receivedAtCounter } = envelope;

    const callLogEventDetails = getCallLogEventForProto(callLogEvent);
    const callLogEventSync = new CallLogEventSyncEvent(
      {
        callLogEventDetails,
        receivedAtCounter,
      },
      this.removeFromCache.bind(this, envelope)
    );

    await this.dispatchAndWait(logId, callLogEventSync);

    log.info('handleCallLogEvent: finished');
  }

  private async handleDeleteForMeSync(
    envelope: ProcessedEnvelope,
    deleteSync: Proto.SyncMessage.IDeleteForMe
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info('MessageReceiver.handleDeleteForMeSync', logId);

    logUnexpectedUrgentValue(envelope, 'deleteForMeSync');

    const { timestamp } = envelope;
    let eventData: DeleteForMeSyncEventData = [];

    try {
      if (deleteSync.messageDeletes?.length) {
        const messageDeletes: Array<DeleteForMeSyncTarget> =
          deleteSync.messageDeletes
            .flatMap((item): Array<DeleteForMeSyncTarget> | undefined => {
              const messages = item.messages
                ?.map(message => processMessageToDelete(message, logId))
                .filter(isNotNil);
              const conversation = item.conversation
                ? processConversationToDelete(item.conversation, logId)
                : undefined;

              if (!conversation) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/messageDeletes: No target conversation`
                );
                return undefined;
              }
              if (!messages?.length) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/messageDeletes: No target messages`
                );
                return undefined;
              }

              // We want each message in its own task
              return messages.map(innerItem => {
                return {
                  type: 'delete-message' as const,
                  message: innerItem,
                  conversation,
                  timestamp,
                };
              });
            })
            .filter(isNotNil);

        eventData = eventData.concat(messageDeletes);
      }
      if (deleteSync.conversationDeletes?.length) {
        const conversationDeletes: Array<DeleteForMeSyncTarget> =
          deleteSync.conversationDeletes
            .map(item => {
              const mostRecentMessages = item.mostRecentMessages
                ?.map(message => processMessageToDelete(message, logId))
                .filter(isNotNil);
              const mostRecentNonExpiringMessages =
                item.mostRecentNonExpiringMessages
                  ?.map(message => processMessageToDelete(message, logId))
                  .filter(isNotNil);
              const conversation = item.conversation
                ? processConversationToDelete(item.conversation, logId)
                : undefined;

              if (!conversation) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/conversationDeletes: No target conversation`
                );
                return undefined;
              }
              if (!mostRecentMessages?.length) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/conversationDeletes: No target messages`
                );
                return undefined;
              }

              return {
                type: 'delete-conversation' as const,
                conversation,
                isFullDelete: Boolean(item.isFullDelete),
                mostRecentMessages,
                mostRecentNonExpiringMessages,
                timestamp,
              };
            })
            .filter(isNotNil);

        eventData = eventData.concat(conversationDeletes);
      }
      if (deleteSync.localOnlyConversationDeletes?.length) {
        const localOnlyConversationDeletes: Array<DeleteForMeSyncTarget> =
          deleteSync.localOnlyConversationDeletes
            .map(item => {
              const conversation = item.conversation
                ? processConversationToDelete(item.conversation, logId)
                : undefined;

              if (!conversation) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/localOnlyConversationDeletes: No target conversation`
                );
                return undefined;
              }

              return {
                type: 'delete-local-conversation' as const,
                conversation,
                timestamp,
              };
            })
            .filter(isNotNil);

        eventData = eventData.concat(localOnlyConversationDeletes);
      }
      if (deleteSync.attachmentDeletes?.length) {
        const attachmentDeletes: Array<DeleteForMeSyncTarget> =
          deleteSync.attachmentDeletes
            .map(item => {
              const {
                clientUuid: targetClientUuid,
                conversation: targetConversation,
                fallbackDigest: targetFallbackDigest,
                fallbackPlaintextHash: targetFallbackPlaintextHash,
                targetMessage,
              } = item;
              const conversation = targetConversation
                ? processConversationToDelete(targetConversation, logId)
                : undefined;
              const message = targetMessage
                ? processMessageToDelete(targetMessage, logId)
                : undefined;

              if (!conversation) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/attachmentDeletes: No target conversation`
                );
                return undefined;
              }
              if (!message) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/attachmentDeletes: No target message`
                );
                return undefined;
              }
              const clientUuid = targetClientUuid?.length
                ? bytesToUuid(targetClientUuid)
                : undefined;
              const fallbackDigest = targetFallbackDigest?.length
                ? Bytes.toBase64(targetFallbackDigest)
                : undefined;
              // TODO: DESKTOP-7204
              const fallbackPlaintextHash = targetFallbackPlaintextHash?.length
                ? Bytes.toHex(targetFallbackPlaintextHash)
                : undefined;
              if (!clientUuid && !fallbackDigest && !fallbackPlaintextHash) {
                log.warn(
                  `${logId}/handleDeleteForMeSync/attachmentDeletes: Missing clientUuid, fallbackDigest and fallbackPlaintextHash`
                );
                return undefined;
              }

              return {
                type: 'delete-single-attachment' as const,
                conversation,
                message,
                clientUuid,
                fallbackDigest,
                fallbackPlaintextHash,
                timestamp,
              };
            })
            .filter(isNotNil);

        eventData = eventData.concat(attachmentDeletes);
      }
      if (!eventData.length) {
        throw new Error(`${logId}: Nothing found in sync message!`);
      }
    } catch (error: unknown) {
      this.removeFromCache(envelope);

      throw error;
    }

    const deleteSyncEventSync = new DeleteForMeSyncEvent(
      eventData,
      timestamp,
      envelope.id,
      this.removeFromCache.bind(this, envelope)
    );

    await this.dispatchAndWait(logId, deleteSyncEventSync);

    log.info('handleDeleteForMeSync: finished');
  }

  private async handleContacts(
    envelope: ProcessedEnvelope,
    contactSyncProto: Proto.SyncMessage.IContacts
  ): Promise<void> {
    const logId = getEnvelopeId(envelope);
    log.info(`MessageReceiver: handleContacts ${logId}`);
    const { blob } = contactSyncProto;
    if (!blob) {
      throw new Error('MessageReceiver.handleContacts: blob field was missing');
    }

    logUnexpectedUrgentValue(envelope, 'contactSync');

    this.removeFromCache(envelope);

    let attachment: AttachmentType | undefined;
    try {
      attachment = await this.handleAttachmentV2(blob, {
        disableRetries: true,
        timeout: 90 * SECOND,
      });

      const { path } = attachment;
      if (!path) {
        throw new Error('Failed no path field in returned attachment');
      }

      const contacts = await parseContactsV2(attachment);

      const contactSync = new ContactSyncEvent(
        contacts,
        Boolean(contactSyncProto.complete),
        envelope.receivedAtCounter,
        envelope.timestamp
      );
      await this.dispatchAndWait(logId, contactSync);

      log.info('handleContacts: finished');
    } finally {
      if (attachment?.path) {
        await window.Signal.Migrations.deleteAttachmentData(attachment.path);
      }
    }
  }

  private async handleBlocked(
    envelope: ProcessedEnvelope,
    blocked: Proto.SyncMessage.IBlocked
  ): Promise<void> {
    const allIdentifiers = [];
    let changed = false;

    const logId = `handleBlocked(${getEnvelopeId(envelope)})`;

    logUnexpectedUrgentValue(envelope, 'blockSync');

    if (blocked.numbers) {
      const previous = this.storage.get('blocked', []);

      log.info(`${logId}: Blocking these numbers:`, blocked.numbers);
      await this.storage.put('blocked', blocked.numbers);

      if (!areArraysMatchingSets(previous, blocked.numbers)) {
        changed = true;
        allIdentifiers.push(...previous);
        allIdentifiers.push(...blocked.numbers);
      }
    }
    if (blocked.acis) {
      const previous = this.storage.get('blocked-uuids', []);
      const acis = blocked.acis.map((aci, index) => {
        return normalizeAci(aci, `handleBlocked.acis.${index}`);
      });
      log.info(`${logId}: Blocking these acis:`, acis);
      await this.storage.put('blocked-uuids', acis);

      if (!areArraysMatchingSets(previous, acis)) {
        changed = true;
        allIdentifiers.push(...previous);
        allIdentifiers.push(...blocked.acis);
      }
    }

    if (blocked.groupIds) {
      const previous = this.storage.get('blocked-groups', []);
      const groupIds: Array<string> = [];

      blocked.groupIds.forEach(groupId => {
        if (groupId.byteLength === GROUPV2_ID_LENGTH) {
          groupIds.push(Bytes.toBase64(groupId));
        } else {
          log.error(`${logId}: Received invalid groupId value`);
        }
      });
      log.info(
        `${logId}: Blocking these groups - v2:`,
        groupIds.map(groupId => `groupv2(${groupId})`)
      );

      await this.storage.put('blocked-groups', groupIds);

      if (!areArraysMatchingSets(previous, groupIds)) {
        changed = true;
        allIdentifiers.push(...previous);
        allIdentifiers.push(...groupIds);
      }
    }

    this.removeFromCache(envelope);

    if (changed) {
      log.info(`${logId}: Block list changed, forcing re-render.`);
      const uniqueIdentifiers = Array.from(new Set(allIdentifiers));
      void window.ConversationController.forceRerender(uniqueIdentifiers);
    }
  }

  private isBlocked(number: string): boolean {
    return this.storage.blocked.isBlocked(number);
  }

  private isServiceIdBlocked(serviceId: ServiceIdString): boolean {
    return this.storage.blocked.isServiceIdBlocked(serviceId);
  }

  private isGroupBlocked(groupId: string): boolean {
    return this.storage.blocked.isGroupBlocked(groupId);
  }

  private async handleAttachmentV2(
    attachment: Proto.IAttachmentPointer,
    options?: { timeout?: number; disableRetries?: boolean }
  ): Promise<AttachmentType> {
    const cleaned = processAttachment(attachment);
    return downloadAttachment(this.server, cleaned, options);
  }

  private async handleEndSession(
    envelope: ProcessedEnvelope,
    theirServiceId: ServiceIdString
  ): Promise<void> {
    log.info(`handleEndSession: closing sessions for ${theirServiceId}`);

    logUnexpectedUrgentValue(envelope, 'resetSession');

    await this.storage.protocol.archiveAllSessions(theirServiceId);
  }

  private processDecrypted(
    envelope: ProcessedEnvelope,
    decrypted: Proto.IDataMessage
  ): ProcessedDataMessage {
    return processDataMessage(decrypted, envelope.timestamp);
  }
}

function envelopeTypeToCiphertextType(type: number | undefined): number {
  const { Type } = Proto.Envelope;

  if (type === Type.CIPHERTEXT) {
    return CiphertextMessageType.Whisper;
  }
  if (type === Type.KEY_EXCHANGE) {
    throw new Error(
      'envelopeTypeToCiphertextType: Cannot process KEY_EXCHANGE messages'
    );
  }
  if (type === Type.PLAINTEXT_CONTENT) {
    return CiphertextMessageType.Plaintext;
  }
  if (type === Type.PREKEY_BUNDLE) {
    return CiphertextMessageType.PreKey;
  }
  if (type === Type.RECEIPT) {
    return CiphertextMessageType.Plaintext;
  }
  if (type === Type.UNIDENTIFIED_SENDER) {
    throw new Error(
      'envelopeTypeToCiphertextType: Cannot process UNIDENTIFIED_SENDER messages'
    );
  }
  if (type === Type.UNKNOWN) {
    throw new Error(
      'envelopeTypeToCiphertextType: Cannot process UNKNOWN messages'
    );
  }

  throw new Error(`envelopeTypeToCiphertextType: Unknown type ${type}`);
}

function processMessageToDelete(
  target: Proto.SyncMessage.DeleteForMe.IAddressableMessage,
  logId: string
): MessageToDelete | undefined {
  const sentAt = target.sentTimestamp?.toNumber();
  if (!isNumber(sentAt)) {
    log.warn(
      `${logId}/processMessageToDelete: No sentTimestamp found! Dropping AddressableMessage.`
    );
    return undefined;
  }

  const { authorServiceId } = target;
  if (authorServiceId) {
    if (isAciString(authorServiceId)) {
      return {
        type: 'aci' as const,
        authorAci: normalizeAci(
          authorServiceId,
          `${logId}/processMessageToDelete/aci`
        ),
        sentAt,
      };
    }
    if (isPniString(authorServiceId)) {
      return {
        type: 'pni' as const,
        authorPni: normalizePni(
          authorServiceId,
          `${logId}/processMessageToDelete/pni`
        ),
        sentAt,
      };
    }
    log.error(
      `${logId}/processMessageToDelete: invalid authorServiceId, Dropping AddressableMessage.`
    );
    return undefined;
  }
  if (target.authorE164) {
    return {
      type: 'e164' as const,
      authorE164: target.authorE164,
      sentAt,
    };
  }

  log.warn(
    `${logId}/processMessageToDelete: No author field found! Dropping AddressableMessage.`
  );
  return undefined;
}

function processConversationToDelete(
  target: Proto.SyncMessage.DeleteForMe.IConversationIdentifier,
  logId: string
): ConversationToDelete | undefined {
  const { threadServiceId, threadGroupId, threadE164 } = target;

  if (threadServiceId) {
    if (isAciString(threadServiceId)) {
      return {
        type: 'aci' as const,
        aci: normalizeAci(threadServiceId, `${logId}/aci`),
      };
    }
    if (isPniString(threadServiceId)) {
      return {
        type: 'pni' as const,
        pni: normalizePni(threadServiceId, `${logId}/pni`),
      };
    }
    log.error(
      `${logId}/processConversationToDelete: Invalid threadServiceId, dropping ConversationIdentifier.`
    );
    return undefined;
  }
  if (threadGroupId) {
    return {
      type: 'group' as const,
      groupId: Buffer.from(threadGroupId).toString('base64'),
    };
  }
  if (threadE164) {
    return {
      type: 'e164' as const,
      e164: threadE164,
    };
  }

  log.warn(
    `${logId}/processConversationToDelete: No identifier field found! Dropping ConversationIdentifier.`
  );
  return undefined;
}
