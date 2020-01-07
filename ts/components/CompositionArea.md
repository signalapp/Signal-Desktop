#### Default

```jsx
<util.ConversationContext theme={util.theme}>
  <div style={{ minHeight: '500px', paddingTop: '450px' }}>
    <CompositionArea
      i18n={util.i18n}
      onSubmit={s => console.log('onSubmit', s)}
      onDirtyChange={dirty =>
        console.log(`Dirty Change: ${dirty ? 'dirty' : 'not dirty'}`)
      }
      // EmojiButton
      onSetSkinTone={s => console.log('onSetSkinTone', s)}
      // StickerButton
      knownPacks={[]}
      receivedPacks={[]}
      installedPacks={[]}
      blessedPacks={[]}
      recentStickers={[]}
      clearInstalledStickerPack={() => console.log('clearInstalledStickerPack')}
      onClickAddPack={(...args) => console.log('onClickAddPack', ...args)}
      onPickSticker={(...args) => console.log('onPickSticker', ...args)}
      clearShowIntroduction={() => console.log('clearShowIntroduction')}
      showPickerHint={false}
      clearShowPickerHint={() => console.log('clearShowIntroduction')}
    />
  </div>
</util.ConversationContext>
```
