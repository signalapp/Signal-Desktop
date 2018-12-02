Text file

```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'manifesto.txt',
};

<StagedGenericAttachment
  attachment={attachment}
  i18n={util.i18n}
  onClose={attachment => console.log('onClose', attachment)}
/>;
```

File with long name

```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'this-is-my-very-important-manifesto-you-must-read-it.txt',
};

<StagedGenericAttachment
  attachment={attachment}
  i18n={util.i18n}
  onClose={attachment => console.log('onClose', attachment)}
/>;
```

File with long extension

```js
const attachment = {
  contentType: 'text/plain',
  fileName: 'manifesto.reallylongtxt',
};

<StagedGenericAttachment
  attachment={attachment}
  i18n={util.i18n}
  onClose={attachment => console.log('onClose', attachment)}
/>;
```
