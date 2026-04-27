import {
  encode as $encode, decode as $decode,
} from '@indutny/protopiler';
const $EMPTY_BYTES = new Uint8Array(0);
const StickerPack_Sticker$SPEC = [33,112];
const StickerPack$SPEC = [112,112,128,128];
export const StickerPack = {
  Sticker: {
  decode(data, start, end) {
    const res = {
      $unknown: [],
      id: null,
      emoji: null,
    };
    $decode(data, StickerPack_Sticker$SPEC, (id, value) => {
      switch (id) {
        case 1:
          res.id = value;
          break;
        case 2:
          res.emoji = value;
          break;
        default:
          res.$unknown.push(value);
          break;
      }
    }, start, end);
    return res;
  },
  $f(data) {
    const fields = [];
    if (data.id != null) {
      fields.push({
        i: 1,
        t: 33,
        v: data.id,
        b: 0,
      });
    }
    if (data.emoji != null) {
      fields.push({
        i: 2,
        t: 112,
        v: data.emoji,
        b: 0,
      });
    }
    return fields;
  },
  encode(data) {
    return $encode(this.$f(data));
  }
},
  decode(data, start, end) {
    const res = {
      $unknown: [],
      title: null,
      author: null,
      cover: null,
      stickers: [],
    };
    $decode(data, StickerPack$SPEC, (id, value) => {
      switch (id) {
        case 1:
          res.title = value;
          break;
        case 2:
          res.author = value;
          break;
        case 3:
          res.cover = StickerPack.Sticker.decode(data, value.start, value.end);
          break;
        case 4:
          res.stickers.push(StickerPack.Sticker.decode(data, value.start, value.end));
          break;
        default:
          res.$unknown.push(value);
          break;
      }
    }, start, end);
    return res;
  },
  $f(data) {
    const fields = [];
    if (data.title != null) {
      fields.push({
        i: 1,
        t: 112,
        v: data.title,
        b: 0,
      });
    }
    if (data.author != null) {
      fields.push({
        i: 2,
        t: 112,
        v: data.author,
        b: 0,
      });
    }
    if (data.cover != null) {
      fields.push({
        i: 3,
        t: 128,
        v: StickerPack.Sticker.$f(data.cover),
        b: 0,
      });
    }
    if (data.stickers != null && data.stickers.length > 0) {
      for (const value of data.stickers) {
        fields.push({
          i: 4,
          t: 128,
          v: StickerPack.Sticker.$f(value),
          b: 0,
        });
      }
    }
    return fields;
  },
  encode(data) {
    return $encode(this.$f(data));
  }
};