// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Bytes from '../../Bytes.std.js';
import {
  trimForDisplay,
  getRandomBytes,
  decryptProfileName,
  decryptProfile,
} from '../../Crypto.node.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { encryptProfileData } from '../../util/encryptProfileData.preload.js';

describe('encryptProfileData', () => {
  let keyBuffer: Uint8Array;
  let conversation: ConversationType;

  beforeEach(() => {
    keyBuffer = getRandomBytes(32);
    conversation = {
      aboutEmoji: '🐢',
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
      sharedGroupNames: [],
      title: '',
      type: 'direct' as const,
    };
  });

  it('encrypts and decrypts properly', async () => {
    const [encrypted] = await encryptProfileData(conversation, {
      oldAvatar: undefined,
      newAvatar: undefined,
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
      const decryptedAboutEmojiBytes = await decryptProfile(
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

  it('sets sameAvatar to true when avatars are the same', async () => {
    const [encrypted] = await encryptProfileData(conversation, {
      oldAvatar: new Uint8Array([1, 2, 3]),
      newAvatar: new Uint8Array([1, 2, 3]),
    });

    assert.isTrue(encrypted.sameAvatar);
  });

  it('sets sameAvatar to false when avatars are different', async () => {
    const [encrypted] = await encryptProfileData(conversation, {
      oldAvatar: new Uint8Array([1, 2, 3]),
      newAvatar: new Uint8Array([4, 5, 6, 7]),
    });

    assert.isFalse(encrypted.sameAvatar);
  });
});
