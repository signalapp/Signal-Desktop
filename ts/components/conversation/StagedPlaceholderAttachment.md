```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'manifesto.txt',
};

<util.ConversationContext theme={util.theme}>
  <StagedPlaceholderAttachment
    onClick={attachment => console.log('onClick')}
    i18n={util.i18n}
  />
</util.ConversationContext>;
```
