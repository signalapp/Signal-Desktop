// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// oxlint-disable max-classes-per-file

import { Readable } from 'node:stream';
import PQueue from 'p-queue';

import { createLogger } from '../logging/log.std.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { DurationInSeconds } from '../util/durations/index.std.ts';
import { DelimitedStream } from '../util/DelimitedStream.node.ts';
import {
  getAbsoluteAttachmentPath,
  readAttachmentData,
  writeNewAttachmentData,
} from '../util/migrations.preload.ts';
import { strictAssert } from '../util/assert.std.ts';
import { computeHash, getRandomBytes } from '../Crypto.node.ts';
import {
  fromAciUuidBytesOrString,
  toAciObject,
} from '../util/ServiceId.node.ts';
import * as Bytes from '../Bytes.std.ts';
import {
  decryptAttachmentV2ToSink,
  encryptAttachmentV2ToDisk,
} from '../AttachmentCrypto.node.ts';
import { drop } from '../util/drop.std.ts';
import { encodeDelimited } from '../util/encodeDelimited.std.ts';
import { CURRENT_ATTACHMENT_VERSION } from '../../app/attachments.node.ts';
import { INITIAL_EXPIRE_TIMER_VERSION } from '../util/expirationTimer.std.ts';
import { isNumber } from 'lodash';
import { toLogFormat } from '../types/errors.std.ts';
import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../types/MIME.std.ts';
import { KEY_SET_LENGTH } from '../types/Crypto.std.ts';

import type { ContactAvatarType } from '../types/Avatar.std.ts';
import type { AttachmentType } from '../types/Attachment.std.ts';
import type { AciString } from '../types/ServiceId.std.ts';
import type { ConversationModel } from '../models/conversations.preload.ts';

import Avatar = Proto.ContactDetails.Avatar.Params;

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

class EncodeContactsStream extends Readable {
  readonly #contacts: ReadonlyArray<ConversationModel>;
  readonly #queue = new PQueue({ concurrency: 1 });
  readonly #onComplete: (size: number) => void;

  #index = 0;
  #byteCount = 0;

  constructor({
    contacts,
    onComplete,
  }: {
    contacts: ReadonlyArray<ConversationModel>;
    onComplete: (size: number) => void;
  }) {
    super();
    this.#contacts = contacts;
    this.#onComplete = onComplete;
  }

  override push(
    chunk: Uint8Array<ArrayBuffer> | null,
    encoding?: BufferEncoding
  ): boolean {
    this.#byteCount += chunk?.byteLength ?? 0;

    return super.push(chunk, encoding);
  }

  override _read(): void {
    if (this.#index >= this.#contacts.length) {
      drop(
        this.#queue.add(() => {
          this.push(null);
          this.#onComplete(this.#byteCount);
        })
      );
      return;
    }

    const contact = this.#contacts[this.#index];
    this.#index += 1;

    if (!contact) {
      return this._read();
    }

    const aci = contact.getAci();
    if (!aci) {
      return this._read();
    }

    drop(
      this.#queue.add(async () => {
        const given = contact.get('systemGivenName');
        const family = contact.get('systemFamilyName');

        const fullName =
          given && family ? `${given} ${family}` : given || family;
        const avatar = contact.get('avatar');

        let avatarData: Uint8Array<ArrayBuffer> | undefined;
        let contentType = 'image/jpeg';
        if (avatar?.path) {
          try {
            avatarData = await readAttachmentData(avatar);

            if (avatar.contentType) {
              contentType = avatar.contentType;
            }
          } catch (error) {
            log.error(
              'encodeContact: Failed to load avatar data',
              toLogFormat(error)
            );
            avatarData = undefined;
          }
        }

        const details = Proto.ContactDetails.encode({
          number: contact.get('e164') ?? null,
          aci,
          aciBinary: toAciObject(aci).getRawUuidBytes(),
          name: fullName ?? null,
          avatar: Bytes.isNotEmpty(avatarData)
            ? {
                contentType,
                length: avatarData.byteLength,
              }
            : null,
          expireTimer: contact.get('expireTimer') ?? 0,
          expireTimerVersion:
            contact.get('expireTimerVersion') ?? INITIAL_EXPIRE_TIMER_VERSION,
          inboxPosition: null,
        });

        const [varintSize] = encodeDelimited(details);

        // First the size of the Contact proto, then the proto, then the avatar
        this.push(varintSize);
        this.push(details);
        if (Bytes.isNotEmpty(avatarData)) {
          this.push(avatarData);
        }
      })
    );
  }
}

export async function encodeContactsV2(
  contacts: ReadonlyArray<ConversationModel>
): Promise<AttachmentType> {
  let plaintextSize: number | undefined = undefined;

  const stream = new EncodeContactsStream({
    contacts,
    onComplete: size => {
      plaintextSize = size;
    },
  });
  const keys = getRandomBytes(KEY_SET_LENGTH);

  const { plaintextHash, path } = await encryptAttachmentV2ToDisk({
    plaintext: {
      stream,
    },
    keys,
    needIncrementalMac: false,
    getAbsoluteAttachmentPath,
  });

  strictAssert(
    isNumber(plaintextSize),
    'encodeContactsV2: Expect to get a plaintext size, even if it is zero'
  );

  return {
    version: CURRENT_ATTACHMENT_VERSION,
    contentType: APPLICATION_OCTET_STREAM,
    plaintextHash,
    size: plaintextSize,
    path,
    localKey: Bytes.toBase64(keys),
  };
}

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
