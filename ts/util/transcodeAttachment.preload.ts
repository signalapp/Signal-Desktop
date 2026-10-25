// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable, PassThrough } from 'node:stream';
import { sanitize } from '@signalapp/libsignal-client/dist/Mp4Sanitizer.js';

import { CURRENT_ATTACHMENT_VERSION } from '../../app/attachments.node.ts';
import { toLogFormat } from '../types/errors.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import type { MessageModel } from '../models/messages.preload.ts';
import type {
  AttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment.std.ts';
import {
  generateKeys,
  decryptAttachmentV2ToSink,
  encryptAttachmentV2ToDisk,
  type DecryptAttachmentToSinkOptionsType,
} from '../AttachmentCrypto.node.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { NodeInputStream } from './NodeInputStream.node.ts';
import {
  maybeDeleteAttachmentFile,
  getAbsoluteAttachmentPath,
} from './migrations.preload.ts';
import { updateAttachment } from './editHelpers.std.ts';
import { strictAssert } from './assert.std.ts';
import { isVideoTypeSupported } from './GoogleChrome.std.ts';
import { prefixAndSliceStream } from './prefixAndSliceStream.std.ts';

async function streamMP4Sanitize(
  log: LoggerType,
  attachment: AttachmentType
): Promise<LocalAttachmentV2Type | undefined> {
  strictAssert(attachment.path != null, 'Attachment must be on disk');
  strictAssert(attachment.localKey != null, 'Attachment must be encrypted');

  const passthrough = new PassThrough();

  const decryptOptions: DecryptAttachmentToSinkOptionsType = {
    idForLogging: `transcodeAttachment(${attachment.clientUuid})`,
    size: attachment.size,
    ciphertextPath: getAbsoluteAttachmentPath(attachment.path),
    type: 'local',
    keysBase64: attachment.localKey,
  };

  const [result] = await Promise.all([
    sanitize(new NodeInputStream(passthrough), BigInt(attachment.size)),
    decryptAttachmentV2ToSink(decryptOptions, passthrough),
  ]);

  const metadata = result.getMetadata();

  // If there is no metadata - mp4 is already in the fast state!
  if (metadata == null) {
    log.info('mp4san not needed');
    return undefined;
  }

  const copy = new PassThrough();

  const dataStart = Number(result.getDataOffset());
  const dataEnd = dataStart + Number(result.getDataLen());

  const keys = generateKeys();
  const resultSize = metadata.byteLength + Number(result.getDataLen());

  const [encrypted] = await Promise.all([
    encryptAttachmentV2ToDisk({
      getAbsoluteAttachmentPath,
      keys,
      needIncrementalMac: true,
      plaintext: {
        stream: Readable.from(
          prefixAndSliceStream(copy, dataStart, dataEnd, metadata)
        ),
        size: resultSize,
      },
    }),
    decryptAttachmentV2ToSink(decryptOptions, copy),
  ]);

  log.info('mp4san applied');

  return {
    version: CURRENT_ATTACHMENT_VERSION,
    plaintextHash: encrypted.plaintextHash,
    size: resultSize,
    path: encrypted.path,
    localKey: Buffer.from(keys).toString('base64'),
  };
}

export async function transcodeAttachment({
  log,
  attachment,
  message,
  targetTimestamp,
}: {
  log: LoggerType;
  attachment: AttachmentType;
  message: MessageModel;
  targetTimestamp: number;
}): Promise<AttachmentType> {
  const { transcodingTargetQuality } = attachment;
  if (transcodingTargetQuality == null) {
    return attachment;
  }

  let newFields: LocalAttachmentV2Type | undefined;
  if (isVideoTypeSupported(attachment.contentType)) {
    log.info('running mp4san');

    try {
      newFields = await streamMP4Sanitize(log, attachment);
    } catch (error) {
      log.warn(`Failed to mp4san video ${toLogFormat(error)}`);
    }
  }

  const attachmentUpdate: Partial<AttachmentType> = {
    ...newFields,
    transcodingTargetQuality: undefined,
  };

  const { messageUpdate, newAttachment } = updateAttachment({
    log,
    message: message.attributes,
    targetTimestamp,
    oldAttachment: attachment,
    attachmentUpdate,
  });

  if (messageUpdate) {
    log.info('saving transcoded attachment');
    message.set(messageUpdate);

    // Save message after transcoding the attachment
    await window.MessageCache.saveMessage(message.attributes);
  }

  // Release reuseToken if given to us
  if (attachment.reuseToken != null) {
    await DataWriter.releaseAttachmentPathProtections(attachment);
  }

  // Delete old attachment if it is not referenced by other message
  strictAssert(attachment.path != null, 'Must have old path');
  await maybeDeleteAttachmentFile(attachment.path);

  return newAttachment;
}
