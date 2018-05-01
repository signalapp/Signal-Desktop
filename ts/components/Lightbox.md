```js
const noop = () => {};

<div style={{position: 'relative', width: '100%', height: 500}}>
  <Lightbox
    imageURL="https://placekitten.com/800/600"
    onNext={noop}
    onPrevious={noop}
    onSave={noop}
  />
</div>
```
