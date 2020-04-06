/* global ContactBuffer, GroupBuffer, textsecure */

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
    const contactInfo = new textsecure.protobuf.ContactDetails({
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
    const contactBuffer = new ContactBuffer(arrayBuffer);
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
    const groupInfo = new textsecure.protobuf.GroupDetails({
      id: new Uint8Array([1, 3, 3, 7]).buffer,
      name: 'Hackers',
      membersE164: ['cereal', 'burn', 'phreak', 'joey'],
      members: [
        { uuid: '3EA23646-92E8-4604-8833-6388861971C1', e164: 'cereal' },
        { uuid: 'B8414169-7149-4736-8E3B-477191931301', e164: 'burn' },
        { uuid: '64C97B95-A782-4E1E-BBCC-5A4ACE8d71f6', e164: 'phreak' },
        { uuid: 'CA334652-C35B-4FDC-9CC7-5F2060C771EE', e164: 'joey' },
      ],
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
    const groupBuffer = new GroupBuffer(arrayBuffer);
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
      assert.sameDeepMembers(
        group.members.map(({ uuid, e164 }) => ({ uuid, e164 })),
        [
          { uuid: '3ea23646-92e8-4604-8833-6388861971c1', e164: 'cereal' },
          { uuid: 'b8414169-7149-4736-8e3b-477191931301', e164: 'burn' },
          { uuid: '64c97b95-a782-4e1e-bbcc-5a4ace8d71f6', e164: 'phreak' },
          { uuid: 'ca334652-c35b-4fdc-9cc7-5f2060c771ee', e164: 'joey' },
        ]
      );
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
