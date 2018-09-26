### With a contact

#### Including all data types

```jsx
const contact = {
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
  onClick: () => console.log('onClick'),
  onSendMessage: () => console.log('onSendMessage'),
  hasSignalAccount: true,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### Really long data

```
const contact = {
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
  hasSignalAccount: true,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
    conversationColor="green"
    direction="incoming"
    i18n={util.i18n}
    timestamp={Date.now()}
    contact={contact}/>
  </li>
  <li>
  <Message
    conversationColor="green"
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    timestamp={Date.now()}
    contact={contact}/>
  </li>
</util.ConversationContext>;
```

#### In group conversation

```jsx
const contact = {
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
  hasSignalAccount: true,
};
<util.ConversationContext theme={util.theme} type="group">
  <li>
    <Message
      conversationColor="green"
      conversationType="group"
      authorName="Mr. Fire"
      authorAvatarPath={util.gifObjectUrl}
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      authorName="Mr. Fire"
      conversationType="group"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      conversationType="group"
      authorName="Mr. Fire"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### If contact has no signal account

```jsx
const contact = {
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
  hasSignalAccount: false,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### With organization name instead of name

```jsx
const contact = {
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
  hasSignalAccount: false,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### No displayName or organization

```jsx
const contact = {
  name: {
    givenName: 'Someone',
  },
  number: [
    {
      value: '(202) 555-1000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  hasSignalAccount: false,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### Default avatar

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-1001',
      type: 1,
    },
  ],
  hasSignalAccount: true,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### Empty contact

```jsx
const contact = {};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
  <li>
    <Message
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
    />
  </li>
</util.ConversationContext>;
```

#### Contact with caption (cannot currently be sent)

```jsx
const contactWithAccount = {
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
  hasSignalAccount: true,
};
const contactWithoutAccount = {
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
  hasSignalAccount: false,
};
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
    />
  </li>
  <li>
    <Message
      text="I want to introduce you to Someone..."
      conversationColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
    />
  </li>
</util.ConversationContext>;
```
