Text file

```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'manifesto.txt',
};

<util.ConversationContext theme={util.theme}>
  <StagedGenericAttachment
    attachment={attachment}
    i18n={util.i18n}
    onClose={attachment => console.log('onClose', attachment)}
  />
</util.ConversationContext>;
```

File with long name

```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'this-is-my-very-important-manifesto-you-must-read-it.txt',
};

<util.ConversationContext theme={util.theme}>
  <StagedGenericAttachment
    attachment={attachment}
    i18n={util.i18n}
    onClose={attachment => console.log('onClose', attachment)}
  />
</util.ConversationContext>;
```

File with long extension

```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'manifesto.reallylongtxt',
};

<util.ConversationContext theme={util.theme}>
  <StagedGenericAttachment
    attachment={attachment}
    i18n={util.i18n}
    onClose={attachment => console.log('onClose', attachment)}
  />
</util.ConversationContext>;
```
