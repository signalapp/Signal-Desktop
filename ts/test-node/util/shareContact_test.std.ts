// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { ConversationAttributesType } from '../../model-types.std.ts';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import { format as formatPhoneNumber } from '../../types/PhoneNumber.std.ts';
import type {
  ShareContactAvatarType,
  ShareContactDraftType,
  ShareContactType,
} from '../../util/shareContact.std.ts';
import {
  applyShareContactSelection,
  canShareContact,
  canShareContactFromConversation,
  getShareContactDraft,
  withE164AsMissingName,
} from '../../util/shareContact.std.ts';

describe('shareContact', () => {
  const aci = generateAci();

  const avatar: ShareContactAvatarType = {
    url: 'attachment://avatar.jpg',
    isProfile: false,
    attachment: { path: 'avatar.jpg' },
  };

  const draft: ShareContactDraftType = {
    aci,
    avatar,
    avatarOptions: [avatar],
    name: { givenName: 'Paige', familyName: 'Hall' },
    organization: 'Signal',
    e164: '+15101234567',
    nickname: { givenName: 'P', familyName: undefined },
    note: 'Met in 2017',
  };

  const empty: ShareContactType = {
    aci,
    avatar: null,
    name: null,
    organization: null,
    e164: null,
    nickname: null,
    note: null,
  };

  describe('applyShareContactSelection', () => {
    it('only includes selected fields', () => {
      assert.deepEqual(
        applyShareContactSelection(draft, {
          e164: false,
          nickname: false,
          note: true,
        }),
        {
          ...empty,
          avatar,
          name: { givenName: 'Paige', familyName: 'Hall' },
          organization: 'Signal',
          note: 'Met in 2017',
        }
      );
    });

    it('always includes the avatar and name', () => {
      const contact = applyShareContactSelection(draft, {
        e164: false,
        nickname: false,
        note: false,
      });
      assert.strictEqual(contact.avatar, avatar);
      assert.deepEqual(contact.name, {
        givenName: 'Paige',
        familyName: 'Hall',
      });
      assert.strictEqual(contact.organization, 'Signal');
    });
  });

  describe('withE164AsMissingName', () => {
    it('uses the formatted e164 as the given name', () => {
      const formatted = formatPhoneNumber('+15101234567', {
        ourRegionCode: 'US',
      });
      assert.deepEqual(
        withE164AsMissingName({ ...draft, name: null }, 'US').name,
        { givenName: formatted }
      );
    });

    it('keeps an existing name', () => {
      assert.strictEqual(withE164AsMissingName(draft, 'US'), draft);
    });
  });

  describe('canShareContact', () => {
    it('allows a name with an ACI', () => {
      assert.isTrue(
        canShareContact({ ...empty, name: { givenName: 'Paige' } })
      );
    });

    it('allows an e164 without an ACI', () => {
      assert.isTrue(
        canShareContact({
          ...empty,
          aci: null,
          name: { givenName: '+15101234567' },
          e164: '+15101234567',
        })
      );
    });

    it('rejects a name without an ACI or e164', () => {
      assert.isFalse(
        canShareContact({
          ...empty,
          aci: null,
          name: { givenName: 'Paige' },
        })
      );
    });
  });

  describe('getShareContactDraft', () => {
    function getAttributes(
      overrides: Partial<ConversationAttributesType> = {}
    ): ConversationAttributesType {
      return {
        id: 'id',
        type: 'private',
        version: 0,
        expireTimerVersion: 1,
        ...overrides,
      };
    }

    it('prefers the system name over the profile name', () => {
      const result = getShareContactDraft(
        getAttributes({
          systemGivenName: 'System',
          systemFamilyName: 'Name',
          systemNickname: 'Nick',
          profileName: 'Profile',
          profileFamilyName: 'Name',
        })
      );
      assert.deepEqual(result.name, {
        givenName: 'System',
        familyName: 'Name',
      });
    });

    it('falls back to the system nickname, then the profile name', () => {
      assert.deepEqual(
        getShareContactDraft(
          getAttributes({ systemNickname: 'Nick', profileName: 'Profile' })
        ).name,
        { givenName: 'Nick' }
      );
      assert.deepEqual(
        getShareContactDraft(
          getAttributes({ profileName: 'Profile', profileFamilyName: 'Name' })
        ).name,
        { givenName: 'Profile', familyName: 'Name' }
      );
      assert.isNull(getShareContactDraft(getAttributes()).name);
    });

    it('offers the system avatar before the profile avatar', () => {
      const systemAvatar = { path: 'system.jpg' };
      const profileAvatar = { path: 'profile.jpg' };
      const result = getShareContactDraft(
        getAttributes({ avatar: systemAvatar, profileAvatar })
      );

      assert.deepEqual(
        result.avatarOptions.map(option => [
          option.attachment,
          option.isProfile,
        ]),
        [
          [systemAvatar, false],
          [profileAvatar, true],
        ]
      );
      assert.strictEqual(result.avatar, result.avatarOptions[0]);
    });

    it('skips avatars that have not been downloaded', () => {
      const result = getShareContactDraft(
        getAttributes({
          avatar: { url: 'https://example.com/avatar' },
          profileAvatar: { path: 'profile.jpg' },
        })
      );
      assert.lengthOf(result.avatarOptions, 1);
      assert.isTrue(result.avatar?.isProfile);
    });

    it('only includes the ACI for registered contacts', () => {
      const serviceId = generateAci();
      assert.strictEqual(
        getShareContactDraft(getAttributes({ serviceId })).aci,
        serviceId
      );
      assert.isNull(
        getShareContactDraft(
          getAttributes({ serviceId, discoveredUnregisteredAt: Date.now() })
        ).aci
      );
    });

    it('copies the e164, nickname, and note', () => {
      const result = getShareContactDraft(
        getAttributes({
          e164: '+15101234567',
          nicknameGivenName: 'P',
          note: 'Met in 2017',
        })
      );
      assert.strictEqual(result.e164, '+15101234567');
      assert.deepEqual(result.nickname, {
        givenName: 'P',
        familyName: undefined,
      });
      assert.strictEqual(result.note, 'Met in 2017');
    });
  });

  describe('canShareContactFromConversation', () => {
    it('allows any contact with an e164', () => {
      assert.isTrue(
        canShareContactFromConversation(
          getDefaultConversation({
            e164: '+15101234567',
            serviceId: undefined,
            profileName: undefined,
          })
        )
      );
    });

    it('allows a named, registered contact without an e164', () => {
      assert.isTrue(
        canShareContactFromConversation(
          getDefaultConversation({
            e164: undefined,
            serviceId: generateAci(),
            profileName: 'Paige',
          })
        )
      );
    });

    it('rejects an unregistered contact without an e164', () => {
      assert.isFalse(
        canShareContactFromConversation(
          getDefaultConversation({
            e164: undefined,
            serviceId: generateAci(),
            profileName: 'Paige',
            discoveredUnregisteredAt: Date.now(),
          })
        )
      );
    });
  });
});
