```jsx
const messages = [
  {
    attachments: [
      {
        fileName: 'foo.json',
        contentType: 'application/json',
        size: 53313,
      },
    ],
  },
  {
    attachments: [
      {
        fileName: 'bar.txt',
        contentType: 'text/plain',
        size: 10323,
      },
    ],
  },
];

<AttachmentSection header="Today" type="documents" messages={messages} />;
```
