```jsx
const mediaItems = [
  {
    index: 0,
    message: {
      id: '1',
    },
    attachment: {
      fileName: 'foo.json',
      contentType: 'application/json',
      size: 53313,
    },
  },
  {
    index: 1,
    message: {
      id: '2',
    },
    attachment: {
      fileName: 'bar.txt',
      contentType: 'text/plain',
      size: 10323,
    },
  },
];

<AttachmentSection
  header="Today"
  type="documents"
  mediaItems={mediaItems}
  i18n={util.i18n}
/>;
```
