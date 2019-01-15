## Image

```js
let caption = null;

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <CaptionEditor
    url={util.gifObjectUrl}
    attachment={{
      contentType: 'image/jpeg',
    }}
    onSave={caption => console.log('onSave', caption)}
    close={() => console.log('close')}
    i18n={util.i18n}
  />
</div>;
```

## Image with caption

```js
let caption =
  "This is the user-provided caption. We show it overlaid on the image. If it's really long, then it wraps, but it doesn't get too close to the edges of the image.";

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <CaptionEditor
    url="https://placekitten.com/800/600"
    attachment={{
      contentType: 'image/jpeg',
    }}
    caption={caption}
    contentType="image/jpeg"
    onSave={caption => console.log('onSave', caption)}
    close={() => console.log('close')}
    i18n={util.i18n}
  />
</div>;
```

## Video

```js
let caption = null;

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <CaptionEditor
    url="fixtures/pixabay-Soap-Bubble-7141.mp4"
    attachment={{
      contentType: 'video/mp4',
    }}
    onSave={caption => console.log('onSave', caption)}
    close={() => console.log('close')}
    i18n={util.i18n}
  />
</div>;
```

## Video with caption

```js
let caption =
  "This is the user-provided caption. We show it overlaid on the image. If it's really long, then it wraps, but it doesn't get too close to the edges of the image.";

<div style={{ position: 'relative', width: '100%', height: 500 }}>
  <CaptionEditor
    url="fixtures/pixabay-Soap-Bubble-7141.mp4"
    attachment={{
      contentType: 'video/mp4',
    }}
    caption={caption}
    onSave={caption => console.log('onSave', caption)}
    close={() => console.log('close')}
    i18n={util.i18n}
  />
</div>;
```
