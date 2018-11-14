```js
const noop = () => {};

const mediaItems = [
  {
    objectURL: 'https://placekitten.com/799/600',
    contentType: 'image/jpeg',
    message: { id: 1 },
    attachment: {
      contentType: 'image/jpeg',
      caption:
        "This is a really long caption. Because the user had a lot to say. You know, it's very important to provide full context when sending an image. You don't want to make the wrong impression.",
    },
  },
  {
    objectURL: 'https://placekitten.com/900/600',
    contentType: 'image/jpeg',
    message: { id: 2 },
    attachment: { contentType: 'image/jpeg' },
  },
  // Unsupported image type
  {
    objectURL: 'foo.tif',
    contentType: 'image/tiff',
    message: { id: 3 },
    attachment: { contentType: 'image/tiff' },
  },
  // Video
  {
    objectURL: util.mp4ObjectUrl,
    contentType: 'video/mp4',
    message: { id: 4 },
    attachment: { contentType: 'video/mp4' },
  },
  {
    objectURL: 'https://placekitten.com/980/800',
    contentType: 'image/jpeg',
    message: { id: 5 },
    attachment: { contentType: 'image/jpeg' },
  },
  {
    objectURL: 'https://placekitten.com/656/540',
    contentType: 'image/jpeg',
    message: { id: 6 },
    attachment: { contentType: 'image/jpeg' },
  },
  {
    objectURL: 'https://placekitten.com/762/400',
    contentType: 'image/jpeg',
    message: { id: 7 },
    attachment: { contentType: 'image/jpeg' },
  },
  {
    objectURL: 'https://placekitten.com/920/620',
    contentType: 'image/jpeg',
    message: { id: 8 },
    attachment: { contentType: 'image/jpeg' },
  },
];

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <LightboxGallery media={mediaItems} onSave={noop} i18n={util.i18n} />
</div>;
```
