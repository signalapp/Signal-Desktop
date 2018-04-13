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
      data: null,
      fileName,
      size: _.random(1000, 1000 * 1000 * 50),
    }],

    // TODO: Revisit
    objectURL: `https://placekitten.com/${_.random(50, 150)}/${_.random(50, 150)}`,
    ...props,
  };
};

const startTime = Date.now();
const messages = _.sortBy(
  _.range(25).map(createRandomMessage),
  message => -message.received_at
);

<MediaGallery
  i18n={window.i18n}
  media={messages}
  documents={messages}
/>
```
