// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Bytes from '../../Bytes';
import {
  trimForDisplay,
  getRandomBytes,
  decryptProfileName,
  decryptProfile,
} from '../../Crypto';
import { UUID } from '../../types/UUID';
import { encryptProfileData } from '../../util/encryptProfileData';

describe('encryptProfileData', () => {
  it('encrypts and decrypts properly', async () => {
    const keyBuffer = getRandomBytes(32);
    const conversation = {
      aboutEmoji: '🐢',
      aboutText: 'I like turtles',
      familyName: 'Kid',
      firstName: 'Zombie',
      profileKey: Bytes.toBase64(keyBuffer),
      uuid: UUID.generate().toString(),

      // To satisfy TS
      acceptedMessageRequest: true,
      badges: [],
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
});
