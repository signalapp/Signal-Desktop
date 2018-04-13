```jsx
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 12 * MONTH_MS;
const tokens = ['foo', 'bar', 'baz', 'qux', 'quux'];
const fileExtensions = ['docx', 'pdf', 'txt', 'mp3', 'wmv', 'tiff'];
const createRandomMessage = ({startTime, timeWindow} = {}) => (props) => {
  const now = Date.now();
  const fileName =
    `${_.sample(tokens)}${_.sample(tokens)}.${_.sample(fileExtensions)}`;
  return {
    id: _.random(now).toString(),
    received_at: _.random(startTime, startTime + timeWindow),
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

const createRandomMessages = ({startTime, timeWindow}) =>
  _.range(_.random(5, 10)).map(createRandomMessage({startTime, timeWindow}));


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

<MediaGallery
  i18n={window.i18n}
  media={messages}
  documents={messages}
/>
```
