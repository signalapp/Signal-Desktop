```javascript
const itemLookup = {
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
      direction: 'incoming',
      timestamp: Date.now(),
      authorColor: 'green',
      text: 'Hello there from the new world! http://somewhere.com',
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

const actions = {
  downloadAttachment: options => console.log('onDownload', options),
  replyToitem: id => console.log('onReply', id),
  showMessageDetail: id => console.log('onShowDetail', id),
  deleteMessage: id => console.log('onDelete', id),
};

const items = util._.keys(itemLookup);
const renderItem = id => {
  const item = itemLookup[id];

  // Because we can't use ...item syntax
  return React.createElement(
    TimelineItem,
    util._.merge({ item, i18n: util.i18n }, actions)
  );
};

<div style={{ height: '300px' }}>
  <Timeline items={items} renderItem={renderItem} i18n={util.i18n} />
</div>;
```
