## With oldest and newest

```jsx
window.itemLookup = {
  'id-1': {
    type: 'message',
    data: {
      id: 'id-1',
      direction: 'incoming',
      timestamp: Date.now(),
      authorPhoneNumber: '(202) 555-2001',
      authorColor: 'green',
      text: '🔥',
    },
  },
  'id-2': {
    type: 'message',
    data: {
      id: 'id-2',
      conversationType: 'group',
      direction: 'incoming',
      timestamp: Date.now(),
      authorColor: 'green',
      text: 'Hello there from the new world! http://somewhere.com',
    },
  },
  'id-2.5': {
    type: 'unsupportedMessage',
    data: {
      id: 'id-2.5',
      canProcessNow: false,
      contact: {
        phoneNumber: '(202) 555-1000',
        profileName: 'Mr. Pig',
      },
    },
  },
  'id-3': {
    type: 'message',
    data: {
      id: 'id-3',
      collapseMetadata: true,
      direction: 'incoming',
      timestamp: Date.now(),
      authorColor: 'red',
      text: 'Hello there from the new world!',
    },
  },
  'id-4': {
    type: 'timerNotification',
    data: {
      type: 'fromMe',
      timespan: '5 minutes',
    },
  },
  'id-5': {
    type: 'timerNotification',
    data: {
      type: 'fromOther',
      phoneNumber: '(202) 555-0000',
      timespan: '1 hour',
    },
  },
  'id-6': {
    type: 'safetyNumberNotification',
    data: {
      contact: {
        id: '+1202555000',
        phoneNumber: '(202) 555-0000',
        profileName: 'Mr. Fire',
      },
    },
  },
  'id-7': {
    type: 'verificationNotification',
    data: {
      contact: {
        phoneNumber: '(202) 555-0001',
        name: 'Mrs. Ice',
      },
      isLocal: true,
      type: 'markVerified',
    },
  },
  'id-8': {
    type: 'groupNotification',
    data: {
      changes: [
        {
          type: 'name',
          newName: 'Squirrels and their uses',
        },
        {
          type: 'add',
          contacts: [
            {
              phoneNumber: '(202) 555-0002',
            },
            {
              phoneNumber: '(202) 555-0003',
              profileName: 'Ms. Water',
            },
          ],
        },
      ],
      isMe: false,
    },
  },
  'id-9': {
    type: 'resetSessionNotification',
    data: null,
  },
  'id-10': {
    type: 'message',
    data: {
      id: 'id-6',
      direction: 'outgoing',
      timestamp: Date.now(),
      status: 'sent',
      authorColor: 'pink',
      text: '🔥',
    },
  },
  'id-11': {
    type: 'message',
    data: {
      id: 'id-7',
      direction: 'outgoing',
      timestamp: Date.now(),
      status: 'read',
      authorColor: 'pink',
      text: 'Hello there from the new world! http://somewhere.com',
    },
  },
  'id-12': {
    type: 'message',
    data: {
      id: 'id-8',
      collapseMetadata: true,
      direction: 'outgoing',
      status: 'sent',
      timestamp: Date.now(),
      text: 'Hello there from the new world! 🔥',
    },
  },
  'id-13': {
    type: 'message',
    data: {
      id: 'id-9',
      direction: 'outgoing',
      status: 'sent',
      timestamp: Date.now(),
      authorColor: 'blue',
      text:
        'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    },
  },
  'id-14': {
    type: 'message',
    data: {
      id: 'id-10',
      direction: 'outgoing',
      status: 'read',
      timestamp: Date.now(),
      collapseMetadata: true,
      text:
        'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    },
  },
};

window.actions = {
  // For messages
  downloadAttachment: options => console.log('onDownload', options),
  replyToitem: id => console.log('onReply', id),
  showMessageDetail: id => console.log('onShowDetail', id),
  deleteMessage: id => console.log('onDelete', id),
  downloadNewVersion: () => console.log('downloadNewVersion'),

  // For Timeline
  clearChangedMessages: (...args) => console.log('clearChangedMessages', args),
  setLoadCountdownStart: (...args) =>
    console.log('setLoadCountdownStart', args),

  loadAndScroll: (...args) => console.log('loadAndScroll', args),
  loadOlderMessages: (...args) => console.log('loadOlderMessages', args),
  loadNewerMessages: (...args) => console.log('loadNewerMessages', args),
  loadNewestMessages: (...args) => console.log('loadNewestMessages', args),
  markMessageRead: (...args) => console.log('markMessageRead', args),
};

const props = {
  id: 'conversationId-1',
  haveNewest: true,
  haveOldest: true,
  isLoadingMessages: false,
  items: util._.keys(window.itemLookup),
  messagesHaveChanged: false,
  oldestUnreadIndex: null,
  resetCounter: 0,
  scrollToIndex: null,
  scrollToIndexCounter: 0,
  totalUnread: 0,

  renderItem: id => (
    <TimelineItem item={window.itemLookup[id]} i18n={util.i18n} {...actions} />
  ),
};

<div style={{ height: '300px' }}>
  <Timeline {...props} {...window.actions} i18n={util.i18n} />
</div>;
```

## With last seen indicator

```
const props = {
  id: 'conversationId-1',
  haveNewest: true,
  haveOldest: true,
  isLoadingMessages: false,
  items: util._.keys(window.itemLookup),
  messagesHaveChanged: false,
  oldestUnreadIndex: 2,
  resetCounter: 0,
  scrollToIndex: null,
  scrollToIndexCounter: 0,
  totalUnread: 2,

  renderItem: id => (
    <TimelineItem item={window.itemLookup[id]} i18n={util.i18n} {...actions} />
  ),
  renderLastSeenIndicator: () => (
    <LastSeenIndicator count={2} i18n={util.i18n} />
  ),
};

<div style={{ height: '300px' }}>
  <Timeline {...props} {...window.actions} i18n={util.i18n} />
</div>;
```

## With target index = 0

```
const props = {
  id: 'conversationId-1',
  haveNewest: true,
  haveOldest: true,
  isLoadingMessages: false,
  items: util._.keys(window.itemLookup),
  messagesHaveChanged: false,
  oldestUnreadIndex: null,
  resetCounter: 0,
  scrollToIndex: 0,
  scrollToIndexCounter: 0,
  totalUnread: 0,

  renderItem: id => (
    <TimelineItem item={window.itemLookup[id]} i18n={util.i18n} {...actions} />
  ),
};

<div style={{ height: '300px' }}>
  <Timeline {...props} {...window.actions} i18n={util.i18n} />
</div>;
```

## With typing indicator

```
const props = {
  id: 'conversationId-1',
  haveNewest: true,
  haveOldest: true,
  isLoadingMessages: false,
  items: util._.keys(window.itemLookup),
  messagesHaveChanged: false,
  oldestUnreadIndex: null,
  resetCounter: 0,
  scrollToIndex: null,
  scrollToIndexCounter: 0,
  totalUnread: 0,

  typingContact: true,

  renderItem: id => (
    <TimelineItem item={window.itemLookup[id]} i18n={util.i18n} {...actions} />
  ),
  renderTypingBubble: () => (
    <TypingBubble color="red" conversationType="direct" phoneNumber="+18005552222" i18n={util.i18n} />
  ),
};

<div style={{ height: '300px' }}>
  <Timeline {...props} {...window.actions} i18n={util.i18n} />
</div>;
```

## Without newest message

```
const props = {
  id: 'conversationId-1',
  haveNewest: false,
  haveOldest: true,
  isLoadingMessages: false,
  items: util._.keys(window.itemLookup),
  messagesHaveChanged: false,
  oldestUnreadIndex: null,
  resetCounter: 0,
  scrollToIndex: 3,
  scrollToIndexCounter: 0,
  totalUnread: 0,

  renderItem: id => (
    <TimelineItem item={window.itemLookup[id]} i18n={util.i18n} {...actions} />
  ),
};

<div style={{ height: '300px' }}>
  <Timeline {...props} {...window.actions} i18n={util.i18n} />
</div>;
```

## Without oldest message

```
const props = {
  id: 'conversationId-1',
  haveNewest: true,
  haveOldest: false,
  isLoadingMessages: false,
  items: util._.keys(window.itemLookup),
  messagesHaveChanged: false,
  oldestUnreadIndex: null,
  resetCounter: 0,
  scrollToIndex: null,
  scrollToIndexCounter: 0,
  totalUnread: 0,

  renderItem: id => (
    <TimelineItem item={window.itemLookup[id]} i18n={util.i18n} {...actions} />
  ),
  renderLoadingRow: () => (
    <TimelineLoadingRow state="idle" />
  ),
};

<div style={{ height: '300px' }}>
  <Timeline {...props} {...window.actions} i18n={util.i18n} />
</div>;
```
