#### With name and profile

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    name="Someone 🔥 Somewhere"
    conversationType={'direct'}
    phoneNumber="(202) 555-0011"
    avatarPath={util.gifObjectUrl}
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: "What's going on?",
      status: 'sent',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Profile, with name, no avatar

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    conversationType={'direct'}
    name="Mr. Fire🔥"
    color="green"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Just a second',
      status: 'read',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### All types of status

```jsx
<util.LeftPaneContext theme={util.theme}>
  <div>
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Sending',
        status: 'sending',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Sent',
        status: 'sent',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Delivered',
        status: 'delivered',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Read',
        status: 'read',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Mr. Fire🔥"
      color="green"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Error',
        status: 'error',
      }}
      onClick={() => console.log('onClick')}
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
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={4}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      isTyping={true}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
  </div>
  <div>
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={4}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      isTyping={true}
      lastMessage={{
        status: 'read',
      }}
      onClick={() => console.log('onClick')}
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
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={4}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Hey there!',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={10}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Hey there!',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      unreadCount={250}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Hey there!',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```

#### Selected

```jsx
<util.LeftPaneContext theme={util.theme}>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    conversationType={'direct'}
    isSelected={true}
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Hey there!',
    }}
    onClick={() => console.log('onClick')}
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
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Download at http://signal.org',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: '🔥',
      }}
      onClick={() => console.log('onClick')}
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
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Long contact name. Esquire. The third. And stuff. And more! And more!"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Normal message',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
        status: 'read',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />

    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      unreadCount={8}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Many lines. This is a many-line message.\nLine 2 is really exciting but it shouldn't be seen.\nLine three is even better.\nLine 4, well.",
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Many lines. This is a many-line message.\nLine 2 is really exciting but it shouldn't be seen.\nLine three is even better.\nLine 4, well.",
        status: 'delivered',
      }}
      onClick={() => console.log('onClick')}
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
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      name="Long contact name. Esquire. The third. And stuff. And more! And more!"
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: 'Normal message',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text:
          "Long line. This is a really really really long line. Really really long. Because that's just how it is",
      }}
      onClick={() => console.log('onClick')}
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
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 60 * 1000}
      lastMessage={{
        text: 'Five hours ago',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 24 * 60 * 60 * 1000}
      lastMessage={{
        text: 'One day ago',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 7 * 24 * 60 * 60 * 1000}
      lastMessage={{
        text: 'One week ago',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 365 * 24 * 60 * 60 * 1000}
      lastMessage={{
        text: 'One year ago',
      }}
      onClick={() => console.log('onClick')}
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
      name="John"
      conversationType={'direct'}
      lastUpdated={null}
      lastMessage={{
        text: 'Missing last updated',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      name="Missing message"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: null,
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
    <ConversationListItem
      phoneNumber="(202) 555-0011"
      conversationType={'direct'}
      lastUpdated={Date.now() - 5 * 60 * 1000}
      lastMessage={{
        text: null,
        status: 'sent',
      }}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
  </div>
</util.LeftPaneContext>
```
