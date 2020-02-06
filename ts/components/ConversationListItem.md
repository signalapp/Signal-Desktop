#### With name and profile

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    id="conversationId1"
    name="Someone 🔥 Somewhere"
    conversationType={'direct'}
    phoneNumber="(202) 555-0011"
    avatarPath={util.gifObjectUrl}
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: "What's going on?",
      status: 'sent',
    }}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Profile, with name, no avatar

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    id="conversationId1"
    phoneNumber="(202) 555-0011"
    conversationType={'direct'}
    name="Mr. Fire🔥"
    color="green"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Just a second',
      status: 'read',
    }}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Conversation with yourself

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    id="conversationId1"
    isMe={true}
    phoneNumber="(202) 555-0011"
    conversationType={'direct'}
    name="Mr. Fire🔥"
    color="green"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Just a second',
      status: 'read',
    }}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### All types of status

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Sending',
        status: 'sending',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Sent',
        status: 'sent',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId3"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Delivered',
        status: 'delivered',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId4"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Read',
        status: 'read',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId5"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Error',
        status: 'error',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### Is typing

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={4}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      isTyping={true}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
  <div>
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={4}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      isTyping={true}
      lastMessage={{
        status: 'read',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### Selected

#### With unread

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={4}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Hey there!',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={10}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Hey there!',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId3"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={250}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Hey there!',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### Selected

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    id="conversationId1"
    phoneNumber="(202) 555-0011"
    conversationType={'direct'}
    isSelected={true}
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Hey there!',
    }}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### With emoji/links in message, no status

We don't want Jumbomoji or links.

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Download at http://getsession.org',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: '🔥',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### Long content

We only show one line.

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Long contact name. Esquire. The third. And stuff. And more! And more!"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Normal message',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId3"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
        status: 'read',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />

    <ConversationListItem
      id="conversationId4"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      unreadCount={8}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId5"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Many lines. This is a many-line message.\nLine 2 is really exciting but it shouldn't be seen.\nLine three is even better.\nLine 4, well.",
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId6"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Many lines. This is a many-line message.\nLine 2 is really exciting but it shouldn't be seen.\nLine three is even better.\nLine 4, well.",
        status: 'delivered',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### More narrow

On platforms that show scrollbars all the time, this is true all the time.

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div style={{ width: '280px' }}>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Long contact name. Esquire. The third. And stuff. And more! And more!"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Normal message',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### With various ages

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 60 * 1000}
      lastMessage={{
        text: 'Five hours ago',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 24 * 60 * 60 * 1000}
      lastMessage={{
        text: 'One day ago',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId3"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 7 * 24 * 60 * 60 * 1000}
      lastMessage={{
        text: 'One week ago',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId4"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 365 * 24 * 60 * 60 * 1000}
      lastMessage={{
        text: 'One year ago',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### Missing data

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      id="conversationId1"
      name="John"
      conversationType={'direct'}
      lastUpdated={null}
      lastMessage={{
        text: 'Missing last updated',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId2"
      name="Missing message"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: null,
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
    <ConversationListItem
      id="conversationId3"
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: null,
        status: 'sent',
      }}
      onClick={result => console.log('onClick', result)}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```
