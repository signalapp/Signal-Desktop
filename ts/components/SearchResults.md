#### With all result types

```jsx
window.searchResults = {};
window.searchResults.conversations = [
  {
    name: 'Everyone 🌆',
    conversationType: 'group',
    phoneNumber: '(202) 555-0011',
    avatarPath: util.landscapeGreenObjectUrl,
    lastUpdated: Date.now() - 5 * 60 * 1000,
    lastMessage: {
      text: 'The rabbit hopped silently in the night.',
      status: 'sent',
    },
  },
  {
    name: 'Everyone Else 🔥',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0012',
    avatarPath: util.landscapePurpleObjectUrl,
    lastUpdated: Date.now() - 5 * 60 * 1000,
    lastMessage: {
      text: "What's going on?",
      status: 'sent',
    },
  },
];

window.searchResults.contacts = [
  {
    name: 'The one Everyone',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0013',
    avatarPath: util.gifObjectUrl,
  },
  {
    name: 'No likey everyone',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0014',
    color: 'red',
  },
];

window.searchResults.messages = [
  {
    from: {
      isMe: true,
      avatarPath: util.gifObjectUrl,
    },
    to: {
      name: 'Mr. Fire 🔥',
      phoneNumber: '(202) 555-0015',
    },
    id: '1-guid-guid-guid-guid-guid',
    conversationId: '(202) 555-0015',
    receivedAt: Date.now() - 5 * 60 * 1000,
    snippet: '<<left>>Everyone<<right>>! Get in!',
    onClick: () => console.log('onClick'),
  },
  {
    from: {
      name: 'Jon ❄️',
      phoneNumber: '(202) 555-0016',
      color: 'green',
    },
    to: {
      isMe: true,
    },
    id: '2-guid-guid-guid-guid-guid',
    conversationId: '(202) 555-0016',
    snippet: 'Why is <<left>>everyone<<right>> so frustrated?',
    receivedAt: Date.now() - 20 * 60 * 1000,
    onClick: () => console.log('onClick'),
  },
  {
    from: {
      name: 'Someone',
      phoneNumber: '(202) 555-0011',
      color: 'green',
      avatarPath: util.pngObjectUrl,
    },
    to: {
      name: "Y'all 🌆",
    },
    id: '3-guid-guid-guid-guid-guid',
    conversationId: 'EveryoneGroupID',
    snippet: 'Hello, <<left>>everyone<<right>>! Woohooo!',
    receivedAt: Date.now() - 24 * 60 * 1000,
    onClick: () => console.log('onClick'),
  },
  {
    from: {
      isMe: true,
      avatarPath: util.gifObjectUrl,
    },
    to: {
      name: "Y'all 🌆",
    },
    id: '4-guid-guid-guid-guid-guid',
    conversationId: 'EveryoneGroupID',
    snippet: 'Well, <<left>>everyone<<right>>, happy new year!',
    receivedAt: Date.now() - 24 * 60 * 1000,
    onClick: () => console.log('onClick'),
  },
];

<util.LeftPaneContext theme={util.theme}>
  <SearchResults
    conversations={window.searchResults.conversations}
    contacts={window.searchResults.contacts}
    messages={window.searchResults.messages}
    i18n={util.i18n}
    onClickMessage={id => console.log('onClickMessage', id)}
    onClickConversation={id => console.log('onClickConversation', id)}
    onStartNewConversation={(query, options) =>
      console.log('onStartNewConversation', query, options)
    }
  />
</util.LeftPaneContext>;
```

#### With 'start new conversation'

```jsx
<util.LeftPaneContext theme={util.theme}>
  <SearchResults
    conversations={window.searchResults.conversations}
    contacts={window.searchResults.contacts}
    messages={window.searchResults.messages}
    showStartNewConversation={true}
    searchTerm="(555) 100-2000"
    i18n={util.i18n}
    onClickMessage={id => console.log('onClickMessage', id)}
    onClickConversation={id => console.log('onClickConversation', id)}
    onStartNewConversation={(query, options) =>
      console.log('onStartNewConversation', query, options)
    }
  />
</util.LeftPaneContext>
```

#### With no conversations

```jsx
<util.LeftPaneContext theme={util.theme}>
  <SearchResults
    conversations={null}
    contacts={window.searchResults.contacts}
    messages={window.searchResults.messages}
    i18n={util.i18n}
    onClickMessage={id => console.log('onClickMessage', id)}
    onClickConversation={id => console.log('onClickConversation', id)}
    onStartNewConversation={(query, options) =>
      console.log('onStartNewConversation', query, options)
    }
  />
</util.LeftPaneContext>
```

#### With no contacts

```jsx
<util.LeftPaneContext theme={util.theme}>
  <SearchResults
    conversations={window.searchResults.conversations}
    contacts={null}
    messages={window.searchResults.messages}
    i18n={util.i18n}
    onClickMessage={id => console.log('onClickMessage', id)}
    onClickConversation={id => console.log('onClickConversation', id)}
    onStartNewConversation={(query, options) =>
      console.log('onStartNewConversation', query, options)
    }
  />
</util.LeftPaneContext>
```

#### With no messages

```jsx
<util.LeftPaneContext theme={util.theme}>
  <SearchResults
    conversations={window.searchResults.conversations}
    contacts={window.searchResults.contacts}
    messages={null}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### With no results at all

```jsx
<util.LeftPaneContext theme={util.theme}>
  <SearchResults
    conversations={null}
    contacts={null}
    messages={null}
    searchTerm="dinner plans"
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### With a lot of results

```jsx
const messages = [];
for (let i = 0; i < 100; i += 1) {
  messages.push({
    from: {
      name: 'Mr. Fire 🔥',
      phoneNumber: '(202) 555-0015',
      avatarPath: util.landscapeGreenObjectUrl,
    },
    to: {
      isMe: true,
    },
    id: `${i}-guid-guid-guid-guid-guid`,
    conversationId: '(202) 555-0015',
    receivedAt: Date.now() - 5 * 60 * 1000,
    snippet: `${i} <<left>>Everyone<<right>>! Get in!`,
    onClick: data => console.log('onClick', data),
  });
}

<util.LeftPaneContext style={{ height: '500px' }} theme={util.theme}>
  <SearchResults
    conversations={null}
    contacts={null}
    messages={messages}
    i18n={util.i18n}
  />
</util.LeftPaneContext>;
```

#### With just messages and no header

```jsx
const messages = [];
for (let i = 0; i < 10; i += 1) {
  messages.push({
    from: {
      name: 'Mr. Fire 🔥',
      phoneNumber: '(202) 555-0015',
      avatarPath: util.landscapeGreenObjectUrl,
    },
    to: {
      isMe: true,
    },
    id: `${i}-guid-guid-guid-guid-guid`,
    conversationId: '(202) 555-0015',
    receivedAt: Date.now() - 5 * 60 * 1000,
    snippet: `${i} <<left>>Everyone<<right>>! Get in!`,
    onClick: data => console.log('onClick', data),
  });
}

<util.LeftPaneContext style={{ height: '500px' }} theme={util.theme}>
  <SearchResults
    hideMessagesHeader={true}
    messages={messages}
    i18n={util.i18n}
  />
</util.LeftPaneContext>;
```
