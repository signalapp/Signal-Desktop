// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getPlaintextHashForAttachmentOnDisk } from '../../AttachmentCrypto';
import type { AttachmentType } from '../../types/Attachment';
import { DAY } from '../durations';
import * as log from '../../logging/log';
import { isOlderThan } from '../timestamp';
import { getCdn } from '../../textsecure/downloadAttachment';
import * as Bytes from '../../Bytes';

const TIME_IN_ATTACHMENT_TIER = 30 * DAY;

// We store the plaintext hash as a hex string, but the mediaName should be
// the base64 encoded version.
function convertHexStringToBase64(hexString: string): string {
  return Bytes.toBase64(Bytes.fromHex(hexString));
}

type GetMediaNameDependenciesType = {
  getPlaintextHashForAttachmentOnDisk: (
    path: string
  ) => Promise<string | undefined>;
};

export async function getMediaNameForBackup(
  attachment: AttachmentType,
  senderAci: string,
  messageTimestamp: number,
  // allow optional dependency injection for testing
  dependencies: GetMediaNameDependenciesType = {
    getPlaintextHashForAttachmentOnDisk,
  }
): Promise<string | undefined> {
  if (attachment.plaintextHash) {
    return convertHexStringToBase64(attachment.plaintextHash);
  }

  if (attachment.path) {
    const hashFromFileOnDisk =
      await dependencies.getPlaintextHashForAttachmentOnDisk(
        window.Signal.Migrations.getAbsoluteAttachmentPath(attachment.path)
      );
    if (!hashFromFileOnDisk) {
      log.error(
        'getMediaNameForBackup: no hash from attachment on disk (maybe it is empty?)'
      );
      return;
    }
    return convertHexStringToBase64(hashFromFileOnDisk);
  }

  const cdnKey = getCdn(attachment);
  if (!cdnKey) {
    log.error('getMediaNameForBackup: attachment has no cdnKey');
    return;
  }

  if (isOlderThan(messageTimestamp, TIME_IN_ATTACHMENT_TIER)) {
    log.error(
      "getMediaNameForBackup: attachment is not downloaded but is too old; it's no longer in attachment tier."
    );
    return;
  }

  return `${senderAci}_${cdnKey}`;
}
