#### Default

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
  {
    id: 'qux',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'quux',
    cover: sticker3,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'corge',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'grault',
    cover: sticker1,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'garply',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'waldo',
    cover: sticker3,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
  {
    id: 'fred',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'plugh',
    cover: sticker1,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'xyzzy',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'thud',
    cover: abeSticker,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...abeSticker, id })),
  },
  {
    id: 'banana',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'apple',
    cover: sticker1,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'strawberry',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'tombrady',
    cover: abeSticker,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...abeSticker, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerPicker
    i18n={util.i18n}
    packs={packs}
    recentStickers={[
      abeSticker,
      sticker1,
      sticker2,
      sticker3,
      { ...sticker2, id: 9999 },
    ]}
    onClose={() => console.log('onClose')}
    onClickAddPack={() => console.log('onClickAddPack')}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
  />
</util.ConversationContext>;
```

#### No Recently Used Stickers

The sticker picker defaults to the first pack when there are no recent stickers.

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    stickerCount: 101,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerPicker
    i18n={util.i18n}
    packs={packs}
    recentStickers={[]}
    onClose={() => console.log('onClose')}
    onClickAddPack={() => console.log('onClickAddPack')}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
  />
</util.ConversationContext>;
```

#### Empty

```jsx
<util.ConversationContext theme={util.theme}>
  <StickerPicker
    i18n={util.i18n}
    packs={[]}
    recentStickers={[]}
    onClose={() => console.log('onClose')}
    onClickAddPack={() => console.log('onClickAddPack')}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
  />
</util.ConversationContext>
```

#### Pending Download

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const packs = [
  {
    id: 'tombrady',
    status: 'pending',
    cover: abeSticker,
    stickerCount: 30,
    stickers: [abeSticker],
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerPicker
    i18n={util.i18n}
    packs={packs}
    recentStickers={[]}
    onClose={() => console.log('onClose')}
    onClickAddPack={() => console.log('onClickAddPack')}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
  />
</util.ConversationContext>;
```

#### Picker Hint

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const packs = [
  {
    id: 'tombrady',
    cover: abeSticker,
    stickerCount: 100,
    stickers: Array(100)
      .fill(0)
      .map((_el, i) => ({ ...abeSticker, id: i })),
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerPicker
    i18n={util.i18n}
    packs={packs}
    recentStickers={[]}
    onClose={() => console.log('onClose')}
    onClickAddPack={() => console.log('onClickAddPack')}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
    showPickerHint={true}
  />
</util.ConversationContext>;
```

#### Pack With Error

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const packs = [
  {
    id: 'tombrady',
    status: 'error',
    cover: abeSticker,
    stickerCount: 3,
    stickers: [],
  },
  {
    id: 'foo',
    status: 'error',
    cover: abeSticker,
    stickerCount: 3,
    stickers: [abeSticker],
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerPicker
    i18n={util.i18n}
    packs={packs}
    recentStickers={[]}
    onClose={() => console.log('onClose')}
    onClickAddPack={() => console.log('onClickAddPack')}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
  />
</util.ConversationContext>;
```
