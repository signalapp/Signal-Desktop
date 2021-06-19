// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { IMAGE_GIF } from '../../types/MIME';
import { contactSelector, getName } from '../../types/Contact';

describe('Contact', () => {
  describe('getName', () => {
    it('returns displayName if provided', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
      };
      const expected = 'displayName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns organization if no displayName', () => {
      const contact = {
        name: {
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
      };
      const expected = 'Somewhere, Inc.';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns givenName + familyName if no displayName or organization', () => {
      const contact = {
        name: {
          givenName: 'givenName',
          familyName: 'familyName',
        },
      };
      const expected = 'givenName familyName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns just givenName', () => {
      const contact = {
        name: {
          givenName: 'givenName',
        },
      };
      const expected = 'givenName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
    it('returns just familyName', () => {
      const contact = {
        name: {
          familyName: 'familyName',
        },
      };
      const expected = 'familyName';
      const actual = getName(contact);
      assert.strictEqual(actual, expected);
    });
  });
  describe('contactSelector', () => {
    const regionCode = '1';
    const firstNumber = '+1202555000';
    const isNumberOnSignal = false;
    const getAbsoluteAttachmentPath = (path: string) => `absolute:${path}`;

    it('eliminates avatar if it has had an attachment download error', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            error: true,
            contentType: IMAGE_GIF,
          },
        },
      };
      const expected = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: undefined,
        firstNumber,
        isNumberOnSignal,
        number: undefined,
      };
      const actual = contactSelector(contact, {
        regionCode,
        firstNumber,
        isNumberOnSignal,
        getAbsoluteAttachmentPath,
      });
      assert.deepEqual(actual, expected);
    });

    it('does not calculate absolute path if avatar is pending', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            pending: true,
            contentType: IMAGE_GIF,
          },
        },
      };
      const expected = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            pending: true,
            path: undefined,
            contentType: IMAGE_GIF,
          },
        },
        firstNumber,
        isNumberOnSignal,
        number: undefined,
      };
      const actual = contactSelector(contact, {
        regionCode,
        firstNumber,
        isNumberOnSignal,
        getAbsoluteAttachmentPath,
      });
      assert.deepEqual(actual, expected);
    });

    it('calculates absolute path', () => {
      const contact = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            path: 'somewhere',
            contentType: IMAGE_GIF,
          },
        },
      };
      const expected = {
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: {
            path: 'absolute:somewhere',
            contentType: IMAGE_GIF,
          },
        },
        firstNumber,
        isNumberOnSignal: true,
        number: undefined,
      };
      const actual = contactSelector(contact, {
        regionCode,
        firstNumber,
        isNumberOnSignal: true,
        getAbsoluteAttachmentPath,
      });
      assert.deepEqual(actual, expected);
    });
  });
});
