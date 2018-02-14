const { assert } = require('chai');

const Message = require('../../../js/modules/types/message');


describe('Message', () => {
  describe('getGroupDescriptor', () => {
    it('should return valid descriptor`', () => {
      const group = {
        id: '+10000000000',
      };
      const expected = {
        type: 'group',
        id: '+10000000000',
      };
      assert.deepEqual(Message.getGroupDescriptor(group), expected);
    });
  });

  describe('getDescriptorForSent', () => {
    context('for private messages', () => {
      it('should return valid descriptor`', () => {
        const data = {
          message: {
            id: '+10000000000',
          },
          destination: '+10000000000',
        };

        const expected = {
          type: 'private',
          id: '+10000000000',
        };

        assert.deepEqual(Message.getDescriptorForSent(data), expected);
      });
    });
    context('for group messages', () => {
      it('should return valid descriptor`', () => {
        const data = {
          message: {
            group: {
              id: '+10000000000',
            },
          },
        };

        const expected = {
          type: 'group',
          id: '+10000000000',
        };

        assert.deepEqual(Message.getDescriptorForSent(data), expected);
      });
    });
  });

  describe('getDescriptorForReceived', () => {
    context('for private messages', () => {
      it('should return valid descriptor`', () => {
        const data = {
          message: {
            id: '+10000000000',
          },
          source: '+10000000000',
        };

        const expected = {
          type: 'private',
          id: '+10000000000',
        };

        assert.deepEqual(Message.getDescriptorForReceived(data), expected);
      });
    });
    context('for group messages', () => {
      it('should return valid descriptor`', () => {
        const data = {
          message: {
            group: {
              id: '+10000000000',
            },
          },
        };

        const expected = {
          type: 'group',
          id: '+10000000000',
        };

        assert.deepEqual(Message.getDescriptorForReceived(data), expected);
      });
    });
  });
});
