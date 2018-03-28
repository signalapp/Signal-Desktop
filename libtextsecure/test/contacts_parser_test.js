/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

describe("ContactBuffer", function() {
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
      avatar: { contentType: "image/jpeg", length: avatarLen }
    });
    var contactInfoBuffer = contactInfo.encode().toArrayBuffer();

    for (var i = 0; i < 3; ++i) {
      buffer.writeVarint32(contactInfoBuffer.byteLength);
      buffer.append(contactInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.limit = buffer.offset;
    buffer.offset = 0;
    return buffer.toArrayBuffer();
  }

  it("parses an array buffer of contacts", function() {
    var arrayBuffer = getTestBuffer();
    var contactBuffer = new ContactBuffer(arrayBuffer);
    var contact = contactBuffer.next();
    var count = 0;
    while (contact !== undefined) {
      count++;
      assert.strictEqual(contact.name, "Zero Cool");
      assert.strictEqual(contact.number, "+10000000000");
      assert.strictEqual(contact.avatar.contentType, "image/jpeg");
      assert.strictEqual(contact.avatar.length, 255);
      assert.strictEqual(contact.avatar.data.byteLength, 255);
      var avatarBytes = new Uint8Array(contact.avatar.data);
      for (var j=0; j < 255; ++j) {
        assert.strictEqual(avatarBytes[j],j);
      }
      contact = contactBuffer.next();
    }
    assert.strictEqual(count, 3);
  });
});

describe("GroupBuffer", function() {
  function getTestBuffer() {
    var buffer = new dcodeIO.ByteBuffer();
    var avatarBuffer = new dcodeIO.ByteBuffer();
    var avatarLen = 255;
    for (var i=0; i < avatarLen; ++i) {
      avatarBuffer.writeUint8(i);
    }
    avatarBuffer.limit = avatarBuffer.offset;
    avatarBuffer.offset = 0;
    var groupInfo = new textsecure.protobuf.GroupDetails({
      id: new Uint8Array([1, 3, 3, 7]).buffer,
      name: "Hackers",
      members: ['cereal', 'burn', 'phreak', 'joey'],
      avatar: { contentType: "image/jpeg", length: avatarLen }
    });
    var groupInfoBuffer = groupInfo.encode().toArrayBuffer();

    for (var i = 0; i < 3; ++i) {
      buffer.writeVarint32(groupInfoBuffer.byteLength);
      buffer.append(groupInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.limit = buffer.offset;
    buffer.offset = 0;
    return buffer.toArrayBuffer();
  }

  it("parses an array buffer of groups", function() {
    var arrayBuffer = getTestBuffer();
    var groupBuffer = new GroupBuffer(arrayBuffer);
    var group = groupBuffer.next();
    var count = 0;
    while (group !== undefined) {
      count++;
      assert.strictEqual(group.name, "Hackers");
      assertEqualArrayBuffers(group.id.toArrayBuffer(), new Uint8Array([1,3,3,7]).buffer);
      assert.sameMembers(group.members, ['cereal', 'burn', 'phreak', 'joey']);
      assert.strictEqual(group.avatar.contentType, "image/jpeg");
      assert.strictEqual(group.avatar.length, 255);
      assert.strictEqual(group.avatar.data.byteLength, 255);
      var avatarBytes = new Uint8Array(group.avatar.data);
      for (var j=0; j < 255; ++j) {
        assert.strictEqual(avatarBytes[j],j);
      }
      group = groupBuffer.next();
    }
    assert.strictEqual(count, 3);
  });
});
