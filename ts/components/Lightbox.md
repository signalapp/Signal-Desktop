```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <Lightbox
    objectURL="https://placekitten.com/800/600"
    contentType="image/jpeg"
    onNext={noop}
    onPrevious={noop}
    onSave={noop}
  />
</div>;
```
