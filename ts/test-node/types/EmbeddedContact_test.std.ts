// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { createLogger } from '../../logging/log.std.ts';
import type { MessageAttributesType } from '../../model-types.std.ts';
import type {
  Avatar,
  Email,
  EmbeddedContactType,
  Phone,
} from '../../types/EmbeddedContact.std.ts';
import {
  _validate,
  ContactFormType,
  getContactInitials,
  getFullName,
  parseAndValidate,
  parsePhoneItem,
} from '../../types/EmbeddedContact.std.ts';

const logger = createLogger('EmbeddedContact_test');

const emptyContact = {
  aci: undefined,
  nickname: undefined,
  note: undefined,
} satisfies EmbeddedContactType;

describe('Contact', () => {
  const NUMBER = '+12025550099';

  const getDefaultMessageAttrs = (): Pick<
    MessageAttributesType,
    | 'id'
    | 'conversationId'
    | 'type'
    | 'sent_at'
    | 'received_at'
    | 'timestamp'
    | 'body'
  > => {
    return {
      id: 'id',
      conversationId: 'convo-id',
      type: 'incoming',
      sent_at: 1,
      received_at: 2,
      timestamp: 1,

      body: 'hey there',
    };
  };

  describe('parseAndValidate', () => {
    const defaultContext = {
      logger,
      getRegionCode: () => '1',
    };

    it('handles message with no avatar in contact', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            ...emptyContact,
            name: {
              nickname: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
          },
        ],
      } as const;
      const result = await parseAndValidate(
        message.contact[0],
        defaultContext,
        message
      );
      assert.deepEqual(result, message.contact[0]);
    });

    it('turns phone numbers to e164 format', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            ...emptyContact,
            name: {
              nickname: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: '(202) 555-0099',
              },
            ],
          },
        ],
      } as const;
      const expected = {
        ...emptyContact,
        name: {
          nickname: 'Someone Somewhere',
        },
        number: [
          {
            type: 1,
            value: '+12025550099',
          },
        ],
      };
      const result = await parseAndValidate(
        message.contact[0],
        {
          ...defaultContext,
          getRegionCode: () => 'US',
        },
        message
      );
      assert.deepEqual(result, expected);
    });

    it('removes contact avatar if it has no sub-avatar', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            ...emptyContact,
            name: {
              nickname: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
            avatar: {
              isProfile: true,
            } as unknown as Avatar,
          },
        ],
      } as const;
      const expected = {
        ...emptyContact,
        name: {
          nickname: 'Someone Somewhere',
        },
        number: [
          {
            type: 1,
            value: NUMBER,
          },
        ],
      };
      const result = await parseAndValidate(
        message.contact[0],
        defaultContext,
        message
      );
      assert.deepEqual(result, expected);
    });

    it('removes number element if it ends up with no value', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            ...emptyContact,
            name: {
              nickname: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
              } as unknown as Phone,
            ],
            email: [
              {
                type: 0,
                value: 'someone@somewhere.com',
              } as unknown as Email,
            ],
          },
        ],
      } as const;
      const expected = {
        ...emptyContact,
        name: {
          nickname: 'Someone Somewhere',
        },
        email: [
          {
            type: 1,
            value: 'someone@somewhere.com',
          },
        ],
      };
      const result = await parseAndValidate(
        message.contact[0],
        defaultContext,
        message
      );
      assert.deepEqual(result, expected);
    });

    it('drops address if it has no real values', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            ...emptyContact,
            name: {
              nickname: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
            address: [
              {
                type: 1,
              },
            ],
          },
        ],
      } as const;
      const expected = {
        ...emptyContact,
        name: {
          nickname: 'Someone Somewhere',
        },
        number: [
          {
            value: NUMBER,
            type: 1,
          },
        ],
      };
      const result = await parseAndValidate(
        message.contact[0],
        defaultContext,
        message
      );
      assert.deepEqual(result, expected);
    });

    it('removes invalid elements if no values remain in contact', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        source: NUMBER,
        sourceDevice: 1,
        sent_at: 1232132,
        contact: [
          {
            ...emptyContact,
            name: {
              nickname: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
              } as unknown as Phone,
            ],
            email: [
              {
                type: 1,
              } as unknown as Email,
            ],
          },
        ],
      } as const;
      const expected = {
        ...emptyContact,
        name: {
          nickname: 'Someone Somewhere',
        },
      };
      const result = await parseAndValidate(
        message.contact[0],
        defaultContext,
        message
      );
      assert.deepEqual(result, expected);
    });

    it('handles a contact with just organization', async () => {
      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            ...emptyContact,
            organization: 'Somewhere Consulting',
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
          },
        ],
      } as const;
      const result = await parseAndValidate(
        message.contact[0],
        defaultContext,
        message
      );
      assert.deepEqual(result, message.contact[0]);
    });
  });

  describe('parsePhoneItem', () => {
    it('adds default phone type', () => {
      const phone: Phone = {
        value: '+18005550000',
        // @ts-expect-error Forcing an invalid value here
        type: null,
      };
      const expected = {
        value: '+18005550000',
        type: ContactFormType.HOME,
      };
      const actual = parsePhoneItem(phone, { regionCode: '805' });
      assert.deepEqual(actual, expected);
    });

    it('passes invalid phone numbers through', () => {
      const phone: Phone = {
        value: '+1800555u000',
        type: ContactFormType.WORK,
      };
      const expected = {
        value: '+1800555u000',
        type: ContactFormType.WORK,
      };
      const actual = parsePhoneItem(phone, { regionCode: '805' });
      assert.deepEqual(actual, expected);
    });

    it('returns original data if regionCode not provided', () => {
      const phone: Phone = {
        value: '+18005550000',
        type: ContactFormType.MOBILE,
      };
      const expected = {
        value: '+18005550000',
        type: ContactFormType.MOBILE,
      };
      const actual = parsePhoneItem(phone, { regionCode: undefined });
      assert.deepEqual(actual, expected);
    });
  });

  describe('getFullName', () => {
    it('returns undefined with no name', () => {
      assert.isUndefined(getFullName({ name: undefined }));
      assert.isUndefined(getFullName({ name: {} }));
    });

    it('combines given and family names', () => {
      assert.strictEqual(
        getFullName({ name: { givenName: 'Jane', familyName: 'Doe' } }),
        'Jane Doe'
      );
    });

    it('keeps CJK ordering with only given and family names', () => {
      assert.strictEqual(
        getFullName({ name: { givenName: '振宁', familyName: '杨' } }),
        '杨振宁'
      );
    });

    it('includes prefix, middle name, and suffix', () => {
      assert.strictEqual(
        getFullName({
          name: {
            prefix: 'Dr.',
            givenName: 'Jane',
            middleName: 'Q.',
            familyName: 'Doe',
            suffix: 'Jr.',
          },
        }),
        'Dr. Jane Q. Doe Jr.'
      );
    });

    it('skips missing parts', () => {
      assert.strictEqual(
        getFullName({ name: { givenName: 'Jane', suffix: 'PhD' } }),
        'Jane PhD'
      );
      assert.strictEqual(
        getFullName({ name: { prefix: 'Dr.', familyName: 'Doe' } }),
        'Dr. Doe'
      );
      assert.strictEqual(
        getFullName({ name: { middleName: 'Quinn' } }),
        'Quinn'
      );
    });
  });

  describe('getContactInitials', () => {
    it('ignores prefix, middle name, and suffix', () => {
      assert.strictEqual(
        getContactInitials({
          name: {
            prefix: 'Dr.',
            givenName: 'Jane',
            middleName: 'Quinn',
            familyName: 'Doe',
            suffix: 'Jr.',
          },
        }),
        'JD'
      );
    });

    it('falls back to the display name', () => {
      assert.strictEqual(
        getContactInitials({ name: { middleName: 'Quinn' } }),
        'Q'
      );
      assert.strictEqual(
        getContactInitials({ name: null, organization: 'Signal' }),
        'S'
      );
    });

    it('returns undefined with no name or organization', () => {
      assert.isUndefined(getContactInitials({ name: null }));
    });
  });

  describe('_validate', () => {
    it('returns error if contact has no name.displayName or organization', () => {
      const messageId = 'the-message-id';
      const contact = {
        ...emptyContact,
        name: undefined,
        number: [
          {
            type: 1,
            value: NUMBER,
          },
        ],
      };
      const expected =
        "Message the-message-id: Contact had neither 'name' nor 'organization'";

      const result = _validate(contact, { messageId });
      assert.deepEqual(result?.message, expected);
    });
  });
});
