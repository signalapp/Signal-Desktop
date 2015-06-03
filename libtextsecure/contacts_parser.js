/*
 * vim: ts=4:sw=4:expandtab
 */
function ContactBuffer(arrayBuffer) {
    this.buffer = new dcodeIO.ByteBuffer();
    this.buffer.append(arrayBuffer);
    this.buffer.offset = 0;
    this.buffer.limit = arrayBuffer.byteLength;
}
ContactBuffer.prototype = {
    constructor: ContactBuffer,
    readContact: function() {
        try {
            var len = this.buffer.readVarint32();
            var contactInfoBuffer = this.buffer.slice(this.buffer.offset, this.buffer.offset+len);
            var contactInfo = textsecure.protobuf.ContactDetails.decode(contactInfoBuffer);
            this.buffer.skip(len);
            var attachmentLen = contactInfo.avatar.length.toNumber();
            contactInfo.avatar.data = this.buffer.slice(this.buffer.offset, this.buffer.offset + attachmentLen).toArrayBuffer(true);
            this.buffer.skip(attachmentLen);

            return contactInfo;
        } catch(e) {
            console.log(e);
        }
    }
};
