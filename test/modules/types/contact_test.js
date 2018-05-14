const { assert } = require('chai');
const sinon = require('sinon');

const Contact = require('../../../js/modules/types/contact');
const {
  stringToArrayBuffer,
} = require('../../../js/modules/string_to_array_buffer');

describe('Contact', () => {
  const NUMBER = '+12025550099';

  describe('parseAndWriteAvatar', () => {
    it('handles message with no avatar in contact', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
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
      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, message.contact[0]);
    });

    it('turns phone numbers to e164 format', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
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
        regionCode: 'US',
      });
      assert.deepEqual(result, expected);
    });

    it('removes contact avatar if it has no sub-avatar', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
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
            },
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
      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, expected);
    });

    it('writes avatar to disk', async () => {
      const upgradeAttachment = async () => {
        return {
          path: 'abc/abcdefg',
        };
      };
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
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
                data: stringToArrayBuffer('It’s easy if you try'),
              },
            },
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
          avatar: {
            path: 'abc/abcdefg',
          },
        },
      };

      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, expected);
    });

    it('removes number element if it ends up with no value', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
              },
            ],
            email: [
              {
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
      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, expected);
    });

    it('drops address if it has no real values', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
            },
            number: [
              {
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
      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, expected);
    });

    it('removes invalid elements if no values remain in contact', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
        body: 'hey there!',
        source: NUMBER,
        sourceDevice: '1',
        sent_at: 1232132,
        contact: [
          {
            name: {
              displayName: 'Someone Somewhere',
            },
            number: [
              {
                type: 1,
              },
            ],
            email: [
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
      };
      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, expected);
    });

    it('handles a contact with just organization', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Contact.parseAndWriteAvatar(upgradeAttachment);

      const message = {
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
      const result = await upgradeVersion(message.contact[0], { message });
      assert.deepEqual(result, message.contact[0]);
    });
  });

  describe('_validate', () => {
    it('returns error if contact has no name.displayName or organization', () => {
      const messageId = 'the-message-id';
      const contact = {
        name: {
          name: 'Someone',
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

      const result = Contact._validate(contact, { messageId });
      assert.deepEqual(result.message, expected);
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

      const result = Contact._validate(contact, { messageId });
      assert.deepEqual(result.message, expected);
    });
  });
});
