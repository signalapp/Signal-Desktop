#### Default

```jsx
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    title: 'Foo',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    title: 'Baz',
    author: 'Foo McBarrington (Official)',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    title: 'Third',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

const receivedPacks = packs.map(p => ({ ...p, status: 'downloaded' }));
const installedPacks = packs.map(p => ({ ...p, status: 'installed' }));
const blessedPacks = packs.map(p => ({
  ...p,
  status: 'downloaded',
  isBlessed: true,
}));

<util.ConversationContext theme={util.theme}>
  <StickerManager
    i18n={util.i18n}
    installedPacks={installedPacks}
    receivedPacks={receivedPacks}
    blessedPacks={blessedPacks}
    installStickerPack={id => console.log('installStickerPack', id)}
    uninstallStickerPack={id => console.log('uninstallStickerPack', id)}
  />
</util.ConversationContext>;
```

#### Only installed packs

```jsx
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    title: 'Foo',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    title: 'Baz',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    title: 'Baz',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

const installedPacks = packs.map(p => ({ ...p, status: 'installed' }));
const noPacks = [];

<util.ConversationContext theme={util.theme}>
  <StickerManager
    i18n={util.i18n}
    installedPacks={installedPacks}
    receivedPacks={noPacks}
    blessedPacks={noPacks}
    installStickerPack={id => console.log('installStickerPack', id)}
    uninstallStickerPack={id => console.log('uninstallStickerPack', id)}
  />
</util.ConversationContext>;
```

#### Only received packs

```jsx
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const packs = [
  {
    id: 'foo',
    cover: sticker1,
    title: 'Foo',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
  {
    id: 'bar',
    cover: sticker2,
    title: 'Baz',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker2, id })),
  },
  {
    id: 'baz',
    cover: sticker3,
    title: 'Baz',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker3, id })),
  },
];

const receivedPacks = packs.map(p => ({ ...p, status: 'installed' }));
const noPacks = [];

<util.ConversationContext theme={util.theme}>
  <StickerManager
    i18n={util.i18n}
    installedPacks={noPacks}
    receivedPacks={receivedPacks}
    blessedPacks={noPacks}
    installStickerPack={id => console.log('installStickerPack', id)}
  />
</util.ConversationContext>;
```

#### Just installed and 'known'

```jsx
const sticker1 = { id: 1, url: util.kitten164ObjectUrl, packId: 'foo' };
const sticker2 = { id: 2, url: util.kitten264ObjectUrl, packId: 'bar' };
const sticker3 = { id: 3, url: util.kitten364ObjectUrl, packId: 'baz' };

const installedPacks = [
  {
    id: 'foo',
    cover: sticker1,
    title: 'Foo',
    status: 'installed',
    author: 'Foo McBarrington',
    stickers: Array(101)
      .fill(0)
      .map((n, id) => ({ ...sticker1, id })),
  },
];

const knownPacks = [
  {
    id: 'foo',
    key: 'key1',
    stickers: [],
    state: 'known',
  },
  {
    id: 'bar',
    key: 'key2',
    stickers: [],
    state: 'known',
  },
  {
    id: 'baz',
    key: 'key3',
    stickers: [],
    state: 'known',
  },
];

const noPacks = [];

<util.ConversationContext theme={util.theme}>
  <StickerManager
    i18n={util.i18n}
    installedPacks={installedPacks}
    receivedPacks={noPacks}
    blessedPacks={noPacks}
    knownPacks={knownPacks}
    installStickerPack={id => console.log('installStickerPack', id)}
    downloadStickerPack={(packId, packKey, options) =>
      console.log('downloadStickerPack', { packId, packKey, options })
    }
  />
</util.ConversationContext>;
```

#### No packs at All

```jsx
const noPacks = [];

<util.ConversationContext theme={util.theme}>
  <div style={{ height: '500px' }}>
    <StickerManager
      i18n={util.i18n}
      installedPacks={noPacks}
      receivedPacks={noPacks}
      blessedPacks={noPacks}
      installStickerPack={id => console.log('installStickerPack', id)}
      uninstallStickerPack={id => console.log('uninstallStickerPack', id)}
    />
  </div>
</util.ConversationContext>;
```
