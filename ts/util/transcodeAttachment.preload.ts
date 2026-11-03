// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable, PassThrough } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { open, unlink, type FileHandle } from 'node:fs/promises';
import { sanitize } from '@signalapp/libsignal-client/dist/Mp4Sanitizer.js';
import {
  Input,
  UrlSource,
  ALL_FORMATS,
  StreamTarget,
  Conversion,
  Output,
  Mp4OutputFormat,
  Quality,
  type ConversionVideoOptions,
} from 'mediabunny';

import { CURRENT_ATTACHMENT_VERSION } from '../../app/attachments.node.ts';
import { toLogFormat } from '../types/errors.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import {
  getAttachmentSizeLimit,
  isAttachmentTooLarge,
} from '../types/AttachmentSize.std.ts';
import type { MessageModel } from '../models/messages.preload.ts';
import type {
  AttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment.std.ts';
import { TranscodingTargetQuality } from '../types/transcoding.std.ts';
import { VIDEO_MP4 } from '../types/MIME.std.ts';
import {
  generateKeys,
  decryptAttachmentV2ToSink,
  encryptAttachmentV2ToDisk,
  type DecryptAttachmentToSinkOptionsType,
} from '../AttachmentCrypto.node.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { getValue as getRemoteConfigValue } from '../RemoteConfig.dom.ts';
import { NodeInputStream } from './NodeInputStream.node.ts';
import {
  maybeDeleteAttachmentFile,
  getAbsoluteAttachmentPath,
  getAbsoluteTempPath,
} from './migrations.preload.ts';
import { updateAttachment } from './editHelpers.std.ts';
import { strictAssert } from './assert.std.ts';
import { drop } from './drop.std.ts';
import { isVideoTypeSupported } from './GoogleChrome.std.ts';
import { prefixAndSliceStream } from './prefixAndSliceStream.std.ts';
import { getTranscodingOptions } from './getTranscodingOptions.preload.ts';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from './getLocalAttachmentUrl.std.ts';
import { createName } from './attachmentPath.node.ts';
import { CiphertextReconciler } from './CiphertextReconciler.node.ts';

type TranscodingFieldsType = LocalAttachmentV2Type &
  Partial<Pick<AttachmentType, 'contentType'>>;

async function streamMP4Sanitize(
  log: LoggerType,
  attachment: AttachmentType
): Promise<TranscodingFieldsType | undefined> {
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
      needIncrementalMac: false,
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
    contentType: attachment.contentType,
  };
}

async function transcodeVideo(
  attachment: AttachmentType,
  options: Awaited<ReturnType<typeof getTranscodingOptions>>,
  abortSignal?: AbortSignal
): Promise<TranscodingFieldsType> {
  strictAssert(attachment.path != null, 'Attachment must be on disk');
  strictAssert(attachment.localKey != null, 'Attachment must be encrypted');
  strictAssert(attachment.duration != null, 'Attachment must have duration');

  const { transcodingTargetQuality } = attachment;
  strictAssert(
    transcodingTargetQuality != null,
    'Attachment must have transcoding options'
  );

  const url = getLocalAttachmentUrl(attachment, {
    disposition: AttachmentDisposition.Attachment,
  });

  const source = new UrlSource(url);

  const input = new Input({
    formats: ALL_FORMATS,
    source,
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (videoTrack == null) {
    throw new Error('No video track');
  }

  const [width, height] = await Promise.all([
    videoTrack.getDisplayWidth(),
    videoTrack.getDisplayHeight(),
  ]);

  const tmpPath = getAbsoluteTempPath(createName());
  let file: FileHandle | undefined;

  await using tmpStream = createWriteStream(tmpPath);

  const reconciler = new CiphertextReconciler({
    writableStream: tmpStream,
    read: async ({ start, end }) => {
      if (!file) {
        file = await open(tmpPath);
      }
      const chunk = Buffer.alloc(end - start);
      const { bytesRead } = await file.read(chunk, {
        position: start,
      });
      strictAssert(
        bytesRead === chunk.byteLength,
        'Read less bytes than expected'
      );
      return chunk;
    },
    removeFile: async () => {
      await file?.close();
      file = undefined;
      await unlink(tmpPath);
    },
  });

  const target = new StreamTarget(
    new WritableStream({
      write: async chunk => {
        return reconciler.write(chunk.data, chunk.position);
      },
    })
  );

  const output = new Output({
    target,
    format: new Mp4OutputFormat({
      fastStart: 'reserve',
    }),
  });

  // Compute rough bitrate over a second or so
  const { averageBitrate: sourceVideoBitrate } =
    await videoTrack.computePacketStats(30);

  const quality = new Quality({
    bitrate: Math.floor(
      Math.min(sourceVideoBitrate, options.videoBitrateMbps * 1e6)
    ),
    bitrateMode: 'constant',
  });

  const videoOptions: ConversionVideoOptions = {
    quality,
  };

  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary', // Keep only one track per type
    video:
      width > height
        ? {
            // Horizontal video
            ...videoOptions,
            height: Math.min(height, options.resolution),
          }
        : {
            // Vertical video
            ...videoOptions,
            width: Math.min(width, options.resolution),
          },
    // TODO(indutny): verify that creation time is not preserved
    // Don't preserve metadata
    tags: () => ({
      creationTime: null,
    }),
  });

  if (!conversion.isValid) {
    throw new Error('Failed to transcode');
  }

  const onAbort = () => {
    drop(conversion.cancel());
  };
  abortSignal?.addEventListener('abort', onAbort);

  try {
    await conversion.execute({ pauseSignal: abortSignal });
  } finally {
    abortSignal?.removeEventListener('abort', onAbort);
  }

  const keys = generateKeys();
  const encrypted = await encryptAttachmentV2ToDisk({
    getAbsoluteAttachmentPath,
    keys,
    needIncrementalMac: false,
    plaintext: {
      stream: Readable.from(reconciler.reconcile()),
    },
  });

  return {
    contentType: VIDEO_MP4,
    version: CURRENT_ATTACHMENT_VERSION,
    plaintextHash: encrypted.plaintextHash,
    size: reconciler.plaintextSize,
    path: encrypted.path,
    localKey: Buffer.from(keys).toString('base64'),
  };
}

export async function transcodeAttachment({
  log,
  attachment,
  message,
  targetTimestamp,
  abortSignal,
}: {
  log: LoggerType;
  attachment: AttachmentType;
  message: MessageModel;
  targetTimestamp: number;
  abortSignal?: AbortSignal;
}): Promise<AttachmentType> {
  const { transcodingTargetQuality, duration } = attachment;
  if (transcodingTargetQuality == null) {
    return attachment;
  }

  let newFields: TranscodingFieldsType | undefined;
  if (attachment.reuseToken != null) {
    // Do nothing with reused attachments to save disk space
  } else if (isVideoTypeSupported(attachment.contentType)) {
    const qualityToTry = [transcodingTargetQuality];

    // Fallback to standard quality as the last resort
    if (transcodingTargetQuality !== TranscodingTargetQuality.Standard) {
      qualityToTry.push(TranscodingTargetQuality.Standard);
    }

    const sizeLimit = getAttachmentSizeLimit({
      contentType: attachment.contentType,
      getRemoteConfigValue,
    });

    let transcodingFields: TranscodingFieldsType | undefined;
    try {
      strictAssert(duration != null, 'Missing video duration');

      for (const targetQuality of qualityToTry) {
        log.info(`transcoding to ${targetQuality} quality`);
        // oxlint-disable-next-line no-await-in-loop
        transcodingFields = await transcodeVideo(
          attachment,
          getTranscodingOptions(targetQuality, duration),
          abortSignal
        );

        if (
          isAttachmentTooLarge({
            plaintextSize: transcodingFields.size,
            ciphertextLimit: sizeLimit,
          })
        ) {
          log.warn(`transcoded file too large ${transcodingFields.size}`);

          // Delete the transcoded attachment after sanitization
          // oxlint-disable-next-line no-await-in-loop
          await maybeDeleteAttachmentFile(transcodingFields.path);
          transcodingFields = undefined;
        }

        if (transcodingFields != null) {
          break;
        }
      }
    } catch (error) {
      log.warn(`Failed to transcode video ${toLogFormat(error)}`);
    }

    let sanitizeFields: LocalAttachmentV2Type | undefined;
    try {
      sanitizeFields = await streamMP4Sanitize(log, {
        ...attachment,
        ...transcodingFields,
      });
    } catch (error) {
      log.warn(`Failed to mp4san video ${toLogFormat(error)}`);
    }

    if (sanitizeFields != null && transcodingFields != null) {
      // Delete the transcoded attachment after sanitization
      await maybeDeleteAttachmentFile(transcodingFields.path);
      transcodingFields = undefined;
    }
    newFields = sanitizeFields ?? transcodingFields;
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
