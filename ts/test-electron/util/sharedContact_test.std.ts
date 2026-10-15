// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import {
  formatEmbeddedContactForUI,
  resolveSharedContact,
} from '../../util/sharedContact.std.ts';
import type { SharedContactRecipientType } from '../../util/sharedContact.std.ts';
import {
  ContactFormType,
  type EmbeddedContactType,
} from '../../types/EmbeddedContact.std.ts';
import { fakeAttachment } from '../../test-helpers/fakeAttachment.std.ts';
import { IMAGE_GIF } from '../../types/MIME.std.ts';

const emptyContact = {
  aci: undefined,
  nickname: undefined,
  note: undefined,
} satisfies EmbeddedContactType;

describe('sharedContact', () => {
  const noLookups = {
    getRecipientByServiceId: () => undefined,
    getRecipientByE164: () => undefined,
  };

  describe('formatEmbeddedContactForUI', () => {
    it('eliminates avatar if it has had an attachment download error', () => {
      const contact = {
        ...emptyContact,
        name: {
          nickname: 'nickname',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: fakeAttachment({
            error: true,
            contentType: IMAGE_GIF,
          }),
        },
      };
      const expected = {
        ...emptyContact,
        ...emptyContact,
        name: {
          nickname: 'nickname',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: undefined,
        resolution: { type: 'not-on-signal' },
      } as const;
      const actual = formatEmbeddedContactForUI(contact, {
        type: 'not-on-signal',
      });
      assert.deepEqual(actual, expected);
    });

    it('does not calculate absolute path if avatar is pending', () => {
      const contact = {
        ...emptyContact,
        name: {
          nickname: 'nickname',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: fakeAttachment({
            pending: true,
            contentType: IMAGE_GIF,
            path: undefined,
          }),
        },
      };
      const expected = {
        ...emptyContact,
        name: {
          nickname: 'nickname',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: fakeAttachment({
            pending: true,
            path: undefined,
            url: undefined,
            contentType: IMAGE_GIF,
          }),
        },
        resolution: { type: 'not-on-signal' },
      } as const;
      const actual = formatEmbeddedContactForUI(contact, {
        type: 'not-on-signal',
      });
      assert.deepEqual(actual, expected);
    });

    it('calculates local url', () => {
      const fullAci = generateAci();

      const contact = {
        ...emptyContact,
        aci: fullAci,
        name: {
          nickname: 'nickname',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: fakeAttachment({
            path: 'somewhere',
            contentType: IMAGE_GIF,
          }),
        },
      };
      const expected = {
        ...emptyContact,
        aci: fullAci,
        name: {
          nickname: 'nickname',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: fakeAttachment({
            path: 'somewhere',
            url: 'attachment://v1/somewhere?size=10304&contentType=image%2Fgif',
            contentType: IMAGE_GIF,
          }),
        },
        resolution: { type: 'aci', aci: fullAci },
      } as const;
      const actual = formatEmbeddedContactForUI(contact, {
        type: 'aci',
        aci: fullAci,
      });
      assert.deepEqual(actual, expected);
    });
  });

  describe('resolveSharedContact', () => {
    const e164 = '+18885550000';
    const otherE164 = '+18885550001';
    const number = [
      { type: ContactFormType.MOBILE, value: e164 },
      { type: ContactFormType.HOME, value: otherE164 },
    ];
    const shouldNotBeCalled = () => {
      throw new Error('should not be called');
    };

    function makeLookup(
      lookup: Record<string, SharedContactRecipientType>
    ): (id: string) => SharedContactRecipientType | undefined {
      return id => lookup[id];
    }

    describe('with shared ACI', () => {
      it('creates from the ACI with no existing recipient', () => {
        const aci = generateAci();
        const actual = resolveSharedContact(
          { ...emptyContact, aci, number },
          {
            getRecipientByServiceId: () => undefined,
            getRecipientByE164: shouldNotBeCalled,
          }
        );
        assert.deepEqual(actual, { type: 'aci', aci });
      });

      it('uses an existing registered recipient', () => {
        const aci = generateAci();
        const actual = resolveSharedContact(
          { ...emptyContact, aci, number },
          {
            getRecipientByServiceId: makeLookup({
              [aci]: { conversationId: 'convo', isUnregistered: false },
            }),
            getRecipientByE164: shouldNotBeCalled,
          }
        );
        assert.deepEqual(actual, { type: 'existing', conversationId: 'convo' });
      });

      it('treats an unregistered recipient as not on Signal', () => {
        const aci = generateAci();
        const actual = resolveSharedContact(
          { ...emptyContact, aci, number },
          {
            getRecipientByServiceId: makeLookup({
              [aci]: { conversationId: 'convo', isUnregistered: true },
            }),
            getRecipientByE164: shouldNotBeCalled,
          }
        );
        assert.deepEqual(actual, { type: 'not-on-signal' });
      });
    });

    describe('without shared ACI', () => {
      it('matches an existing recipient by any number', () => {
        const actual = resolveSharedContact(
          { ...emptyContact, number },
          {
            getRecipientByServiceId: shouldNotBeCalled,
            getRecipientByE164: makeLookup({
              [otherE164]: { conversationId: 'convo', isUnregistered: false },
            }),
          }
        );
        assert.deepEqual(actual, { type: 'existing', conversationId: 'convo' });
      });

      it('skips unregistered recipients', () => {
        const actual = resolveSharedContact(
          { ...emptyContact, number },
          {
            getRecipientByServiceId: shouldNotBeCalled,
            getRecipientByE164: makeLookup({
              [e164]: { conversationId: 'convo', isUnregistered: true },
            }),
          }
        );
        assert.deepEqual(actual, { type: 'not-on-signal' });
      });

      it('is not on Signal if no number is known', () => {
        const actual = resolveSharedContact(
          { ...emptyContact, number },
          noLookups
        );
        assert.deepEqual(actual, { type: 'not-on-signal' });
      });
    });
  });
});
