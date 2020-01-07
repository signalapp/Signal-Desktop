#### With image

```jsx
const mediaItem = {
  thumbnailObjectUrl: 'https://placekitten.com/76/67',
  contentType: 'image/jpeg',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'image/jpeg',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```

#### With video

```jsx
const mediaItem = {
  thumbnailObjectUrl: 'https://placekitten.com/76/67',
  contentType: 'video/mp4',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'video/mp4',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```

#### Missing image

```jsx
const mediaItem = {
  contentType: 'image/jpeg',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'image/jpeg',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```

#### Missing video

```jsx
const mediaItem = {
  contentType: 'video/mp4',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'video/mp4',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```

#### Image thumbnail failed to load

```jsx
const mediaItem = {
  thumbnailObjectUrl: 'nonexistent',
  contentType: 'image/jpeg',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'image/jpeg',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```

#### Video thumbnail failed to load

```jsx
const mediaItem = {
  thumbnailObjectUrl: 'nonexistent',
  contentType: 'video/mp4',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'video/mp4',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```

#### Other contentType

```jsx
const mediaItem = {
  contentType: 'application/json',
  attachment: {
    fileName: 'foo.jpg',
    contentType: 'application/json',
  },
};
<MediaGridItem i18n={util.i18n} mediaItem={mediaItem} />;
```
