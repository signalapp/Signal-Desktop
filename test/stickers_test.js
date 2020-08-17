/* global Signal */

const { Stickers } = Signal;

describe('Stickers', () => {
  describe('redactPackId', () => {
    it('redacts pack IDs', () => {
      assert.strictEqual(
        Stickers.redactPackId('b9439fa5fdc8b9873fe64f01b88b8ccf'),
        '[REDACTED]ccf'
      );
    });
  });
});
