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
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <div
    style={{
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}
  >
    <StickerButton
      i18n={util.i18n}
      receivedPacks={[]}
      installedPacks={packs}
      blessedPacks={[]}
      knownPacks={[]}
      onPickSticker={(packId, stickerId) =>
        console.log('onPickSticker', { packId, stickerId })
      }
      clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
      onClickAddPack={() => console.log('onClickAddPack')}
      recentStickers={[abeSticker, sticker1, sticker2, sticker3]}
    />
  </div>
</util.ConversationContext>;
```

#### No Installed Packs

When there are no installed packs the button should call the `onClickAddPack`
callback.

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <div
    style={{
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}
  >
    <StickerButton
      i18n={util.i18n}
      receivedPacks={packs}
      installedPacks={[]}
      blessedPacks={[]}
      knownPacks={[]}
      onPickSticker={(packId, stickerId) =>
        console.log('onPickSticker', { packId, stickerId })
      }
      clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
      onClickAddPack={() => console.log('onClickAddPack')}
      recentStickers={[abeSticker, sticker1, sticker2, sticker3]}
    />
  </div>
</util.ConversationContext>;
```

#### Just known packs

Even with just known packs, the button should render.

```jsx
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerButton
    i18n={util.i18n}
    receivedPacks={[]}
    installedPacks={[]}
    knownPacks={packs}
    blessedPacks={[]}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
    clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
    onClickAddPack={() => console.log('onClickAddPack')}
    recentStickers={[]}
  />
</util.ConversationContext>;
```

#### Just blessed packs

Even with just blessed packs, the button should render.

```jsx
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <StickerButton
    i18n={util.i18n}
    receivedPacks={[]}
    installedPacks={[]}
    blessedPacks={packs}
    knownPacks={[]}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
    clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
    onClickAddPack={() => console.log('onClickAddPack')}
    recentStickers={[]}
  />
</util.ConversationContext>;
```

#### No packs at all

When there are no advertised packs and no installed packs the button should not render anything.

```jsx
<util.ConversationContext theme={util.theme}>
  <StickerButton
    i18n={util.i18n}
    receivedPacks={[]}
    installedPacks={[]}
    blessedPacks={[]}
    knownPacks={[]}
    onPickSticker={(packId, stickerId) =>
      console.log('onPickSticker', { packId, stickerId })
    }
    clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
    onClickAddPack={() => console.log('onClickAddPack')}
    recentStickers={[]}
  />
</util.ConversationContext>
```

#### Installed Pack Tooltip

When a pack is installed there should be a tooltip saying as such.

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    title: 'Abe',
    cover: abeSticker,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...abeSticker, id })),
  },
  {
    id: 'bar',
    cover: sticker1,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'baz',
    cover: sticker2,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'qux',
    cover: sticker3,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <div
    style={{
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}
  >
    <StickerButton
      i18n={util.i18n}
      receivedPacks={[]}
      installedPacks={packs}
      blessedPacks={[]}
      knownPacks={[]}
      installedPack={packs[0]}
      onPickSticker={(packId, stickerId) =>
        console.log('onPickSticker', { packId, stickerId })
      }
      clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
      onClickAddPack={() => console.log('onClickAddPack')}
      recentStickers={[]}
    />
  </div>
</util.ConversationContext>;
```

#### New Installation Splash Tooltip

When the application is updated or freshly installed there should be a tooltip
showing the user the sticker button.

```jsx
const abeSticker = { id: 4, url: util.squareStickerObjectUrl, packId: 'abe' };
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    title: 'Abe',
    cover: abeSticker,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...abeSticker, id })),
  },
  {
    id: 'bar',
    cover: sticker1,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'baz',
    cover: sticker2,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'qux',
    cover: sticker3,
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

<util.ConversationContext theme={util.theme}>
  <div
    style={{
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    }}
  >
    <StickerButton
      i18n={util.i18n}
      receivedPacks={[]}
      installedPacks={packs}
      blessedPacks={[]}
      knownPacks={[]}
      onPickSticker={(packId, stickerId) =>
        console.log('onPickSticker', { packId, stickerId })
      }
      clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
      onClickAddPack={() => console.log('onClickAddPack')}
      recentStickers={[]}
      showIntroduction
      clearShowIntroduction={() => console.log('clearShowIntroduction')}
    />
  </div>
</util.ConversationContext>;
```
