// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import protobuf from '../protobuf/wrap';

import { SignalService as Proto } from '../protobuf';
import { normalizeUuid } from '../util/normalizeUuid';
import { DurationInSeconds } from '../util/durations';
import * as Errors from '../types/errors';
import * as log from '../logging/log';

import Avatar = Proto.ContactDetails.IAvatar;

const { Reader } = protobuf;

type OptionalFields = { avatar?: Avatar | null; expireTimer?: number | null };

type DecoderBase<Message extends OptionalFields> = {
  decodeDelimited(reader: protobuf.Reader): Message | undefined;
};

type HydratedAvatar = Avatar & { data: Uint8Array };

type MessageWithAvatar<Message extends OptionalFields> = Omit<
  Message,
  'avatar'
> & {
  avatar?: HydratedAvatar;
  expireTimer?: DurationInSeconds;
};

export type ModifiedContactDetails = MessageWithAvatar<Proto.ContactDetails>;

/* eslint-disable @typescript-eslint/brace-style -- Prettier conflicts with ESLint */
abstract class ParserBase<
  Message extends OptionalFields,
  Decoder extends DecoderBase<Message>,
  Result
> implements Iterable<Result>
{
  /* eslint-enable @typescript-eslint/brace-style */

  protected readonly reader: protobuf.Reader;

  constructor(bytes: Uint8Array, private readonly decoder: Decoder) {
    this.reader = new Reader(bytes);
  }

  protected decodeDelimited(): MessageWithAvatar<Message> | undefined {
    if (this.reader.pos === this.reader.len) {
      return undefined; // eof
    }

    try {
      const proto = this.decoder.decodeDelimited(this.reader);

      if (!proto) {
        return undefined;
      }

      let avatar: HydratedAvatar | undefined;
      if (proto.avatar) {
        const attachmentLen = proto.avatar.length ?? 0;
        const avatarData = this.reader.buf.slice(
          this.reader.pos,
          this.reader.pos + attachmentLen
        );
        this.reader.skip(attachmentLen);

        avatar = {
          ...proto.avatar,

          data: avatarData,
        };
      }

      let expireTimer: DurationInSeconds | undefined;

      if (proto.expireTimer != null) {
        expireTimer = DurationInSeconds.fromSeconds(proto.expireTimer);
      }

      return {
        ...proto,

        avatar,
        expireTimer,
      };
    } catch (error) {
      log.error('ProtoParser.next error:', Errors.toLogFormat(error));
      return undefined;
    }
  }

  public abstract next(): Result | undefined;

  *[Symbol.iterator](): Iterator<Result> {
    let result = this.next();
    while (result !== undefined) {
      yield result;
      result = this.next();
    }
  }
}

export class ContactBuffer extends ParserBase<
  Proto.ContactDetails,
  typeof Proto.ContactDetails,
  ModifiedContactDetails
> {
  constructor(arrayBuffer: Uint8Array) {
    super(arrayBuffer, Proto.ContactDetails);
  }

  public override next(): ModifiedContactDetails | undefined {
    const proto = this.decodeDelimited();
    if (!proto) {
      return undefined;
    }

    if (!proto.uuid) {
      return proto;
    }

    const { verified } = proto;

    return {
      ...proto,

      verified:
        verified && verified.destinationUuid
          ? {
              ...verified,

              destinationUuid: normalizeUuid(
                verified.destinationUuid,
                'ContactBuffer.verified.destinationUuid'
              ),
            }
          : verified,

      uuid: normalizeUuid(proto.uuid, 'ContactBuffer.uuid'),
    };
  }
}
