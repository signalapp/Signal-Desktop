### One image

```jsx
const attachments = [
  {
    url: util.gifObjectUrl,
    contentType: 'image/gif',
    width: 320,
    height: 240,
  },
];

<AttachmentList
  attachments={attachments}
  onClose={() => console.log('onClose')}
  onClickAttachment={attachment => {
    console.log('onClickAttachment', attachment);
  }}
  onCloseAttachment={attachment => {
    console.log('onCloseAttachment', attachment);
  }}
  i18n={util.i18n}
/>;
```

### Four images

```jsx
const attachments = [
  {
    url: util.gifObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 800,
    height: 1200,
  },
  {
    url: util.landscapeObjectUrl,
    contentType: 'image/png',
    width: 4496,
    height: 3000,
  },
  {
    url: util.landscapeGreenObjectUrl,
    contentType: 'image/png',
    width: 1000,
    height: 50,
  },
];

<div>
  <AttachmentList
    attachments={attachments}
    onClose={() => console.log('onClose')}
    onClickAttachment={attachment => {
      console.log('onClickAttachment', attachment);
    }}
    onCloseAttachment={attachment => {
      console.log('onCloseAttachment', attachment);
    }}
    i18n={util.i18n}
  />
</div>;
```

### A mix of attachment types

```jsx
const attachments = [
  {
    url: util.gifObjectUrl,
    contentType: 'image/gif',
    width: 320,
    height: 240,
  },
  {
    contentType: 'text/plain',
    fileName: 'manifesto.txt',
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 800,
    height: 1200,
  },
];

<div>
  <AttachmentList
    attachments={attachments}
    onClose={() => console.log('onClose')}
    onClickAttachment={attachment => {
      console.log('onClickAttachment', attachment);
    }}
    onCloseAttachment={attachment => {
      console.log('onCloseAttachment', attachment);
    }}
    i18n={util.i18n}
  />
</div>;
```

### No attachments provided

Nothing is shown if attachment list is empty.

```jsx
<AttachmentList attachments={[]} i18n={util.i18n} />
```
