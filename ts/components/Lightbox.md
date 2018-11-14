## Image

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

## Image with caption

```js
const noop = () => {};

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <Lightbox
    objectURL="https://placekitten.com/800/600"
    caption="This is the user-provided caption. We show it overlaid on the image. If it's really long, then it wraps, but it doesn't get too close to the edges of the image."
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
