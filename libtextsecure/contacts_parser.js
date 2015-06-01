/*
 * vim: ts=4:sw=4:expandtab
 */
function ContactBuffer(arrayBuffer) {
    this.buffer = new dCodeIO.ByteBuffer(arrayBuffer);
}
ContactBuffer.prototype = {
    constructor: ContactBuffer,
    readContact: function() {
        try {
            var len = this.buffer.readVarint32();
            this.buffer.skip(len);
            var contactInfo = textsecure.protobuf.ContactDetails.decode(
                this.buffer.slice(this.buffer.offset, len)
            );
            var attachmentLen = contactInfo.avatar.length;
            contactInfo.avatar.data = this.buffer.slice(this.buffer.offset, attachmentLen).toArrayBuffer(true /* copy? */);
            this.buffer.skip(attachmentLen);

            return contactInfo;
        } catch(e) {
            console.log(e);
        }
    }
};
