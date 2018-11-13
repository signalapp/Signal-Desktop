### Incoming message

```jsx
<MessageDetail
  message={{
    disableMenu: true,
    direction: 'incoming',
    timestamp: Date.now(),
    authorColor: 'pink',
    text:
      'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    onDelete: () => console.log('onDelete'),
  }}
  sentAt={Date.now() - 2 * 60 * 1000}
  receivedAt={Date.now() - 10 * 1000}
  contacts={[
    {
      phoneNumber: '(202) 555-1001',
      avatarPath: util.gifObjectUrl,
    },
  ]}
  i18n={util.i18n}
/>
```

### Message to group, multiple contacts

```jsx
<MessageDetail
  message={{
    disableMenu: true,
    direction: 'outgoing',
    timestamp: Date.now(),
    authorColor: 'pink',
    text:
      'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    status: 'read',
    onDelete: () => console.log('onDelete'),
  }}
  sentAt={Date.now()}
  contacts={[
    {
      phoneNumber: '(202) 555-1001',
      profileName: 'Mr. Fire',
      avatarPath: util.gifObjectUrl,
      status: 'sending',
    },
    {
      phoneNumber: '(202) 555-1002',
      avatarPath: util.pngObjectUrl,
      status: 'delivered',
    },
    {
      phoneNumber: '(202) 555-1003',
      color: 'teal',
      status: 'read',
    },
  ]}
  i18n={util.i18n}
/>
```

### 1:1 conversation, just one recipient

```jsx
<MessageDetail
  message={{
    disableMenu: true,
    direction: 'outgoing',
    timestamp: Date.now(),
    authorColor: 'pink',
    text:
      'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    status: 'sending',
    onDelete: () => console.log('onDelete'),
  }}
  contacts={[
    {
      phoneNumber: '(202) 555-1001',
      avatarPath: util.gifObjectUrl,
      status: 'sending',
    },
  ]}
  sentAt={Date.now()}
  i18n={util.i18n}
/>
```

### Errors for some users, including on OutgoingKeyError

```jsx
<MessageDetail
  message={{
    disableMenu: true,
    direction: 'outgoing',
    timestamp: Date.now(),
    authorColor: 'pink',
    text:
      'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    status: 'error',
    onDelete: () => console.log('onDelete'),
  }}
  contacts={[
    {
      phoneNumber: '(202) 555-1001',
      avatarPath: util.gifObjectUrl,
      status: 'error',
      errors: [new Error('Something went wrong'), new Error('Bad things')],
    },
    {
      phoneNumber: '(202) 555-1002',
      avatarPath: util.pngObjectUrl,
      status: 'error',
      isOutgoingKeyError: true,
      errors: [new Error(util.i18n('newIdentity'))],
      onShowSafetyNumber: () => console.log('onShowSafetyNumber'),
      onSendAnyway: () => console.log('onSendAnyway'),
    },
    {
      phoneNumber: '(202) 555-1003',
      color: 'teal',
      status: 'read',
    },
  ]}
  sentAt={Date.now()}
  i18n={util.i18n}
/>
```

### Unidentified Delivery

```jsx
<MessageDetail
  message={{
    disableMenu: true,
    direction: 'outgoing',
    timestamp: Date.now(),
    conversationColor: 'pink',
    text:
      'Hello there from the new world! And this is multiple lines of text. Lines and lines and lines.',
    status: 'read',
    onDelete: () => console.log('onDelete'),
  }}
  contacts={[
    {
      phoneNumber: '(202) 555-1001',
      avatarPath: util.gifObjectUrl,
      status: 'read',
      isUnidentifiedDelivery: true,
    },
    {
      phoneNumber: '(202) 555-1002',
      avatarPath: util.pngObjectUrl,
      status: 'delivered',
      isUnidentifiedDelivery: true,
    },
    {
      phoneNumber: '(202) 555-1003',
      color: 'teal',
      status: 'read',
    },
  ]}
  sentAt={Date.now()}
  i18n={util.i18n}
/>
```
