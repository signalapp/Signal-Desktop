// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PassThrough } from 'stream';
import {
  type EncryptedAttachmentV2,
  ReencryptedDigestMismatchError,
  type ReencryptionInfo,
  decryptAttachmentV2ToSink,
  encryptAttachmentV2,
  generateAttachmentKeys,
} from '../AttachmentCrypto';
import {
  type AddressableAttachmentType,
  type LocallySavedAttachment,
  type ReencryptableAttachment,
  hasAllOriginalEncryptionInfo,
  isReencryptableToSameDigest,
  isReencryptableWithNewEncryptionInfo,
  getAttachmentIdForLogging,
} from '../types/Attachment';
import { strictAssert } from './assert';
import * as logging from '../logging/log';
import { fromBase64, toBase64 } from '../Bytes';
import { toLogFormat } from '../types/errors';

/**
 * Some attachments on desktop are not reencryptable to the digest we received for them.
 * This is because:
 * 1. desktop has not always saved iv & key for attachments
 * 2. android has in the past sent attachments with non-zero (random) padding
 *
 * In these cases we need to generate a new iv and key to recalculate a digest that we can
 * put in the backup proto at export time.
 */

export async function ensureAttachmentIsReencryptable(
  attachment: LocallySavedAttachment
): Promise<ReencryptableAttachment> {
  if (isReencryptableToSameDigest(attachment)) {
    return attachment;
  }

  if (isReencryptableWithNewEncryptionInfo(attachment)) {
    return attachment;
  }

  if (hasAllOriginalEncryptionInfo(attachment)) {
    try {
      await attemptToReencryptToOriginalDigest(attachment);
      return {
        ...attachment,
        isReencryptableToSameDigest: true,
      };
    } catch (e) {
      const logId = `ensureAttachmentIsReencryptable(digest=${getAttachmentIdForLogging(attachment)})`;

      if (e instanceof ReencryptedDigestMismatchError) {
        logging.info(
          `${logId}: Unable to reencrypt attachment to original digest; must have had non-zero padding`
        );
      } else {
        logging.error(`${logId}: error when reencrypting`, toLogFormat(e));
      }
    }
  }

  return {
    ...attachment,
    isReencryptableToSameDigest: false,
    reencryptionInfo: await generateNewEncryptionInfoForAttachment(attachment),
  };
}

/** Will throw if attachment cannot be reencrypted to original digest */
export async function attemptToReencryptToOriginalDigest(
  attachment: Readonly<LocallySavedAttachment>
): Promise<void> {
  if (!hasAllOriginalEncryptionInfo(attachment)) {
    throw new Error('attachment must have info for reencryption');
  }

  const { iv, key, digest } = attachment;

  if (!attachment.localKey) {
    await encryptAttachmentV2({
      keys: fromBase64(key),
      dangerousIv: {
        iv: fromBase64(iv),
        reason: 'reencrypting-for-backup',
        digestToMatch: fromBase64(digest),
      },
      plaintext: {
        absolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath(
          attachment.path
        ),
      },
      needIncrementalMac: false,
    });
  } else {
    strictAssert(attachment.size != null, 'Size must exist');

    const passthrough = new PassThrough();
    await Promise.all([
      decryptAttachmentV2ToSink(
        {
          ciphertextPath: window.Signal.Migrations.getAbsoluteAttachmentPath(
            attachment.path
          ),
          idForLogging: 'attemptToReencryptToOriginalDigest',
          size: attachment.size,
          keysBase64: attachment.localKey,
          type: 'local',
        },
        passthrough
      ),
      encryptAttachmentV2({
        plaintext: {
          stream: passthrough,
          size: attachment.size,
        },
        keys: fromBase64(key),
        dangerousIv: {
          iv: fromBase64(iv),
          reason: 'reencrypting-for-backup',
          digestToMatch: fromBase64(digest),
        },
        needIncrementalMac: false,
      }),
    ]);
  }
}

export async function generateNewEncryptionInfoForAttachment(
  attachment: Readonly<AddressableAttachmentType>
): Promise<ReencryptionInfo> {
  const newKeys = generateAttachmentKeys();

  let encryptedAttachment: EncryptedAttachmentV2;

  if (!attachment.localKey) {
    encryptedAttachment = await encryptAttachmentV2({
      keys: newKeys,
      plaintext: {
        absolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath(
          attachment.path
        ),
      },
      needIncrementalMac: false,
    });
  } else {
    const passthrough = new PassThrough();
    strictAssert(attachment.size != null, 'Size must exist');

    const result = await Promise.all([
      decryptAttachmentV2ToSink(
        {
          ciphertextPath: window.Signal.Migrations.getAbsoluteAttachmentPath(
            attachment.path
          ),
          idForLogging: 'generateNewEncryptionInfoForAttachment',
          size: attachment.size,
          keysBase64: attachment.localKey,
          type: 'local',
        },
        passthrough
      ),
      encryptAttachmentV2({
        keys: newKeys,
        plaintext: {
          stream: passthrough,
          size: attachment.size,
        },
        needIncrementalMac: false,
      }),
    ]);
    // eslint-disable-next-line prefer-destructuring
    encryptedAttachment = result[1];
  }

  return {
    digest: toBase64(encryptedAttachment.digest),
    iv: toBase64(encryptedAttachment.iv),
    key: toBase64(newKeys),
  };
}
