/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

describe("ContactsBuffer", function() {
  function getTestBuffer() {
    var buffer = new dcodeIO.ByteBuffer();
    var avatarBuffer = new dcodeIO.ByteBuffer();
    var avatarLen = 255;
    for (var i=0; i < avatarLen; ++i) {
      avatarBuffer.writeUint8(i);
    }
    avatarBuffer.limit = avatarBuffer.offset;
    avatarBuffer.offset = 0;
    var contactInfo = new textsecure.protobuf.ContactDetails({
      name: "Zero Cool",
      number: "+10000000000",
      avatar: { contentType: "image/jpg", length: avatarLen }
    });
    var contactInfoBuffer = contactInfo.encode().toArrayBuffer();

    for (var i = 0; i < 3; ++i) {
      buffer.writeVarint32(contactInfoBuffer.byteLength);
      buffer.append(contactInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.offset = 0;
    buffer.limit = buffer.buffer.byteLength;
    return buffer.toArrayBuffer();
  }

  it("parses an array buffer of contacts", function() {
    var arrayBuffer = getTestBuffer();
    var contactBuffer = new ContactBuffer(arrayBuffer);
    for (var i=0; i < 3; ++i) {
      var contact = contactBuffer.readContact();
      assert.strictEqual(contact.name, "Zero Cool");
      assert.strictEqual(contact.number, "+10000000000");
      assert.strictEqual(contact.avatar.contentType, "image/jpg");
      var avatarBytes = new Uint8Array(contact.avatar.data);
      for (var j=0; j < 255; ++j) {
        assert.strictEqual(avatarBytes[j],j);
      }
    }
  });
});
