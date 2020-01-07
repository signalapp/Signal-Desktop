#### With search results

```jsx
const items = [
  {
    type: 'conversations-header',
    data: undefined,
  },
  {
    type: 'conversation',
    data: {
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
  },
  {
    type: 'conversation',
    data: {
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
  },
  {
    type: 'contacts-header',
    data: undefined,
  },
  {
    type: 'contact',
    data: {
      name: 'The one Everyone',
      conversationType: 'direct',
      phoneNumber: '(202) 555-0013',
      avatarPath: util.gifObjectUrl,
    },
  },
  {
    type: 'contact',
    data: {
      name: 'No likey everyone',
      conversationType: 'direct',
      phoneNumber: '(202) 555-0014',
      color: 'red',
    },
  },
  {
    type: 'messages-header',
    data: undefined,
  },
];

const messages = [
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
    conversationOpenInternal: () => console.log('onClick'),
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
    conversationOpenInternal: () => console.log('onClick'),
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
    conversationOpenInternal: () => console.log('onClick'),
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
    conversationOpenInternal: () => console.log('onClick'),
  },
];

const messageLookup = util._.fromPairs(
  util._.map(messages, message => [message.id, message])
);
messages.forEach(message => {
  items.push({
    type: 'message',
    data: message.id,
  });
});

const searchResults = {
  items,
  openConversationInternal: (...args) =>
    console.log('openConversationInternal', args),
  startNewConversation: (...args) => console.log('startNewConversation', args),
  onStartNewConversation: (...args) => {
    console.log('onStartNewConversation', args);
  },
  renderMessageSearchResult: id => (
    <MessageSearchResult
      {...messageLookup[id]}
      openConversationInternal={(...args) =>
        console.log('openConversationInternal', args)
      }
    />
  ),
};

<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    searchResults={searchResults}
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
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
    i18n={util.i18n}
  />
</util.LeftPaneContext>;
```

#### With just conversations

```jsx
const conversations = [
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

<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    conversations={conversations}
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
</util.LeftPaneContext>;
```

#### Showing inbox, with some archived

```jsx
const conversations = [
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

<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    conversations={conversations.slice(0, 2)}
    archivedConversations={conversations.slice(2)}
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

#### Showing archived conversations

```jsx
const conversations = [
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

<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    conversations={conversations.slice(0, 2)}
    archivedConversations={conversations.slice(2)}
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
</util.LeftPaneContext>;
```

#### Searching in conversation

```jsx
<util.LeftPaneContext theme={util.theme} style={{ height: '200px' }}>
  <LeftPane
    searchResults={{
      searchConversationName: "Y'all 🌆",
    }}
    conversations={[]}
    archivedConversations={[]}
    showArchived={false}
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
        searchTerm=""
        search={result => console.log('search', result)}
        searchConversationName="Y'all 🌆"
        searchConversationId="group-id-1"
        updateSearch={result => console.log('updateSearch', result)}
        clearSearch={result => console.log('clearSearch', result)}
        i18n={util.i18n}
      />
    )}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```
