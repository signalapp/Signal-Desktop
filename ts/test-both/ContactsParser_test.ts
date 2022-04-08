// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import protobuf from '../protobuf/wrap';

import * as Bytes from '../Bytes';
import { SignalService as Proto } from '../protobuf';
import { ContactBuffer, GroupBuffer } from '../textsecure/ContactsParser';

const { Writer } = protobuf;

describe('ContactsParser', () => {
  function generateAvatar(): Uint8Array {
    const result = new Uint8Array(255);
    for (let i = 0; i < result.length; i += 1) {
      result[i] = i;
    }
    return result;
  }

  describe('ContactBuffer', () => {
    function getTestBuffer(): Uint8Array {
      const avatarBuffer = generateAvatar();

      const contactInfoBuffer = Proto.ContactDetails.encode({
        name: 'Zero Cool',
        number: '+10000000000',
        uuid: '7198E1BD-1293-452A-A098-F982FF201902',
        avatar: { contentType: 'image/jpeg', length: avatarBuffer.length },
      }).finish();

      const writer = new Writer();
      writer.bytes(contactInfoBuffer);
      const prefixedContact = writer.finish();

      const chunks: Array<Uint8Array> = [];
      for (let i = 0; i < 3; i += 1) {
        chunks.push(prefixedContact);
        chunks.push(avatarBuffer);
      }

      return Bytes.concatenate(chunks);
    }

    it('parses an array buffer of contacts', () => {
      const bytes = getTestBuffer();
      const contactBuffer = new ContactBuffer(bytes);
      let contact = contactBuffer.next();
      let count = 0;
      while (contact !== undefined) {
        count += 1;
        assert.strictEqual(contact.name, 'Zero Cool');
        assert.strictEqual(contact.number, '+10000000000');
        assert.strictEqual(
          contact.uuid,
          '7198e1bd-1293-452a-a098-f982ff201902'
        );
        assert.strictEqual(contact.avatar?.contentType, 'image/jpeg');
        assert.strictEqual(contact.avatar?.length, 255);
        assert.strictEqual(contact.avatar?.data.byteLength, 255);
        const avatarBytes = new Uint8Array(
          contact.avatar?.data || new Uint8Array(0)
        );
        for (let j = 0; j < 255; j += 1) {
          assert.strictEqual(avatarBytes[j], j);
        }
        contact = contactBuffer.next();
      }
      assert.strictEqual(count, 3);
    });
  });

  describe('GroupBuffer', () => {
    function getTestBuffer(): Uint8Array {
      const avatarBuffer = generateAvatar();

      const groupInfoBuffer = Proto.GroupDetails.encode({
        id: new Uint8Array([1, 3, 3, 7]),
        name: 'Hackers',
        membersE164: ['cereal', 'burn', 'phreak', 'joey'],
        avatar: { contentType: 'image/jpeg', length: avatarBuffer.length },
      }).finish();

      const writer = new Writer();
      writer.bytes(groupInfoBuffer);
      const prefixedGroup = writer.finish();

      const chunks: Array<Uint8Array> = [];
      for (let i = 0; i < 3; i += 1) {
        chunks.push(prefixedGroup);
        chunks.push(avatarBuffer);
      }

      return Bytes.concatenate(chunks);
    }

    it('parses an array buffer of groups', () => {
      const bytes = getTestBuffer();
      const groupBuffer = new GroupBuffer(bytes);
      let group = groupBuffer.next();
      let count = 0;
      while (group !== undefined) {
        count += 1;
        assert.strictEqual(group.name, 'Hackers');
        assert.deepEqual(group.id, new Uint8Array([1, 3, 3, 7]));
        assert.sameMembers(group.membersE164, [
          'cereal',
          'burn',
          'phreak',
          'joey',
        ]);
        assert.strictEqual(group.avatar?.contentType, 'image/jpeg');
        assert.strictEqual(group.avatar?.length, 255);
        assert.strictEqual(group.avatar?.data.byteLength, 255);
        const avatarBytes = new Uint8Array(
          group.avatar?.data || new Uint8Array(0)
        );
        for (let j = 0; j < 255; j += 1) {
          assert.strictEqual(avatarBytes[j], j);
        }
        group = groupBuffer.next();
      }
      assert.strictEqual(count, 3);
    });
  });
});
