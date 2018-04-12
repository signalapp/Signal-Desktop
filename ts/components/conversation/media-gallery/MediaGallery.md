```jsx
const YEAR_MS = 1 * 12 * 30 * 24 * 60 * 60 * 1000;
const tokens = ['foo', 'bar', 'baz', 'qux', 'quux'];
const fileExtensions = ['docx', 'pdf', 'txt', 'mp3', 'wmv', 'tiff'];
const createRandomMessage = (props) => {
  const now = Date.now();
  const fileName =
    `${_.sample(tokens)}${_.sample(tokens)}.${_.sample(fileExtensions)}`;
  return {
    id: _.random(now).toString(),
    received_at: _.random(now - YEAR_MS, now),
    attachments: [{
      fileName,
      data: null,
    }],

    // TODO: Revisit
    imageUrl: 'https://placekitten.com/94/94',
    ...props,
  };
};

const startTime = Date.now();
const messages = _.sortBy(
  _.range(30).map(createRandomMessage),
  message => -message.received_at
);

<MediaGallery
  i18n={(key) => key}
  messages={messages}
/>
```
