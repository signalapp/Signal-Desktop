// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as Stickers from '../../types/Stickers.preload.ts';
import { isPackIdValid, redactPackId } from '../../util/Stickers.std.ts';
import * as Bytes from '../../Bytes.std.ts';
import { deriveStickerPackKey, encryptAttachment } from '../../Crypto.node.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { IMAGE_PNG } from '../../types/MIME.std.ts';

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

  describe('fetchStickerPackContents', () => {
    const packId = 'b9439fa5fdc8b9873fe64f01b88b8ccf';
    const packKey = new Uint8Array(32).fill(1);
    const link = `https://signal.art/addstickers/#pack_id=${packId}&pack_key=${Bytes.toHex(packKey)}`;

    const keys = deriveStickerPackKey(packKey);
    const encrypt = (plaintext: Uint8Array<ArrayBuffer>) =>
      encryptAttachment({ plaintext, keys }).ciphertext;

    const png = (byte: number) =>
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, byte]);

    function fakeApi(pack: Proto.StickerPack.Params) {
      return {
        getManifest: async () => encrypt(Proto.StickerPack.encode(pack)),
        getSticker: async (_: string, id: number) => encrypt(png(id)),
      };
    }

    const emptyPack = {
      title: null,
      author: null,
      cover: null,
      stickers: null,
    };

    it('rejects links that are not sticker pack links', async () => {
      await assert.isRejected(
        Stickers.fetchStickerPackContents(
          'https://example.com',
          fakeApi(emptyPack)
        )
      );
    });

    it('preserves sticker order, emoji, and bytes', async () => {
      const contents = await Stickers.fetchStickerPackContents(
        link,
        fakeApi({
          ...emptyPack,
          title: 'Cats',
          author: 'Ehab',
          cover: { id: 1, emoji: null },
          stickers: [
            { id: 0, emoji: '😀' },
            { id: 1, emoji: '😾' },
          ],
        })
      );

      assert.strictEqual(contents.title, 'Cats');
      assert.strictEqual(contents.author, 'Ehab');
      assert.strictEqual(contents.coverStickerId, 1);
      assert.isUndefined(contents.coverImage);
      assert.deepEqual(
        contents.stickers.map(({ id, emoji, contentType }) => ({
          id,
          emoji,
          contentType,
        })),
        [
          { id: 0, emoji: '😀', contentType: IMAGE_PNG },
          { id: 1, emoji: '😾', contentType: IMAGE_PNG },
        ]
      );
      assert.deepEqual(contents.stickers[0]?.data, png(0));
    });

    it('downloads a cover that is not in the sticker list', async () => {
      const contents = await Stickers.fetchStickerPackContents(
        link,
        fakeApi({
          ...emptyPack,
          cover: { id: 5, emoji: null },
          stickers: [{ id: 0, emoji: '😀' }],
        })
      );

      assert.isUndefined(contents.coverStickerId);
      assert.deepEqual(contents.coverImage?.data, png(5));
    });

    it('rejects when decryption fails', async () => {
      await assert.isRejected(
        Stickers.fetchStickerPackContents(link, {
          getManifest: async () => new Uint8Array(64),
          getSticker: async () => new Uint8Array(64),
        })
      );
    });

    it('reports progress including a distinct cover', async () => {
      const seen: Array<[number, number]> = [];
      await Stickers.fetchStickerPackContents(link, {
        ...fakeApi({
          ...emptyPack,
          cover: { id: 5, emoji: null },
          stickers: [
            { id: 0, emoji: '😀' },
            { id: 1, emoji: '😾' },
          ],
        }),
        onProgress: (done, total) => seen.push([done, total]),
      });

      assert.deepEqual(seen, [
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it('does not count a cover from the sticker list twice', async () => {
      const seen: Array<[number, number]> = [];
      await Stickers.fetchStickerPackContents(link, {
        ...fakeApi({
          ...emptyPack,
          cover: { id: 1, emoji: null },
          stickers: [
            { id: 0, emoji: '😀' },
            { id: 1, emoji: '😾' },
          ],
        }),
        onProgress: (done, total) => seen.push([done, total]),
      });

      assert.deepEqual(seen, [
        [1, 2],
        [2, 2],
      ]);
    });

    it('reports no progress for an empty pack', async () => {
      const seen: Array<[number, number]> = [];
      await Stickers.fetchStickerPackContents(link, {
        ...fakeApi(emptyPack),
        onProgress: (done, total) => seen.push([done, total]),
      });

      assert.deepEqual(seen, []);
    });
  });
});
