## Image (supported format)

```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <Lightbox
    objectURL="https://placekitten.com/800/600"
    contentType="image/jpeg"
    onSave={noop}
    i18n={util.i18n}
  />
</div>;
```

## Image (unsupported format)

```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <Lightbox
    objectURL="foo.tif"
    contentType="image/tiff"
    onSave={noop}
    i18n={util.i18n}
  />
</div>;
```

## Video (supported format)

```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <Lightbox
    objectURL="fixtures/pixabay-Soap-Bubble-7141.mp4"
    contentType="video/mp4"
    onSave={noop}
    i18n={util.i18n}
  />
</div>;
```

## Video (unsupported format)

```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <Lightbox
    objectURL="foo.mov"
    contentType="video/quicktime"
    onSave={noop}
    i18n={util.i18n}
  />
</div>;
```

## Unsupported file format

```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 600 }}>
  <Lightbox
    objectURL="tsconfig.json"
    contentType="application/json"
    onSave={noop}
    i18n={util.i18n}
  />
</div>;
```
