```js
const noop = () => {};

const messages = [
  {
    objectURL: 'https://placekitten.com/800/600',
    attachments: [
      {
        contentType: 'image/jpeg',
      },
    ],
  },
  {
    objectURL: 'https://placekitten.com/900/600',
    attachments: [
      {
        contentType: 'image/jpeg',
      },
    ],
  },
  {
    objectURL: 'https://placekitten.com/980/800',
    attachments: [
      {
        contentType: 'image/jpeg',
      },
    ],
  },
  {
    objectURL: 'https://placekitten.com/656/540',
    attachments: [
      {
        contentType: 'image/jpeg',
      },
    ],
  },
  {
    objectURL: 'https://placekitten.com/762/400',
    attachments: [
      {
        contentType: 'image/jpeg',
      },
    ],
  },
  {
    objectURL: 'https://placekitten.com/920/620',
    attachments: [
      {
        contentType: 'image/jpeg',
      },
    ],
  },
];

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <LightboxGallery messages={messages} onSave={noop} />
</div>;
```
