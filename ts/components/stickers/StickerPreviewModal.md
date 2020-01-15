#### Not yet installed

```jsx
const abeSticker = { url: util.squareStickerObjectUrl, packId: 'abe' };
const wideSticker = {
  id: 4,
  url: util.landscapeGreenObjectUrl,
  packId: 'wide',
};
const tallSticker = { id: 4, url: util.portraitTealObjectUrl, packId: 'tall' };

const pack = {
  id: 'foo',
  cover: abeSticker,
  title: 'Foo',
  isBlessed: true,
  author: 'Foo McBarrington',
  status: 'downloaded',
  stickerCount: 101,
  stickers: [
    wideSticker,
    tallSticker,
    ...Array(101)
      .fill(0)
      .map((n, id) => ({ ...abeSticker, id })),
  ],
};

<util.ConversationContext theme={util.theme}>
  <StickerPreviewModal
    onClose={() => console.log('onClose')}
    installStickerPack={(...args) => console.log('installStickerPack', ...args)}
    uninstallStickerPack={(...args) =>
      console.log('uninstallStickerPack', ...args)
    }
    i18n={util.i18n}
    pack={pack}
  />
</util.ConversationContext>;
```
