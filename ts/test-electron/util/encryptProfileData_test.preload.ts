// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Bytes from '../../Bytes.std.ts';
import {
  trimForDisplay,
  getRandomBytes,
  decryptProfileName,
  decryptProfile,
} from '../../Crypto.node.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import { encryptProfileData } from '../../util/encryptProfileData.preload.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

describe('encryptProfileData', () => {
  let keyBuffer: Uint8Array<ArrayBuffer>;
  let conversation: ConversationType;

  beforeEach(() => {
    keyBuffer = getRandomBytes(32);
    conversation = {
      aboutEmoji: Emoji.TURTLE,
      aboutText: 'I like turtles',
      familyName: 'Kid',
      firstName: 'Zombie',
      profileKey: Bytes.toBase64(keyBuffer),
      serviceId: generateAci(),

      // To satisfy TS
      acceptedMessageRequest: true,
      badges: [],
      id: '',
      isMe: true,
      title: '',
      type: 'direct' as const,
    };
  });

  it('encrypts and decrypts properly', async () => {
    const [encrypted] = await encryptProfileData(conversation, {
      type: 'clear',
    });

    assert.isDefined(encrypted.version);
    assert.isDefined(encrypted.name);
    assert.isDefined(encrypted.commitment);

    const decryptedProfileNameBytes = decryptProfileName(
      encrypted.name,
      keyBuffer
    );
    assert.equal(
      Bytes.toString(decryptedProfileNameBytes.given),
      conversation.firstName
    );
    if (decryptedProfileNameBytes.family) {
      assert.equal(
        Bytes.toString(decryptedProfileNameBytes.family),
        conversation.familyName
      );
    } else {
      assert.isDefined(decryptedProfileNameBytes.family);
    }

    if (encrypted.about) {
      const decryptedAboutBytes = decryptProfile(
        Bytes.fromBase64(encrypted.about),
        keyBuffer
      );
      assert.equal(
        Bytes.toString(trimForDisplay(decryptedAboutBytes)),
        conversation.aboutText
      );
    } else {
      assert.isDefined(encrypted.about);
    }

    if (encrypted.aboutEmoji) {
      const decryptedAboutEmojiBytes = decryptProfile(
        Bytes.fromBase64(encrypted.aboutEmoji),
        keyBuffer
      );
      assert.equal(
        Bytes.toString(trimForDisplay(decryptedAboutEmojiBytes)),
        conversation.aboutEmoji
      );
    } else {
      assert.isDefined(encrypted.aboutEmoji);
    }
  });

  it('keeps the server avatar when unchanged', async () => {
    const [encrypted, encryptedAvatar] = await encryptProfileData(
      conversation,
      { type: 'unchanged' }
    );

    assert.isTrue(encrypted.avatar);
    assert.isTrue(encrypted.sameAvatar);
    assert.isUndefined(encryptedAvatar);
  });

  it('clears the server avatar when cleared', async () => {
    const [encrypted, encryptedAvatar] = await encryptProfileData(
      conversation,
      { type: 'clear' }
    );

    assert.isFalse(encrypted.avatar);
    assert.isUndefined(encryptedAvatar);
  });

  it('encrypts the avatar when updated', async () => {
    const avatar = new Uint8Array([1, 2, 3]);
    const [encrypted, encryptedAvatar] = await encryptProfileData(
      conversation,
      { type: 'update', avatar }
    );

    assert.isTrue(encrypted.avatar);
    assert.isFalse(encrypted.sameAvatar);
    assert.isDefined(encryptedAvatar);
    assert.deepEqual(decryptProfile(encryptedAvatar, keyBuffer), avatar);
  });
});
