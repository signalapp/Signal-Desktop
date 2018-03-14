const { assert } = require('chai');

const Message = require('../../../js/modules/types/message');


describe('Message', () => {
  describe('inheritSchemaVersion', () => {
    it('should ignore messages with previously inherited schema', () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };

      const actual = Message.inheritSchemaVersion(input);
      assert.deepEqual(actual, expected);
    });

    context('for message without attachments', () => {
      it('should initialize schema version to zero', () => {
        const input = {
          body: 'Imagine there is no heaven…',
          attachments: [],
        };
        const expected = {
          body: 'Imagine there is no heaven…',
          attachments: [],
          schemaVersion: 0,
        };

        const actual = Message.inheritSchemaVersion(input);
        assert.deepEqual(actual, expected);
      });
    });

    context('for message with attachments', () => {
      it('should inherit existing attachment schema version', () => {
        const input = {
          body: 'Imagine there is no heaven…',
          attachments: [{
            contentType: 'image/jpeg',
            fileName: 'lennon.jpg',
            schemaVersion: 7,
          }],
        };
        const expected = {
          body: 'Imagine there is no heaven…',
          attachments: [{
            contentType: 'image/jpeg',
            fileName: 'lennon.jpg',
          }],
          schemaVersion: 7,
        };

        const actual = Message.inheritSchemaVersion(input);
        assert.deepEqual(actual, expected);
      });
    });
  });
});
