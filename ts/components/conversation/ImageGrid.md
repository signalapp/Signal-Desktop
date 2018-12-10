### One image

```jsx
const attachments = [
  {
    url: util.gifObjectUrl,
    contentType: 'image/gif',
    width: 320,
    height: 240,
  },
];

<div>
  <div>
    <ImageGrid attachments={attachments} i18n={util.i18n} />
  </div>
  <hr />
  <div>
    <ImageGrid
      withContentAbove
      withContentBelow
      attachments={attachments}
      i18n={util.i18n}
    />
  </div>
</div>;
```

### One image, various aspect ratios

```jsx
<div>
  <ImageGrid
    attachments={[
      {
        url: util.pngObjectUrl,
        contentType: 'image/png',
        width: 800,
        height: 1200,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.gifObjectUrl,
        contentType: 'image/png',
        width: 320,
        height: 240,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.landscapeObjectUrl,
        contentType: 'image/png',
        width: 4496,
        height: 3000,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.landscapeGreenObjectUrl,
        contentType: 'image/png',
        width: 1000,
        height: 50,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.landscapePurpleObjectUrl,
        contentType: 'image/png',
        width: 200,
        height: 50,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.portraitYellowObjectUrl,
        contentType: 'image/png',
        width: 20,
        height: 200,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.landscapeRedObjectUrl,
        contentType: 'image/png',
        width: 300,
        height: 1,
      },
    ]}
    i18n={util.i18n}
  />
  <hr />
  <ImageGrid
    attachments={[
      {
        url: util.portraitTealObjectUrl,
        contentType: 'image/png',
        width: 50,
        height: 1000,
      },
    ]}
    i18n={util.i18n}
  />
</div>
```

### Two images

```jsx
const attachments = [
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
];

<div>
  <div>
    <ImageGrid attachments={attachments} i18n={util.i18n} />
  </div>
  <hr />
  <div>
    <ImageGrid
      withContentAbove
      withContentBelow
      attachments={attachments}
      i18n={util.i18n}
    />
  </div>
</div>;
```

### Three images

```jsx
const attachments = [
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
];

<div>
  <div>
    <ImageGrid attachments={attachments} i18n={util.i18n} />
  </div>
  <hr />
  <div>
    <ImageGrid
      withContentAbove
      withContentBelow
      attachments={attachments}
      i18n={util.i18n}
    />
  </div>
</div>;
```

### Four images

```jsx
const attachments = [
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
];

<div>
  <div>
    <ImageGrid attachments={attachments} i18n={util.i18n} />
  </div>
  <hr />
  <div>
    <ImageGrid
      withContentAbove
      withContentBelow
      attachments={attachments}
      i18n={util.i18n}
    />
  </div>
</div>;
```

### Five images

```jsx
const attachments = [
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
];

<div>
  <div>
    <ImageGrid attachments={attachments} i18n={util.i18n} />
  </div>
  <hr />
  <div>
    <ImageGrid
      withContentAbove
      withContentBelow
      attachments={attachments}
      i18n={util.i18n}
    />
  </div>
</div>;
```

### Six images

```
const attachments = [
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
  {
    url: util.pngObjectUrl,
    contentType: 'image/png',
    width: 320,
    height: 240,
  },
];

<div>
  <div>
    <ImageGrid attachments={attachments} i18n={util.i18n} />
  </div>
  <hr />
  <div>
    <ImageGrid withContentAbove withContentBelow attachments={attachments} i18n={util.i18n} />
  </div>
</div>;
```
