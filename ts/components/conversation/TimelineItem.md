### A plain message

```jsx
const item = {
  type: 'message',
  data: {
    id: 'id-1',
    direction: 'incoming',
    timestamp: Date.now(),
    authorPhoneNumber: '(202) 555-2001',
    authorColor: 'green',
    text: '🔥',
  },
};

<TimelineItem item={item} i18n={util.i18n} />;
```

### A notification

```jsx
const item = {
  type: 'timerNotification',
  data: {
    type: 'fromOther',
    phoneNumber: '(202) 555-0000',
    timespan: '1 hour',
  },
};

<TimelineItem item={item} i18n={util.i18n} />;
```

### Unknown type

```jsx
const item = {
  type: 'random',
  data: {
    somethin: 'somethin',
  },
};

<TimelineItem item={item} i18n={util.i18n} />;
```

### Missing itme

```jsx
<TimelineItem item={null} i18n={util.i18n} />
```
