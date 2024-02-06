// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createReadStream } from 'fs';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

import { SignalService as Proto } from '../protobuf';
import protobuf from '../protobuf/wrap';
import { normalizeAci } from '../util/normalizeAci';
import { isAciString } from '../util/isAciString';
import { DurationInSeconds } from '../util/durations';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import type { ContactAvatarType } from '../types/Avatar';
import { computeHash } from '../Crypto';
import { dropNull } from '../util/dropNull';

import Avatar = Proto.ContactDetails.IAvatar;

const { Reader } = protobuf;

type OptionalFields = {
  avatar?: Avatar | null;
  expireTimer?: number | null;
  number?: string | null;
};

type MessageWithAvatar<Message extends OptionalFields> = Omit<
  Message,
  'avatar' | 'toJSON'
> & {
  avatar?: ContactAvatarType;
  expireTimer?: DurationInSeconds;
  number?: string | undefined;
};

export type ContactDetailsWithAvatar = MessageWithAvatar<Proto.IContactDetails>;

export async function parseContactsV2({
  absolutePath,
}: {
  absolutePath: string;
}): Promise<ReadonlyArray<ContactDetailsWithAvatar>> {
  const logId = 'parseContactsV2';

  const readStream = createReadStream(absolutePath);
  const parseContactsTransform = new ParseContactsTransform();

  try {
    await pipeline(readStream, parseContactsTransform);
  } catch (error) {
    try {
      readStream.close();
    } catch (cleanupError) {
      log.error(
        `${logId}: Failed to clean up after error`,
        Errors.toLogFormat(cleanupError)
      );
    }

    throw error;
  }

  readStream.close();

  return parseContactsTransform.contacts;
}

// This transform pulls contacts and their avatars from a stream of bytes. This is tricky,
//   because the chunk boundaries might fall in the middle of a contact or their avatar.
//   So we are ready for decodeDelimited() to throw, and to keep activeContact around
//   while we wait for more chunks to get to the expected avatar size.
// Note: exported only for testing
export class ParseContactsTransform extends Transform {
  public contacts: Array<ContactDetailsWithAvatar> = [];

  public activeContact: Proto.ContactDetails | undefined;
  private unused: Uint8Array | undefined;

  override async _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ): Promise<void> {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      let data = chunk;
      if (this.unused) {
        data = Buffer.concat([this.unused, data]);
        this.unused = undefined;
      }

      const reader = Reader.create(data);
      while (reader.pos < reader.len) {
        const startPos = reader.pos;

        if (!this.activeContact) {
          try {
            this.activeContact = Proto.ContactDetails.decodeDelimited(reader);
          } catch (err) {
            // We get a RangeError if there wasn't enough data to read the next record.
            if (err instanceof RangeError) {
              // Note: A failed decodeDelimited() does in fact update reader.pos, so we
              //   must reset to startPos
              this.unused = data.subarray(startPos);
              done();
              return;
            }

            // Something deeper has gone wrong; the proto is malformed or something
            done(err);
            return;
          }
        }

        // Something has really gone wrong if the above parsing didn't throw but gave
        //   us nothing back. Let's end the parse.
        if (!this.activeContact) {
          done(new Error('ParseContactsTransform: No active contact!'));
          return;
        }

        const attachmentSize = this.activeContact?.avatar?.length ?? 0;
        if (attachmentSize === 0) {
          // No avatar attachment for this contact
          const prepared = prepareContact(this.activeContact);
          if (prepared) {
            this.contacts.push(prepared);
          }
          this.activeContact = undefined;

          continue;
        }

        const spaceLeftAfterRead = reader.len - (reader.pos + attachmentSize);
        if (spaceLeftAfterRead >= 0) {
          // We've read enough data to read the entire attachment
          const avatarData = reader.buf.slice(
            reader.pos,
            reader.pos + attachmentSize
          );
          const hash = computeHash(data);

          // eslint-disable-next-line no-await-in-loop
          const path = await window.Signal.Migrations.writeNewAttachmentData(
            avatarData
          );

          const prepared = prepareContact(this.activeContact, {
            ...this.activeContact.avatar,
            hash,
            path,
          });
          if (prepared) {
            this.contacts.push(prepared);
          } else {
            // eslint-disable-next-line no-await-in-loop
            await window.Signal.Migrations.deleteAttachmentData(path);
          }
          this.activeContact = undefined;

          reader.skip(attachmentSize);
        } else {
          // We have an attachment, but we haven't read enough data yet. We need to
          //   wait for another chunk.
          this.unused = data.subarray(reader.pos);
          done();
          return;
        }
      }

      // No need to push; no downstream consumers!
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

function prepareContact(
  proto: Proto.ContactDetails,
  avatar?: ContactAvatarType
): ContactDetailsWithAvatar | undefined {
  const expireTimer =
    proto.expireTimer != null
      ? DurationInSeconds.fromSeconds(proto.expireTimer)
      : undefined;

  // We reject incoming contacts with invalid aci information
  if (proto.aci && !isAciString(proto.aci)) {
    log.warn('ParseContactsTransform: Dropping contact with invalid aci');

    return undefined;
  }

  const aci = proto.aci
    ? normalizeAci(proto.aci, 'ContactBuffer.aci')
    : proto.aci;

  const result = {
    ...proto,
    expireTimer,
    aci,
    avatar,
    number: dropNull(proto.number),
  };

  return result;
}
