```js
const noop = () => {};

const items = [
  { objectURL: 'https://placekitten.com/800/600', contentType: 'image/jpeg' },
  { objectURL: 'https://placekitten.com/900/600', contentType: 'image/jpeg' },
  { objectURL: 'https://placekitten.com/980/800', contentType: 'image/jpeg' },
  { objectURL: 'https://placekitten.com/656/540', contentType: 'image/jpeg' },
  { objectURL: 'https://placekitten.com/762/400', contentType: 'image/jpeg' },
  { objectURL: 'https://placekitten.com/920/620', contentType: 'image/jpeg' },
];

<div style={{position: 'relative', width: '100%', height: 500}}>
  <LightboxGallery
    items={items}
    onSave={noop}
  />
</div>
```
