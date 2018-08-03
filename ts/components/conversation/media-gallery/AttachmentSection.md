```jsx
const messages = [
  {
    id: '1',
    attachments: [
      {
        fileName: 'foo.json',
        contentType: 'application/json',
        size: 53313,
      },
    ],
  },
  {
    id: '2',
    attachments: [
      {
        fileName: 'bar.txt',
        contentType: 'text/plain',
        size: 10323,
      },
    ],
  },
];

<AttachmentSection
  header="Today"
  type="documents"
  messages={messages}
  i18n={util.i18n}
/>;
```
