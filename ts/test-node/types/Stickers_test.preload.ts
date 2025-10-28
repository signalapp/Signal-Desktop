// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as Stickers from '../../types/Stickers.preload.js';
import { isPackIdValid, redactPackId } from '../../util/Stickers.std.js';

describe('Stickers', () => {
  describe('getDataFromLink', () => {
    it('returns undefined for invalid URLs', () => {
      assert.isUndefined(Stickers.getDataFromLink('https://'));
      assert.isUndefined(Stickers.getDataFromLink('signal.art/addstickers/'));
    });

    it("returns undefined for URLs that don't have a hash", () => {
      assert.isUndefined(
        Stickers.getDataFromLink('https://signal.art/addstickers/')
      );
      assert.isUndefined(
        Stickers.getDataFromLink('https://signal.art/addstickers/#')
      );
    });

    it('returns undefined when no key or pack ID is found', () => {
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=c8c83285b547872ac4c589d64a6edd6a'
        )
      );
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=c8c83285b547872ac4c589d64a6edd6a&pack_key='
        )
      );
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e'
        )
      );
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e&pack_id='
        )
      );
    });

    it('returns undefined when the pack ID is invalid', () => {
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=garbage&pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e'
        )
      );
    });

    it('returns undefined if the ID or key are passed as arrays', () => {
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id[]=c8c83285b547872ac4c589d64a6edd6a&pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e'
        )
      );
      assert.isUndefined(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=c8c83285b547872ac4c589d64a6edd6a&pack_key[]=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e'
        )
      );
    });

    it('parses the ID and key from the hash', () => {
      assert.deepEqual(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=c8c83285b547872ac4c589d64a6edd6a&pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e'
        ),
        {
          id: 'c8c83285b547872ac4c589d64a6edd6a',
          key: '59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e',
        }
      );
    });

    it('ignores additional hash parameters', () => {
      assert.deepEqual(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=c8c83285b547872ac4c589d64a6edd6a&pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e&pack_foo=bar'
        ),
        {
          id: 'c8c83285b547872ac4c589d64a6edd6a',
          key: '59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e',
        }
      );
    });

    it('only parses the first ID and key from the hash if more than one is supplied', () => {
      assert.deepEqual(
        Stickers.getDataFromLink(
          'https://signal.art/addstickers/#pack_id=c8c83285b547872ac4c589d64a6edd6a&pack_key=59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e&pack_id=extra&pack_key=extra'
        ),
        {
          id: 'c8c83285b547872ac4c589d64a6edd6a',
          key: '59bb3a8860f0e6a5a83a5337a015c8d55ecd2193f82d77202f3b8112a845636e',
        }
      );
    });
  });

  describe('isPackIdValid', () => {
    it('returns false for non-strings', () => {
      assert.isFalse(isPackIdValid(undefined));
      assert.isFalse(isPackIdValid(null));
      assert.isFalse(isPackIdValid(123));
      assert.isFalse(isPackIdValid(123));
      assert.isFalse(isPackIdValid(['b9439fa5fdc8b9873fe64f01b88b8ccf']));
      assert.isFalse(
        // eslint-disable-next-line no-new-wrappers
        isPackIdValid(new String('b9439fa5fdc8b9873fe64f01b88b8ccf'))
      );
    });

    it('returns false for invalid pack IDs', () => {
      assert.isFalse(isPackIdValid(''));
      assert.isFalse(isPackIdValid('x9439fa5fdc8b9873fe64f01b88b8ccf'));
      assert.isFalse(
        // This is one character too short.
        isPackIdValid('b9439fa5fdc8b9873fe64f01b88b8cc')
      );
      assert.isFalse(
        // This is one character too long.
        isPackIdValid('b9439fa5fdc8b9873fe64f01b88b8ccfa')
      );
    });

    it('returns true for valid pack IDs', () => {
      assert.isTrue(isPackIdValid('b9439fa5fdc8b9873fe64f01b88b8ccf'));
      assert.isTrue(isPackIdValid('3eff225a1036a58a7530b312dd92f8d8'));
      assert.isTrue(isPackIdValid('DDFD48B8097DA7A4E928192B10963F6A'));
    });
  });

  describe('redactPackId', () => {
    it('redacts pack IDs', () => {
      assert.strictEqual(
        redactPackId('b9439fa5fdc8b9873fe64f01b88b8ccf'),
        '[REDACTED]ccf'
      );
    });
  });
});
