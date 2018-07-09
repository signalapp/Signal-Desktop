```js
const noop = () => {};

const messages = [
  {
    objectURL: 'https://placekitten.com/799/600',
    attachments: [{ contentType: 'image/jpeg' }],
  },
  {
    objectURL: 'https://placekitten.com/900/600',
    attachments: [{ contentType: 'image/jpeg' }],
  },
  // Unsupported image type
  {
    objectURL: 'foo.tif',
    attachments: [{ contentType: 'image/tiff' }],
  },
  // Video
  {
    objectURL: util.mp4ObjectUrl,
    attachments: [{ contentType: 'video/mp4' }],
  },
  {
    objectURL: 'https://placekitten.com/980/800',
    attachments: [{ contentType: 'image/jpeg' }],
  },
  {
    objectURL: 'https://placekitten.com/656/540',
    attachments: [{ contentType: 'image/jpeg' }],
  },
  {
    objectURL: 'https://placekitten.com/762/400',
    attachments: [{ contentType: 'image/jpeg' }],
  },
  {
    objectURL: 'https://placekitten.com/920/620',
    attachments: [{ contentType: 'image/jpeg' }],
  },
];

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <LightboxGallery messages={messages} onSave={noop} i18n={util.i18n} />
</div>;
```
