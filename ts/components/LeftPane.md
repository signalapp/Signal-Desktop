#### With search results

```jsx
window.searchResults = {};
window.searchResults.conversations = [
  {
    id: 'convo1',
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
    id: 'convo2',
    name: 'Everyone Else 🔥',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0012',
    avatarPath: util.landscapePurpleObjectUrl,
    lastUpdated: Date.now() - 5 * 60 * 1000,
    lastMessage: {
      text: "What's going on?",
      status: 'error',
    },
  },
  {
    id: 'convo3',
    name: 'John the Turtle',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0021',
    lastUpdated: Date.now() - 24 * 60 * 60 * 1000,
    lastMessage: {
      text: 'I dunno',
    },
  },
  {
    id: 'convo4',
    name: 'The Fly',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0022',
    avatarPath: util.pngObjectUrl,
    lastUpdated: Date.now(),
    lastMessage: {
      text: 'Gimme!',
    },
  },
];

window.searchResults.contacts = [
  {
    id: 'contact1',
    name: 'The one Everyone',
    conversationType: 'direct',
    phoneNumber: '(202) 555-0013',
    avatarPath: util.gifObjectUrl,
  },
  {
    id: 'contact2',
    e: 'No likey everyone',
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
  },
];

<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    searchResults={window.searchResults}
    startNewConversation={(query, options) =>
      console.log('startNewConversation', query, options)
    }
    openConversationInternal={(id, messageId) =>
      console.log('openConversation', id, messageId)
    }
    showArchivedConversations={() => console.log('showArchivedConversations')}
    showInbox={() => console.log('showInbox')}
    renderMainHeader={() => (
      <MainHeader
        searchTerm="Hi there!"
        search={result => console.log('search', result)}
        updateSearch={result => console.log('updateSearch', result)}
        clearSearch={result => console.log('clearSearch', result)}
        i18n={util.i18n}
      />
    )}
    i18n={util.i18n}
  />
</util.LeftPaneContext>;
```

#### With just conversations

```jsx
<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    conversations={window.searchResults.conversations}
    archivedConversations={[]}
    startNewConversation={(query, options) =>
      console.log('startNewConversation', query, options)
    }
    openConversationInternal={(id, messageId) =>
      console.log('openConversation', id, messageId)
    }
    showArchivedConversations={() => console.log('showArchivedConversations')}
    showInbox={() => console.log('showInbox')}
    renderMainHeader={() => (
      <MainHeader
        searchTerm="Hi there!"
        search={result => console.log('search', result)}
        updateSearch={result => console.log('updateSearch', result)}
        clearSearch={result => console.log('clearSearch', result)}
        i18n={util.i18n}
      />
    )}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Showing inbox, with some archived

```jsx
<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    conversations={window.searchResults.conversations.slice(0, 2)}
    archivedConversations={window.searchResults.conversations.slice(2)}
    startNewConversation={(query, options) =>
      console.log('startNewConversation', query, options)
    }
    openConversationInternal={(id, messageId) =>
      console.log('openConversation', id, messageId)
    }
    showArchivedConversations={() => console.log('showArchivedConversations')}
    showInbox={() => console.log('showInbox')}
    renderMainHeader={() => (
      <MainHeader
        searchTerm="Hi there!"
        search={result => console.log('search', result)}
        updateSearch={result => console.log('updateSearch', result)}
        clearSearch={result => console.log('clearSearch', result)}
        i18n={util.i18n}
      />
    )}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Showing archived conversations

```jsx
<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    conversations={window.searchResults.conversations.slice(0, 2)}
    archivedConversations={window.searchResults.conversations.slice(2)}
    showArchived={true}
    startNewConversation={(query, options) =>
      console.log('startNewConversation', query, options)
    }
    openConversationInternal={(id, messageId) =>
      console.log('openConversation', id, messageId)
    }
    showArchivedConversations={() => console.log('showArchivedConversations')}
    showInbox={() => console.log('showInbox')}
    renderMainHeader={() => (
      <MainHeader
        searchTerm="Hi there!"
        search={result => console.log('search', result)}
        updateSearch={result => console.log('updateSearch', result)}
        clearSearch={result => console.log('clearSearch', result)}
        i18n={util.i18n}
      />
    )}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```
