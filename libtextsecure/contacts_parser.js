/*
 * vim: ts=4:sw=4:expandtab
 */

function ProtoParser(arrayBuffer, protobuf) {
    this.protobuf = protobuf;
    this.buffer = new dcodeIO.ByteBuffer();
    this.buffer.append(arrayBuffer);
    this.buffer.offset = 0;
    this.buffer.limit = arrayBuffer.byteLength;
}
ProtoParser.prototype = {
    constructor: ProtoParser,
    next: function() {
        try {
            if (this.buffer.limit === this.buffer.offset) {
                return undefined; // eof
            }
            var len = this.buffer.readVarint32();
            var nextBuffer = this.buffer.slice(
                this.buffer.offset, this.buffer.offset+len
            ).toArrayBuffer();
            // TODO: de-dupe ByteBuffer.js includes in libaxo/libts
            // then remove this toArrayBuffer call.

            var proto = this.protobuf.decode(nextBuffer);
            this.buffer.skip(len);

            if (proto.avatar) {
                var attachmentLen = proto.avatar.length;
                proto.avatar.data = this.buffer.slice(
                    this.buffer.offset, this.buffer.offset + attachmentLen
                ).toArrayBuffer();
                this.buffer.skip(attachmentLen);
            }

            if (proto.profileKey) {
                proto.profileKey = proto.profileKey.toArrayBuffer();
            }

            return proto;
        } catch(e) {
            console.log(e);
        }
    }
};
var GroupBuffer = function(arrayBuffer) {
    ProtoParser.call(this, arrayBuffer, textsecure.protobuf.GroupDetails);
};
GroupBuffer.prototype = Object.create(ProtoParser.prototype);
GroupBuffer.prototype.constructor = GroupBuffer;
var ContactBuffer = function(arrayBuffer) {
    ProtoParser.call(this, arrayBuffer, textsecure.protobuf.ContactDetails);
};
ContactBuffer.prototype = Object.create(ProtoParser.prototype);
ContactBuffer.prototype.constructor = ContactBuffer;
