#### With image

```jsx
const message = {
  id: '1',
  thumbnailObjectUrl: 'https://placekitten.com/76/67',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'image/jpeg',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

#### With video

```jsx
const message = {
  id: '1',
  thumbnailObjectUrl: 'https://placekitten.com/76/67',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'video/mp4',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

#### Missing image

```jsx
const message = {
  id: '1',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'image/jpeg',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

#### Missing video

```jsx
const message = {
  id: '1',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'video/mp4',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

#### Image thumbnail failed to load

```jsx
const message = {
  id: '1',
  thumbnailObjectUrl: 'nonexistent',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'image/jpeg',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

#### Video thumbnail failed to load

```jsx
const message = {
  id: '1',
  thumbnailObjectUrl: 'nonexistent',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'video/mp4',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

#### Other contentType

```jsx
const message = {
  id: '1',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'application/json',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```
