#### With name and profile

```jsx
<ConversationListItem
  name="Someone 🔥 Somewhere"
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
```

#### Profile, with name, no avatar

```jsx
<ConversationListItem
  phoneNumber="(202) 555-0011"
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
```

#### All types of status

```jsx
<div>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
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
```

#### With unread

```jsx
<div>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
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
    unreadCount={250}
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Hey there!',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</div>
```

#### Selected

```jsx
<ConversationListItem
  phoneNumber="(202) 555-0011"
  isSelected={true}
  lastUpdated={Date.now() - 5 * 60 * 1000}
  lastMessage={{
    text: 'Hey there!',
  }}
  onClick={() => console.log('onClick')}
  i18n={util.i18n}
/>
```

#### With emoji/links in message, no status

We don't want Jumbomoji or links.

```jsx
<div>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: 'Download at http://signal.org',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: '🔥',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</div>
```

#### Long content

We only show one line.

```jsx
<div>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
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
```

#### More narrow

On platforms that show scrollbars all the time, this is true all the time.

```jsx
<div style={{ width: '280px' }}>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
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
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text:
        "Long line. This is a really really really long line. Really really long. Because that's just how it is",
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</div>
```

#### With various ages

```jsx
<div>
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 5 * 60 * 60 * 1000}
    lastMessage={{
      text: 'Five hours ago',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 24 * 60 * 60 * 1000}
    lastMessage={{
      text: 'One day ago',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 7 * 24 * 60 * 60 * 1000}
    lastMessage={{
      text: 'One week ago',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 365 * 24 * 60 * 60 * 1000}
    lastMessage={{
      text: 'One year ago',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</div>
```

#### Missing data

```jsx
<div>
  <ConversationListItem
    name="John"
    lastUpdated={null}
    lastMessage={{
      text: 'Missing last updated',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
  <ConversationListItem
    name="Missing message"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: null,
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
  <ConversationListItem
    phoneNumber="(202) 555-0011"
    lastUpdated={Date.now() - 5 * 60 * 1000}
    lastMessage={{
      text: null,
      status: 'sent',
    }}
    onClick={() => console.log('onClick')}
    i18n={util.i18n}
  />
</div>
```
