import { EnvelopePlus } from './types';
export { downloadAttachment } from './attachments';
import { v4 as uuidv4 } from 'uuid';

import { addToCache, getAllFromCache, getAllFromCacheForSource, removeFromCache } from './cache';

// innerHandleSwarmContentMessage is only needed because of code duplication in handleDecryptedEnvelope...
import { handleSwarmContentMessage, innerHandleSwarmContentMessage } from './contentMessage';
import _ from 'lodash';

import { getEnvelopeId } from './common';
import { StringUtils, UserUtils } from '../session/utils';
import { SignalService } from '../protobuf';
import { removeUnprocessed } from '../data/data';
import { createTaskWithTimeout } from '../session/utils/TaskWithTimeout';
import { perfEnd, perfStart } from '../session/utils/Performance';

// TODO: check if some of these exports no longer needed

interface ReqOptions {
  conversationId: string;
}

const incomingMessagePromises: Array<Promise<any>> = [];

async function handleSwarmEnvelope(envelope: EnvelopePlus, messageHash: string) {
  if (envelope.content && envelope.content.length > 0) {
    return handleSwarmContentMessage(envelope, messageHash);
  }

  await removeFromCache(envelope);
  throw new Error('Received message with no content and no legacyMessage');
}

class EnvelopeQueue {
  // Last pending promise
  private pending: Promise<any> = Promise.resolve();

  public add(task: any): void {
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

function queueSwarmEnvelope(envelope: EnvelopePlus, messageHash: string) {
  const id = getEnvelopeId(envelope);
  // window?.log?.info('queueing envelope', id);

  const task = handleSwarmEnvelope.bind(null, envelope, messageHash);
  const taskWithTimeout = createTaskWithTimeout(task, `queueSwarmEnvelope ${id}`);

  try {
    envelopeQueue.add(taskWithTimeout);
  } catch (error) {
    window?.log?.error(
      'queueSwarmEnvelope error handling envelope',
      id,
      ':',
      error && error.stack ? error.stack : error
    );
  }
}

async function handleRequestDetail(
  plaintext: Uint8Array,
  options: ReqOptions,
  lastPromise: Promise<any>,
  messageHash: string
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
  envelope.messageHash = messageHash;

  try {
    // NOTE: Annoyngly we add plaintext to the cache
    // after we've already processed some of it (thus the
    // need to handle senderIdentity separately)...
    perfStart(`addToCache-${envelope.id}`);

    await addToCache(envelope, plaintext, messageHash);
    perfEnd(`addToCache-${envelope.id}`, 'addToCache');

    // TODO: This is the glue between the first and the last part of the
    // receiving pipeline refactor. It is to be implemented in the next PR.

    // To ensure that we queue in the same order we receive messages

    await lastPromise;

    queueSwarmEnvelope(envelope, messageHash);
  } catch (error) {
    window?.log?.error(
      'handleRequest error trying to add message to cache:',
      error && error.stack ? error.stack : error
    );
  }
}

export function handleRequest(plaintext: any, options: ReqOptions, messageHash: string): void {
  // tslint:disable-next-line no-promise-as-boolean
  const lastPromise = _.last(incomingMessagePromises) || Promise.resolve();

  const promise = handleRequestDetail(plaintext, options, lastPromise, messageHash).catch(e => {
    window?.log?.error('Error handling incoming message:', e && e.stack ? e.stack : e);
  });

  incomingMessagePromises.push(promise);
}

// tslint:enable:cyclomatic-complexity max-func-body-length */
/**
 * Used in main_renderer.js
 */
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
    envelope.senderIdentity = envelope.senderIdentity || item.senderIdentity;
    envelope.serverTimestamp = envelope.serverTimestamp || item.serverTimestamp;

    const { decrypted } = item;

    if (decrypted) {
      const payloadPlaintext = StringUtils.encode(decrypted, 'base64');

      queueDecryptedEnvelope(envelope, payloadPlaintext, envelope.messageHash);
    } else {
      queueSwarmEnvelope(envelope, envelope.messageHash);
    }
  } catch (error) {
    window?.log?.error(
      'queueCached error handling item',
      item.id,
      'removing it. Error:',
      error && error.stack ? error.stack : error
    );

    try {
      const { id } = item;
      await removeUnprocessed(id);
    } catch (deleteError) {
      window?.log?.error(
        'queueCached error deleting item',
        item.id,
        'Error:',
        deleteError && deleteError.stack ? deleteError.stack : deleteError
      );
    }
  }
}

function queueDecryptedEnvelope(envelope: any, plaintext: ArrayBuffer, messageHash: string) {
  const id = getEnvelopeId(envelope);
  window?.log?.info('queueing decrypted envelope', id);

  const task = handleDecryptedEnvelope.bind(null, envelope, plaintext, messageHash);
  const taskWithTimeout = createTaskWithTimeout(task, `queueEncryptedEnvelope ${id}`);
  try {
    envelopeQueue.add(taskWithTimeout);
  } catch (error) {
    window?.log?.error(
      `queueDecryptedEnvelope error handling envelope ${id}:`,
      error && error.stack ? error.stack : error
    );
  }
}

async function handleDecryptedEnvelope(
  envelope: EnvelopePlus,
  plaintext: ArrayBuffer,
  messageHash: string
) {
  if (envelope.content) {
    const sentAtTimestamp = _.toNumber(envelope.timestamp);

    await innerHandleSwarmContentMessage(envelope, sentAtTimestamp, plaintext, messageHash);
  } else {
    await removeFromCache(envelope);
  }
}
