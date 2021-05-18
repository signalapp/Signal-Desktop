// TODO: fix libloki and textsecure not being available here yet

import { EnvelopePlus } from './types';
export { downloadAttachment } from './attachments';
import { v4 as uuidv4 } from 'uuid';

import { addToCache, getAllFromCache, getAllFromCacheForSource, removeFromCache } from './cache';
import { processMessage } from '../session/snode_api/swarmPolling';
import { onError } from './errors';

// innerHandleContentMessage is only needed because of code duplication in handleDecryptedEnvelope...
import { handleContentMessage, innerHandleContentMessage } from './contentMessage';
import _, { noop } from 'lodash';

export { processMessage };

import {
  createMessage,
  handleMessageEvent,
  isMessageDuplicate,
  MessageCreationData,
  updateProfileOneAtATime,
} from './dataMessage';

import { getEnvelopeId } from './common';
import { StringUtils, UserUtils } from '../session/utils';
import { SignalService } from '../protobuf';
import { ConversationController } from '../session/conversations';
import { removeUnprocessed } from '../data/data';
import { ConversationTypeEnum } from '../models/conversation';
import {
  getOpenGroupV2ConversationId,
  openGroupPrefixRegex,
} from '../opengroup/utils/OpenGroupUtils';
import { OpenGroupMessageV2 } from '../opengroup/opengroupV2/OpenGroupMessageV2';
import { OpenGroupRequestCommonType } from '../opengroup/opengroupV2/ApiUtil';
import { handleMessageJob } from './queuedJob';
import { fromBase64ToArray } from '../session/utils/String';
import { removeMessagePadding } from '../session/crypto/BufferPadding';

// TODO: check if some of these exports no longer needed

interface ReqOptions {
  conversationId: string;
}

const incomingMessagePromises: Array<Promise<any>> = [];

async function handleEnvelope(envelope: EnvelopePlus) {
  // TODO: enable below

  // if (this.stoppingProcessing) {
  //   return Promise.resolve();
  // }

  if (envelope.content && envelope.content.length > 0) {
    return handleContentMessage(envelope);
  }

  await removeFromCache(envelope);
  throw new Error('Received message with no content and no legacyMessage');
}

class EnvelopeQueue {
  private count: number = 0;

  // Last pending promise
  private pending: Promise<any> = Promise.resolve();

  public add(task: any): void {
    this.count += 1;
    const promise = this.pending.then(task, task);
    this.pending = promise;

    this.pending.then(this.cleanup.bind(this, promise), this.cleanup.bind(this, promise));
  }

  private cleanup(promise: Promise<any>) {
    // We want to clear out the promise chain whenever possible because it could
    //   lead to large memory usage over time:
    //   https://github.com/nodejs/node/issues/6673#issuecomment-244331609
    if (this.pending === promise) {
      this.pending = Promise.resolve();
    }
  }
}

const envelopeQueue = new EnvelopeQueue();

function queueEnvelope(envelope: EnvelopePlus) {
  const id = getEnvelopeId(envelope);
  window.log.info('queueing envelope', id);

  const task = handleEnvelope.bind(null, envelope);
  const taskWithTimeout = window.textsecure.createTaskWithTimeout(task, `queueEnvelope ${id}`);

  try {
    envelopeQueue.add(taskWithTimeout);
  } catch (error) {
    window.log.error(
      'queueEnvelope error handling envelope',
      id,
      ':',
      error && error.stack ? error.stack : error
    );
  }
}

async function handleRequestDetail(
  plaintext: Uint8Array,
  options: ReqOptions,
  lastPromise: Promise<any>
): Promise<void> {
  const envelope: any = SignalService.Envelope.decode(plaintext);

  // After this point, decoding errors are not the server's
  //   fault, and we should handle them gracefully and tell the
  //   user they received an invalid message

  // The message is for a medium size group
  if (options.conversationId) {
    const ourNumber = UserUtils.getOurPubKeyStrFromCache();
    const senderIdentity = envelope.source;

    if (senderIdentity === ourNumber) {
      return;
    }

    // Sender identity will be lost if we load from cache, because
    // plaintext (and protobuf.Envelope) does not have that field...
    envelope.source = options.conversationId;
    // tslint:disable-next-line no-parameter-reassignment
    plaintext = SignalService.Envelope.encode(envelope).finish();
    envelope.senderIdentity = senderIdentity;
  }

  envelope.id = envelope.serverGuid || uuidv4();
  envelope.serverTimestamp = envelope.serverTimestamp ? envelope.serverTimestamp.toNumber() : null;

  try {
    // NOTE: Annoyngly we add plaintext to the cache
    // after we've already processed some of it (thus the
    // need to handle senderIdentity separately)...

    await addToCache(envelope, plaintext);

    // TODO: This is the glue between the first and the last part of the
    // receiving pipeline refactor. It is to be implemented in the next PR.

    // To ensure that we queue in the same order we receive messages

    await lastPromise;

    queueEnvelope(envelope);
  } catch (error) {
    window.log.error(
      'handleRequest error trying to add message to cache:',
      error && error.stack ? error.stack : error
    );
  }
}

export function handleRequest(body: any, options: ReqOptions): void {
  // tslint:disable-next-line no-promise-as-boolean
  const lastPromise = _.last(incomingMessagePromises) || Promise.resolve();

  const plaintext = body;

  const promise = handleRequestDetail(plaintext, options, lastPromise).catch(e => {
    window.log.error('Error handling incoming message:', e && e.stack ? e.stack : e);

    void onError(e);
  });

  incomingMessagePromises.push(promise);
}
// tslint:enable:cyclomatic-complexity max-func-body-length */

// ***********************************************************************
// ***********************************************************************
// ***********************************************************************

export async function queueAllCached() {
  const items = await getAllFromCache();
  items.forEach(async item => {
    await queueCached(item);
  });
}

export async function queueAllCachedFromSource(source: string) {
  const items = await getAllFromCacheForSource(source);

  // queue all cached for this source, but keep the order
  await items.reduce(async (promise, item) => {
    await promise;
    await queueCached(item);
  }, Promise.resolve());
}

async function queueCached(item: any) {
  try {
    const envelopePlaintext = StringUtils.encode(item.envelope, 'base64');
    const envelopeArray = new Uint8Array(envelopePlaintext);

    const envelope: any = SignalService.Envelope.decode(envelopeArray);
    envelope.id = envelope.serverGuid || item.id;
    envelope.source = envelope.source || item.source;

    // Why do we need to do this???
    envelope.sourceDevice = 1;
    envelope.senderIdentity = envelope.senderIdentity || item.senderIdentity;
    envelope.serverTimestamp = envelope.serverTimestamp || item.serverTimestamp;

    const { decrypted } = item;

    if (decrypted) {
      const payloadPlaintext = StringUtils.encode(decrypted, 'base64');

      queueDecryptedEnvelope(envelope, payloadPlaintext);
    } else {
      queueEnvelope(envelope);
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
      await removeUnprocessed(id);
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

function queueDecryptedEnvelope(envelope: any, plaintext: ArrayBuffer) {
  const id = getEnvelopeId(envelope);
  window.log.info('queueing decrypted envelope', id);

  const task = handleDecryptedEnvelope.bind(null, envelope, plaintext);
  const taskWithTimeout = window.textsecure.createTaskWithTimeout(
    task,
    `queueEncryptedEnvelope ${id}`
  );
  try {
    envelopeQueue.add(taskWithTimeout);
  } catch (error) {
    window.log.error(
      `queueDecryptedEnvelope error handling envelope ${id}:`,
      error && error.stack ? error.stack : error
    );
  }
}

async function handleDecryptedEnvelope(envelope: EnvelopePlus, plaintext: ArrayBuffer) {
  // if (this.stoppingProcessing) {
  //   return Promise.resolve();
  // }

  if (envelope.content) {
    await innerHandleContentMessage(envelope, plaintext);
  } else {
    await removeFromCache(envelope);
  }
}

/**
 * Only used for opengroupv1 it seems.
 * To be removed soon
 */
export async function handlePublicMessage(messageData: any) {
  const { source } = messageData;
  const { group, profile, profileKey } = messageData.message;

  const isMe = UserUtils.isUsFromCache(source);

  if (!isMe && profile) {
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      source,
      ConversationTypeEnum.PRIVATE
    );
    await updateProfileOneAtATime(conversation, profile, profileKey);
  }

  const isPublicVisibleMessage = group && group.id && !!group.id.match(openGroupPrefixRegex);

  if (!isPublicVisibleMessage) {
    throw new Error('handlePublicMessage Should only be called with public message groups');
  }

  const ev = {
    // Public chat messages from ourselves should be outgoing
    type: isMe ? 'sent' : 'message',
    data: messageData,
    confirm: () => {
      /* do nothing */
    },
  };

  await handleMessageEvent(ev); // open groups v1
}

export async function handleOpenGroupV2Message(
  message: OpenGroupMessageV2,
  roomInfos: OpenGroupRequestCommonType
) {
  const { base64EncodedData, sentTimestamp, sender, serverId } = message;
  const { serverUrl, roomId } = roomInfos;
  if (!base64EncodedData || !sentTimestamp || !sender || !serverId) {
    window.log.warn('Invalid data passed to handleMessageEvent.', message);
    return;
  }

  // Note: opengroup messages are not padded
  const dataUint = new Uint8Array(removeMessagePadding(fromBase64ToArray(base64EncodedData)));

  const decoded = SignalService.Content.decode(dataUint);

  const conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);
  if (!conversationId) {
    window.log.error('We cannot handle a message without a conversationId');
    return;
  }
  const dataMessage = decoded?.dataMessage;
  if (!dataMessage) {
    window.log.error('Invalid decoded opengroup message: no dataMessage');
    return;
  }

  if (!ConversationController.getInstance().get(conversationId)) {
    window.log.error('Received a message for an unknown convo. Skipping');
    return;
  }
  const isMe = UserUtils.isUsFromCache(sender);
  // for an opengroupv2 incoming message the serverTimestamp and the timestamp
  const messageCreationData: MessageCreationData = {
    isPublic: true,
    sourceDevice: 1,
    serverId,
    serverTimestamp: sentTimestamp,
    receivedAt: Date.now(),
    destination: conversationId,
    timestamp: sentTimestamp,
    unidentifiedStatus: undefined,
    expirationStartTimestamp: undefined,
    source: sender,
    message: dataMessage,
  };

  if (await isMessageDuplicate(messageCreationData)) {
    window.log.info('Received duplicate message. Dropping it.');
    return;
  }

  // this line just create an empty message with some basic stuff set.
  // the whole decoding of data is happening in handleMessageJob()
  const msg = createMessage(messageCreationData, !isMe);

  // if the message is `sent` (from secondary device) we have to set the sender manually... (at least for now)
  // source = source || msg.get('source');

  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const conversation = await ConversationController.getInstance().getOrCreateAndWait(
    conversationId,
    ConversationTypeEnum.GROUP
  );

  if (!conversation) {
    window.log.warn('Skipping handleJob for unknown convo: ', conversationId);
    return;
  }

  conversation.queueJob(async () => {
    await handleMessageJob(msg, conversation, decoded?.dataMessage, ourNumber, noop, sender);
  });
}
