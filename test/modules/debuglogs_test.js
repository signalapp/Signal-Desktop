const { assert } = require('chai');
const got = require('got');

const debuglogs = require('../../js/modules/debuglogs');

describe('debuglogs', () => {
  describe('upload', () => {
    it('should upload log content', async () => {
      const nonce = Math.random()
        .toString()
        .slice(2);
      const url = await debuglogs.upload(nonce);

      const { body } = await got.get(url);
      assert.equal(nonce, body);
    }).timeout(3000);
  });
});
