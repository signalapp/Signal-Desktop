// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';

import Crypto from '../../textsecure/Crypto';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringFromBytes,
  trimForDisplay,
} from '../../Crypto';
import { encryptProfileData } from '../../util/encryptProfileData';

describe('encryptProfileData', () => {
  it('encrypts and decrypts properly', async () => {
    const keyBuffer = Crypto.getRandomBytes(32);
    const conversation = {
      aboutEmoji: '🐢',
      aboutText: 'I like turtles',
      familyName: 'Kid',
      firstName: 'Zombie',
      profileKey: arrayBufferToBase64(keyBuffer),
      uuid: uuid(),

      // To satisfy TS
      acceptedMessageRequest: true,
      id: '',
      isMe: true,
      sharedGroupNames: [],
      title: '',
      type: 'direct' as const,
    };

    const [encrypted] = await encryptProfileData(conversation);

    assert.isDefined(encrypted.version);
    assert.isDefined(encrypted.name);
    assert.isDefined(encrypted.commitment);

    const decryptedProfileNameBytes = await Crypto.decryptProfileName(
      encrypted.name,
      keyBuffer
    );
    assert.equal(
      stringFromBytes(decryptedProfileNameBytes.given),
      conversation.firstName
    );
    if (decryptedProfileNameBytes.family) {
      assert.equal(
        stringFromBytes(decryptedProfileNameBytes.family),
        conversation.familyName
      );
    } else {
      assert.isDefined(decryptedProfileNameBytes.family);
    }

    if (encrypted.about) {
      const decryptedAboutBytes = await Crypto.decryptProfile(
        base64ToArrayBuffer(encrypted.about),
        keyBuffer
      );
      assert.equal(
        stringFromBytes(trimForDisplay(decryptedAboutBytes)),
        conversation.aboutText
      );
    } else {
      assert.isDefined(encrypted.about);
    }

    if (encrypted.aboutEmoji) {
      const decryptedAboutEmojiBytes = await Crypto.decryptProfile(
        base64ToArrayBuffer(encrypted.aboutEmoji),
        keyBuffer
      );
      assert.equal(
        stringFromBytes(trimForDisplay(decryptedAboutEmojiBytes)),
        conversation.aboutEmoji
      );
    } else {
      assert.isDefined(encrypted.aboutEmoji);
    }
  });
});
