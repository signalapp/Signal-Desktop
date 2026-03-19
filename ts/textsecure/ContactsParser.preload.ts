// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { DurationInSeconds } from '../util/durations/index.std.js';
import { DelimitedStream } from '../util/DelimitedStream.node.js';
import {
  getAbsoluteAttachmentPath,
  writeNewAttachmentData,
} from '../util/migrations.preload.js';
import { strictAssert } from '../util/assert.std.js';
import type { ContactAvatarType } from '../types/Avatar.std.js';
import type { AttachmentType } from '../types/Attachment.std.js';
import type { AciString } from '../types/ServiceId.std.js';
import { computeHash } from '../Crypto.node.js';
import { fromAciUuidBytesOrString } from '../util/ServiceId.node.js';
import * as Bytes from '../Bytes.std.js';
import { decryptAttachmentV2ToSink } from '../AttachmentCrypto.node.js';

import Avatar = Proto.ContactDetails.Avatar.Params;
import { stringToMIMEType } from '../types/MIME.std.js';

const log = createLogger('ContactsParser');

type OptionalFields = {
  avatar?: Avatar | null;
  expireTimer?: number | null;
  number?: string | null;
};

type MessageWithAvatar<Message extends OptionalFields> = Omit<
  Message,
  'avatar' | 'toJSON' | 'aci' | 'aciBinary' | 'expireTimer'
> & {
  aci: AciString;
  avatar?: ContactAvatarType;
  expireTimer?: DurationInSeconds;
  expireTimerVersion: number | null;
  number?: string | undefined;
};

export type ContactDetailsWithAvatar =
  MessageWithAvatar<Proto.ContactDetails.Params>;

export async function parseContactsV2(
  attachment: AttachmentType
): Promise<ReadonlyArray<ContactDetailsWithAvatar>> {
  if (!attachment.path) {
    throw new Error('Contact attachment not downloaded');
  }
  if (attachment.version !== 2) {
    throw new Error('Contact attachment is not up-to-date');
  }
  if (attachment.localKey == null) {
    throw new Error('Contact attachment has no keys');
  }

  const parseContactsTransform = new ParseContactsTransform();
  const contacts = new Array<ContactDetailsWithAvatar>();
  parseContactsTransform.on('data', contact => contacts.push(contact));

  await decryptAttachmentV2ToSink(
    {
      idForLogging: 'parseContactsV2',

      ciphertextPath: getAbsoluteAttachmentPath(attachment.path),
      keysBase64: attachment.localKey,
      size: attachment.size,
      type: 'local',
    },
    parseContactsTransform
  );

  return contacts;
}

// This transform pulls contacts and their avatars from a stream of bytes. This is tricky,
//   because the chunk boundaries might fall in the middle of a contact or their avatar.
//   So we are ready for decodeDelimited() to throw, and to keep activeContact around
//   while we wait for more chunks to get to the expected avatar size.
// Note: exported only for testing
export class ParseContactsTransform extends DelimitedStream {
  protected override getTrailerSize(frame: Buffer<ArrayBuffer>): number {
    const contact = Proto.ContactDetails.decode(frame);
    return contact.avatar?.length ?? 0;
  }

  protected override async pushFrame(
    frame: Buffer<ArrayBuffer>,
    avatarData: Buffer<ArrayBuffer>
  ): Promise<void> {
    const contact = Proto.ContactDetails.decode(frame);

    this.push(await prepareContact(contact, avatarData));
  }
}

async function prepareContact(
  { aci: rawAci, aciBinary, ...proto }: Proto.ContactDetails,
  avatarData: Uint8Array<ArrayBuffer>
): Promise<ContactDetailsWithAvatar | undefined> {
  const expireTimer =
    proto.expireTimer != null
      ? DurationInSeconds.fromSeconds(proto.expireTimer)
      : undefined;

  const aci = fromAciUuidBytesOrString(
    aciBinary,
    rawAci ?? '',
    'ContactBuffer.aci'
  );

  if ((Bytes.isNotEmpty(aciBinary) || rawAci) && aci == null) {
    log.warn('ParseContactsTransform: Dropping contact with invalid aci');
    return undefined;
  }

  let avatar: ContactAvatarType | undefined;
  if (avatarData.byteLength > 0) {
    strictAssert(proto.avatar != null, 'Expected avatar with avatar data');

    const hash = computeHash(avatarData);

    const local = await writeNewAttachmentData(avatarData);

    const contentType = proto.avatar?.contentType;
    avatar = {
      ...proto.avatar,
      ...local,
      contentType: contentType ? stringToMIMEType(contentType) : undefined,
      hash,
    };
  }

  return {
    ...proto,
    expireTimer,
    aci,
    avatar,
    number: proto.number ?? '',
  };
}
