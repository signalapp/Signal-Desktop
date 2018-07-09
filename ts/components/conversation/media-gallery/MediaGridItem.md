## With image

```jsx
const message = {
  id: '1',
  objectURL: 'https://placekitten.com/76/67',
  attachments: [
    {
      fileName: 'foo.jpg',
      contentType: 'application/json',
    },
  ],
};
<MediaGridItem i18n={util.i18n} message={message} />;
```

## Without image

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
