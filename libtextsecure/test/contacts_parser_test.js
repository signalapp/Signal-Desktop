describe('ContactBuffer', () => {
  function getTestBuffer() {
    const buffer = new dcodeIO.ByteBuffer();
    const avatarBuffer = new dcodeIO.ByteBuffer();
    const avatarLen = 255;
    for (let i = 0; i < avatarLen; i += 1) {
      avatarBuffer.writeUint8(i);
    }
    avatarBuffer.limit = avatarBuffer.offset;
    avatarBuffer.offset = 0;
    const contactInfo = new window.textsecure.protobuf.ContactDetails({
      name: 'Zero Cool',
      number: '+10000000000',
      uuid: '7198E1BD-1293-452A-A098-F982FF201902',
      avatar: { contentType: 'image/jpeg', length: avatarLen },
    });
    const contactInfoBuffer = contactInfo.encode().toArrayBuffer();

    for (let i = 0; i < 3; i += 1) {
      buffer.writeVarint32(contactInfoBuffer.byteLength);
      buffer.append(contactInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.limit = buffer.offset;
    buffer.offset = 0;
    return buffer.toArrayBuffer();
  }

  it('parses an array buffer of contacts', () => {
    const arrayBuffer = getTestBuffer();
    const contactBuffer = new window.textsecure.ContactBuffer(arrayBuffer);
    let contact = contactBuffer.next();
    let count = 0;
    while (contact !== undefined) {
      count += 1;
      assert.strictEqual(contact.name, 'Zero Cool');
      assert.strictEqual(contact.number, '+10000000000');
      assert.strictEqual(contact.uuid, '7198e1bd-1293-452a-a098-f982ff201902');
      assert.strictEqual(contact.avatar.contentType, 'image/jpeg');
      assert.strictEqual(contact.avatar.length, 255);
      assert.strictEqual(contact.avatar.data.byteLength, 255);
      const avatarBytes = new Uint8Array(contact.avatar.data);
      for (let j = 0; j < 255; j += 1) {
        assert.strictEqual(avatarBytes[j], j);
      }
      contact = contactBuffer.next();
    }
    assert.strictEqual(count, 3);
  });
});

describe('GroupBuffer', () => {
  function getTestBuffer() {
    const buffer = new dcodeIO.ByteBuffer();
    const avatarBuffer = new dcodeIO.ByteBuffer();
    const avatarLen = 255;
    for (let i = 0; i < avatarLen; i += 1) {
      avatarBuffer.writeUint8(i);
    }
    avatarBuffer.limit = avatarBuffer.offset;
    avatarBuffer.offset = 0;
    const groupInfo = new window.textsecure.protobuf.GroupDetails({
      id: new Uint8Array([1, 3, 3, 7]).buffer,
      name: 'Hackers',
      membersE164: ['cereal', 'burn', 'phreak', 'joey'],
      avatar: { contentType: 'image/jpeg', length: avatarLen },
    });
    const groupInfoBuffer = groupInfo.encode().toArrayBuffer();

    for (let i = 0; i < 3; i += 1) {
      buffer.writeVarint32(groupInfoBuffer.byteLength);
      buffer.append(groupInfoBuffer);
      buffer.append(avatarBuffer.clone());
    }

    buffer.limit = buffer.offset;
    buffer.offset = 0;
    return buffer.toArrayBuffer();
  }

  it('parses an array buffer of groups', () => {
    const arrayBuffer = getTestBuffer();
    const groupBuffer = new window.textsecure.GroupBuffer(arrayBuffer);
    let group = groupBuffer.next();
    let count = 0;
    while (group !== undefined) {
      count += 1;
      assert.strictEqual(group.name, 'Hackers');
      assertEqualArrayBuffers(
        group.id.toArrayBuffer(),
        new Uint8Array([1, 3, 3, 7]).buffer
      );
      assert.sameMembers(group.membersE164, [
        'cereal',
        'burn',
        'phreak',
        'joey',
      ]);
      assert.strictEqual(group.avatar.contentType, 'image/jpeg');
      assert.strictEqual(group.avatar.length, 255);
      assert.strictEqual(group.avatar.data.byteLength, 255);
      const avatarBytes = new Uint8Array(group.avatar.data);
      for (let j = 0; j < 255; j += 1) {
        assert.strictEqual(avatarBytes[j], j);
      }
      group = groupBuffer.next();
    }
    assert.strictEqual(count, 3);
  });
});
