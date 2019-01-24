```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'manifesto.txt',
};

<util.ConversationContext theme={util.theme}>
  <StagedPlaceholderAttachment onClick={attachment => console.log('onClick')} />
</util.ConversationContext>;
```
