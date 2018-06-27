### With a contact

#### Including all data types

```jsx
const contacts = [
  {
    name: {
      displayName: 'Someone Somewhere',
    },
    number: [
      {
        value: '(202) 555-0000',
        type: 1,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
</util.ConversationContext>;
```

#### Really long long data

```
const contacts = [
  {
    name: {
      displayName: 'Dr. First Middle Last Junior Senior and all that and a bag of chips',
    },
    number: [
      {
        value: '(202) 555-0000 0000 0000 0000 0000 0000 0000 0000 0000 0000',
        type: 1,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
</util.ConversationContext>;
```

#### In group conversation

```jsx
const contacts = [
  {
    name: {
      displayName: 'Someone Somewhere',
    },
    number: [
      {
        value: '(202) 555-0000',
        type: 1,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme} type="group">
  <Message
    color="green"
    conversationType="group"
    authorName="Mr. Fire"
    authorAvatarPath={util.gifObjectUrl}
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    color="green"
    direction="incoming"
    authorName="Mr. Fire"
    conversationType="group"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    direction="outgoing"
    conversationType="group"
    authorName="Mr. Fire"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    contactHasSignalAccount
    onClickContact={() => console.log('onClickContact')}
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
</util.ConversationContext>;
```

#### If contact has no signal account

```jsx
const contacts = [
  {
    name: {
      displayName: 'Someone Somewhere',
    },
    number: [
      {
        value: '(202) 555-0000',
        type: 1,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
</util.ConversationContext>;
```

#### With organization name instead of name

```jsx
const contacts = [
  {
    organization: 'United Somewheres, Inc.',
    email: [
      {
        value: 'someone@somewheres.com',
        type: 2,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
</util.ConversationContext>;
```

#### No displayName or organization

```jsx
const contacts = [
  {
    name: {
      givenName: 'Someone',
    },
    number: [
      {
        value: '+12025551000',
        type: 1,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
</util.ConversationContext>;
```

#### Default avatar

```jsx
const contacts = [
  {
    name: {
      displayName: 'Someone Somewhere',
    },
    number: [
      {
        value: util.CONTACTS[0].id,
        type: 1,
      },
    ],
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
</util.ConversationContext>;
```

#### Empty contact

```jsx
const contacts = [{}];
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
</util.ConversationContext>;
```

#### Contact with caption (cannot currently be sent)

```jsx
const contacts = [
  {
    name: {
      displayName: 'Someone Somewhere',
    },
    number: [
      {
        value: '(202) 555-0000',
        type: 1,
      },
    ],
    avatar: {
      avatar: {
        path: util.gifObjectUrl,
      },
    },
  },
];
<util.ConversationContext theme={util.theme}>
  <Message
    text="I want to introduce you to Someone..."
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    color="green"
    direction="incoming"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
    contactHasSignalAccount
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
    contactHasSignalAccount
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
    contactHasSignalAccount
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
  <Message
    text="I want to introduce you to Someone..."
    direction="outgoing"
    collapseMetadata
    status="delivered"
    i18n={util.i18n}
    contacts={contacts}
    onClickContact={() => console.log('onClickContact')}
    contactHasSignalAccount
    onSendMessageToContact={() => console.log('onSendMessageToContact')}
  />
</util.ConversationContext>;
```
