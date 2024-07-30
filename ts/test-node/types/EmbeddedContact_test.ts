// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import * as logger from '../../logging/log';
import { IMAGE_GIF, IMAGE_PNG } from '../../types/MIME';
import type { MessageAttributesType } from '../../model-types.d';
import type { Avatar, Email, Phone } from '../../types/EmbeddedContact';
import {
  _validate,
  embeddedContactSelector,
  getName,
  parseAndWriteAvatar,
} from '../../types/EmbeddedContact';
import { fakeAttachment } from '../../test-both/helpers/fakeAttachment';
import { generateAci } from '../../types/ServiceId';

describe('Contact', () => {
  const NUMBER = '+12025550099';

  const writeNewAttachmentData = sinon
    .stub()
    .throws(new Error("Shouldn't be called"));

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

  describe('embeddedContactSelector', () => {
    const regionCode = '1';
    const firstNumber = '+1202555000';
    const serviceId = undefined;

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
          avatar: fakeAttachment({
            error: true,
            contentType: IMAGE_GIF,
          }),
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
        serviceId,
        number: undefined,
      };
      const actual = embeddedContactSelector(contact, {
        regionCode,
        firstNumber,
        serviceId,
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
          avatar: fakeAttachment({
            pending: true,
            contentType: IMAGE_GIF,
            path: undefined,
          }),
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
          avatar: fakeAttachment({
            pending: true,
            path: undefined,
            contentType: IMAGE_GIF,
          }),
        },
        firstNumber,
        serviceId,
        number: undefined,
      };
      const actual = embeddedContactSelector(contact, {
        regionCode,
        firstNumber,
        serviceId,
      });
      assert.deepEqual(actual, expected);
    });

    it('calculates local url', () => {
      const fullAci = generateAci();

      const contact = {
        name: {
          displayName: 'displayName',
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
        name: {
          displayName: 'displayName',
          givenName: 'givenName',
          familyName: 'familyName',
        },
        organization: 'Somewhere, Inc.',
        avatar: {
          isProfile: true,
          avatar: fakeAttachment({
            path: 'attachment://v1/somewhere?size=10304&contentType=image%2Fgif',
            contentType: IMAGE_GIF,
          }),
        },
        firstNumber,
        serviceId: fullAci,
        number: undefined,
      };
      const actual = embeddedContactSelector(contact, {
        regionCode,
        firstNumber,
        serviceId: fullAci,
      });
      assert.deepEqual(actual, expected);
    });
  });

  describe('parseAndWriteAvatar', () => {
    it('handles message with no avatar in contact', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
          },
        ],
      };
      const result = await upgradeVersion(message.contact[0], {
        message,
        logger,
        getRegionCode: () => '1',
        writeNewAttachmentData,
      });
      assert.deepEqual(result, message.contact[0]);
    });

    it('turns phone numbers to e164 format', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: '(202) 555-0099',
              },
            ],
          },
        ],
      };
      const expected = {
        name: {
          displayName: 'Someone Somewhere',
        },
        number: [
          {
            type: 1,
            value: '+12025550099',
          },
        ],
      };
      const result = await upgradeVersion(message.contact[0], {
        message,
        getRegionCode: () => 'US',
        logger,
        writeNewAttachmentData,
      });
      assert.deepEqual(result, expected);
    });

    it('removes contact avatar if it has no sub-avatar', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
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
      };
      const expected = {
        name: {
          displayName: 'Someone Somewhere',
        },
        number: [
          {
            type: 1,
            value: NUMBER,
          },
        ],
      };
      const result = await upgradeVersion(message.contact[0], {
        getRegionCode: () => '1',
        writeNewAttachmentData,
        message,
        logger,
      });
      assert.deepEqual(result, expected);
    });

    it('writes avatar to disk', async () => {
      const upgradeAttachment = async () => {
        return fakeAttachment({
          path: 'abc/abcdefg',
          contentType: IMAGE_PNG,
        });
      };
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
            email: [
              {
                type: 2,
                value: 'someone@somewhere.com',
              },
            ],
            address: [
              {
                type: 1,
                street: '5 Somewhere Ave.',
              },
            ],
            avatar: {
              otherKey: 'otherValue',
              avatar: {
                contentType: 'image/png',
                data: Buffer.from('It’s easy if you try'),
              },
            } as unknown as Avatar,
          },
        ],
      };
      const expected = {
        name: {
          displayName: 'Someone Somewhere',
        },
        number: [
          {
            type: 1,
            value: NUMBER,
          },
        ],
        email: [
          {
            type: 2,
            value: 'someone@somewhere.com',
          },
        ],
        address: [
          {
            type: 1,
            street: '5 Somewhere Ave.',
          },
        ],
        avatar: {
          otherKey: 'otherValue',
          isProfile: false,
          avatar: fakeAttachment({
            contentType: IMAGE_PNG,
            path: 'abc/abcdefg',
          }),
        },
      };

      const result = await upgradeVersion(message.contact[0], {
        getRegionCode: () => '1',
        writeNewAttachmentData,
        message,
        logger,
      });
      assert.deepEqual(result, expected);
    });

    it('removes number element if it ends up with no value', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
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
              },
            ],
          },
        ],
      };
      const expected = {
        name: {
          displayName: 'Someone Somewhere',
        },
        email: [
          {
            type: 1,
            value: 'someone@somewhere.com',
          },
        ],
      };
      const result = await upgradeVersion(message.contact[0], {
        getRegionCode: () => '1',
        writeNewAttachmentData,
        message,
        logger,
      });
      assert.deepEqual(result, expected);
    });

    it('drops address if it has no real values', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
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
      };
      const expected = {
        name: {
          displayName: 'Someone Somewhere',
        },
        number: [
          {
            value: NUMBER,
            type: 1,
          },
        ],
      };
      const result = await upgradeVersion(message.contact[0], {
        getRegionCode: () => '1',
        writeNewAttachmentData,
        message,
        logger,
      });
      assert.deepEqual(result, expected);
    });

    it('removes invalid elements if no values remain in contact', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        source: NUMBER,
        sourceDevice: 1,
        sent_at: 1232132,
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
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
      };
      const expected = {
        name: {
          displayName: 'Someone Somewhere',
        },
      };
      const result = await upgradeVersion(message.contact[0], {
        getRegionCode: () => '1',
        writeNewAttachmentData,
        message,
        logger,
      });
      assert.deepEqual(result, expected);
    });

    it('handles a contact with just organization', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = parseAndWriteAvatar(upgradeAttachment);

      const message = {
        ...getDefaultMessageAttrs(),
        contact: [
          {
            organization: 'Somewhere Consulting',
            number: [
              {
                type: 1,
                value: NUMBER,
              },
            ],
          },
        ],
      };
      const result = await upgradeVersion(message.contact[0], {
        getRegionCode: () => '1',
        writeNewAttachmentData,
        message,
        logger,
      });
      assert.deepEqual(result, message.contact[0]);
    });
  });

  describe('_validate', () => {
    it('returns error if contact has no name.displayName or organization', () => {
      const messageId = 'the-message-id';
      const contact = {
        name: {
          givenName: 'Someone',
        },
        number: [
          {
            type: 1,
            value: NUMBER,
          },
        ],
      };
      const expected =
        "Message the-message-id: Contact had neither 'displayName' nor 'organization'";

      const result = _validate(contact, { messageId });
      assert.deepEqual(result?.message, expected);
    });

    it('logs if no values remain in contact', async () => {
      const messageId = 'the-message-id';
      const contact = {
        name: {
          displayName: 'Someone Somewhere',
        },
        number: [],
        email: [],
      };
      const expected =
        'Message the-message-id: Contact had no included numbers, email or addresses';

      const result = _validate(contact, { messageId });
      assert.deepEqual(result?.message, expected);
    });
  });
});
