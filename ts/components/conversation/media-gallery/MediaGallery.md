### Empty states for missing media and documents

```
<div style={{width: '100%', height: 300}}>
  <MediaGallery
    i18n={window.i18n}
    media={[]}
    documents={[]}
    i18n={util.i18n}
  />
</div>
```

### Media gallery with media and documents

```jsx
const _ = util._;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 12 * MONTH_MS;
const tokens = ['foo', 'bar', 'baz', 'qux', 'quux'];
const fileExtensions = ['docx', 'pdf', 'txt', 'mp3', 'wmv', 'tiff'];
const createRandomMessage = ({ startTime, timeWindow } = {}) => props => {
  const now = Date.now();
  const fileName = `${_.sample(tokens)}${_.sample(tokens)}.${_.sample(
    fileExtensions
  )}`;
  return {
    id: _.random(now).toString(),
    received_at: _.random(startTime, startTime + timeWindow),
    attachments: [
      {
        data: null,
        fileName,
        size: _.random(1000, 1000 * 1000 * 50),
        contentType: 'image/jpeg',
      },
    ],

    thumbnailObjectUrl: `https://placekitten.com/${_.random(
      50,
      150
    )}/${_.random(50, 150)}`,
    ...props,
  };
};

const createRandomMessages = ({ startTime, timeWindow }) =>
  _.range(_.random(5, 10)).map(createRandomMessage({ startTime, timeWindow }));

const startTime = Date.now();
const messages = _.sortBy(
  [
    ...createRandomMessages({
      startTime,
      timeWindow: DAY_MS,
    }),
    ...createRandomMessages({
      startTime: startTime - DAY_MS,
      timeWindow: DAY_MS,
    }),
    ...createRandomMessages({
      startTime: startTime - 3 * DAY_MS,
      timeWindow: 3 * DAY_MS,
    }),
    ...createRandomMessages({
      startTime: startTime - 30 * DAY_MS,
      timeWindow: 15 * DAY_MS,
    }),
    ...createRandomMessages({
      startTime: startTime - 365 * DAY_MS,
      timeWindow: 300 * DAY_MS,
    }),
  ],
  message => -message.received_at
);

<MediaGallery i18n={util.i18n} media={messages} documents={messages} />;
```

## Media gallery with one document

```jsx
const messages = [
  {
    id: '1',
    thumbnailObjectUrl: 'https://placekitten.com/76/67',
    attachments: [
      {
        fileName: 'foo.jpg',
        contentType: 'image/jpeg',
      },
    ],
  },
];
<MediaGallery i18n={util.i18n} media={messages} documents={messages} />;
```
