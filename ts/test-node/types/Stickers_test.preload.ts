// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as Stickers from '../../types/Stickers.preload.ts';
import {
  isPackIdValid,
  MAX_STICKERS_PER_PACK,
  redactPackId,
} from '../../util/Stickers.std.ts';
import type { SignalService as Proto } from '../../protobuf/index.std.ts';

const PACK_ID = 'b9439fa5fdc8b9873fe64f01b88b8ccf';

function makeSticker(
  id: number,
  emoji: string | null = null
): Proto.StickerPack.Sticker {
  return { $unknown: [], id, emoji };
}

function makeManifest({
  cover = null,
  stickers = [],
}: {
  cover?: Proto.StickerPack.Sticker | null;
  stickers?: Array<Proto.StickerPack.Sticker>;
}): Proto.StickerPack {
  return {
    $unknown: [],
    title: 'title',
    author: 'author',
    cover,
    stickers,
  };
}

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
        // oxlint-disable-next-line no-new-wrappers
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
      assert.isTrue(isPackIdValid(PACK_ID));
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

  describe('parseStickerPackManifest', () => {
    it('throws if the pack has no cover and no stickers', () => {
      assert.throws(
        () => Stickers.parseStickerPackManifest(PACK_ID, makeManifest({})),
        /no cover, and no stickers/
      );
    });

    it('truncates a pack with more stickers than the maximum', () => {
      const result = Stickers.parseStickerPackManifest(
        PACK_ID,
        makeManifest({
          stickers: Array.from(
            { length: MAX_STICKERS_PER_PACK * 10 },
            (_, id) => makeSticker(id)
          ),
        })
      );

      assert.strictEqual(result.stickerCount, MAX_STICKERS_PER_PACK);
      // The cover is the first sticker, so it isn't in nonCoverStickers
      assert.strictEqual(result.coverStickerId, 0);
      assert.strictEqual(
        result.nonCoverStickers.length,
        MAX_STICKERS_PER_PACK - 1
      );
    });

    it('falls back to the first sticker as the cover', () => {
      const stickers = [makeSticker(0), makeSticker(1), makeSticker(2)];

      const result = Stickers.parseStickerPackManifest(
        PACK_ID,
        makeManifest({ stickers })
      );

      assert.strictEqual(result.coverStickerId, 0);
      assert.isTrue(result.coverIncludedInList);
      assert.strictEqual(result.stickerCount, 3);
      assert.deepEqual(
        result.nonCoverStickers.map(sticker => sticker.id),
        [1, 2]
      );
    });

    it('handles a cover that is not one of the stickers', () => {
      const result = Stickers.parseStickerPackManifest(
        PACK_ID,
        makeManifest({
          cover: makeSticker(99),
          stickers: [makeSticker(0), makeSticker(1)],
        })
      );

      assert.strictEqual(result.coverStickerId, 99);
      assert.isFalse(result.coverIncludedInList);
      assert.deepEqual(
        result.nonCoverStickers.map(sticker => sticker.id),
        [0, 1]
      );
    });

    it('takes the emoji from the sticker list if the cover has none', () => {
      const result = Stickers.parseStickerPackManifest(
        PACK_ID,
        makeManifest({
          cover: makeSticker(1),
          stickers: [makeSticker(1, '😀'), makeSticker(2, '😉')],
        })
      );

      assert.strictEqual(result.coverProto.emoji, '😀');
    });

    it('drops stickers with no id', () => {
      const result = Stickers.parseStickerPackManifest(
        PACK_ID,
        makeManifest({
          cover: makeSticker(0),
          stickers: [makeSticker(1), { $unknown: [], id: null, emoji: null }],
        })
      );

      assert.deepEqual(
        result.nonCoverStickers.map(sticker => sticker.id),
        [1]
      );
    });
  });
});
