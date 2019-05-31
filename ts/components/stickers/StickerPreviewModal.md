#### Not yet installed

```jsx
const abeSticker = { url: util.squareStickerObjectUrl, packId: 'abe' };

const pack = {
  id: 'foo',
  cover: abeSticker,
  title: 'Foo',
  isBlessed: true,
  author: 'Foo McBarrington',
  status: 'downloaded',
  stickers: Array(101)
    .fill(0)
    .map((n, id) => ({ ...abeSticker, id })),
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
