/* global dcodeIO, window, textsecure */

function ProtoParser(arrayBuffer, protobuf) {
  this.protobuf = protobuf;
  this.buffer = new dcodeIO.ByteBuffer();
  this.buffer.append(arrayBuffer);
  this.buffer.offset = 0;
  this.buffer.limit = arrayBuffer.byteLength;
}
ProtoParser.prototype = {
  constructor: ProtoParser,
  next() {
    try {
      if (this.buffer.limit === this.buffer.offset) {
        return undefined; // eof
      }
      const len = this.buffer.readInt32();
      const nextBuffer = this.buffer
        .slice(this.buffer.offset, this.buffer.offset + len)
        .toArrayBuffer();
      // TODO: de-dupe ByteBuffer.js includes in libaxo/libts
      // then remove this toArrayBuffer call.

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

      return proto;
    } catch (error) {
      window.log.error(
        'ProtoParser.next error:',
        error && error.stack ? error.stack : error
      );
    }

    return null;
  },
};
const GroupBuffer = function Constructor(arrayBuffer) {
  ProtoParser.call(this, arrayBuffer, textsecure.protobuf.GroupDetails);
};
GroupBuffer.prototype = Object.create(ProtoParser.prototype);
GroupBuffer.prototype.constructor = GroupBuffer;
const ContactBuffer = function Constructor(arrayBuffer) {
  ProtoParser.call(this, arrayBuffer, textsecure.protobuf.ContactDetails);
};
ContactBuffer.prototype = Object.create(ProtoParser.prototype);
ContactBuffer.prototype.constructor = ContactBuffer;
