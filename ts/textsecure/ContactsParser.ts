/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */

import { ByteBufferClass } from '../window.d';
import { AttachmentType } from './SendMessage';

type ProtobufConstructorType = {
  decode: (data: ArrayBuffer) => ProtobufType;
};

type ProtobufType = {
  avatar?: PackedAttachmentType;
  profileKey?: any;
  uuid?: string;
  members: Array<string>;
};

export type PackedAttachmentType = AttachmentType & {
  length: number;
};

export class ProtoParser {
  buffer: ByteBufferClass;

  protobuf: ProtobufConstructorType;

  constructor(arrayBuffer: ArrayBuffer, protobuf: ProtobufConstructorType) {
    this.protobuf = protobuf;
    this.buffer = new window.dcodeIO.ByteBuffer();
    this.buffer.append(arrayBuffer);
    this.buffer.offset = 0;
    this.buffer.limit = arrayBuffer.byteLength;
  }

  next(): ProtobufType | undefined | null {
    try {
      if (this.buffer.limit === this.buffer.offset) {
        return undefined; // eof
      }
      const len = this.buffer.readVarint32();
      const nextBuffer = this.buffer
        .slice(this.buffer.offset, this.buffer.offset + len)
        .toArrayBuffer();

      const proto = this.protobuf.decode(nextBuffer);
      this.buffer.skip(len);

      if (proto.avatar) {
        const attachmentLen = proto.avatar.length;
        proto.avatar.data = this.buffer
          .slice(this.buffer.offset, this.buffer.offset + attachmentLen)
          .toArrayBuffer();
        this.buffer.skip(attachmentLen);
      }

      if (proto.profileKey) {
        proto.profileKey = proto.profileKey.toArrayBuffer();
      }

      if (proto.uuid) {
        window.normalizeUuids(
          proto,
          ['uuid'],
          'ProtoParser::next (proto.uuid)'
        );
      }

      if (proto.members) {
        window.normalizeUuids(
          proto,
          proto.members.map((_member, i) => `members.${i}.uuid`),
          'ProtoParser::next (proto.members)'
        );
      }

      return proto;
    } catch (error) {
      window.log.error(
        'ProtoParser.next error:',
        error && error.stack ? error.stack : error
      );
    }

    return null;
  }
}

export class GroupBuffer extends ProtoParser {
  constructor(arrayBuffer: ArrayBuffer) {
    super(arrayBuffer, window.textsecure.protobuf.GroupDetails as any);
  }
}

export class ContactBuffer extends ProtoParser {
  constructor(arrayBuffer: ArrayBuffer) {
    super(arrayBuffer, window.textsecure.protobuf.ContactDetails as any);
  }
}
