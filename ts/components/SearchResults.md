#### With all result types

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

<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>;
```

#### With 'start new conversation'

```jsx
const items = [
  {
    type: 'start-new-conversation',
    data: undefined,
  },
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

<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    searchTerm="(202) 555-0015"
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>;
```

#### With no conversations

```jsx
const items = [
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

<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>;
```

#### With no contacts

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

<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>;
```

#### With no messages

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
];

<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
  />
</util.LeftPaneContext>;
```

#### With no results at all

```jsx
<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={[]}
    noResults={true}
    searchTerm="something"
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>
```

#### With no results at all, searching in conversation

```jsx
<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={[]}
    noResults={true}
    searchTerm="something"
    searchInConversationName="Everyone 🔥"
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>
```

#### Searching in conversation but no search term

```jsx
<util.LeftPaneContext
  theme={util.theme}
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
>
  <SearchResults
    items={[]}
    noResults={true}
    searchTerm=""
    searchInConversationName="Everyone 🔥"
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>
```

#### With a lot of results

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
    conversationOpenInternal: data => console.log('onClick', data),
  });
}

const messageLookup = util._.fromPairs(
  util._.map(messages, message => [message.id, message])
);
messages.forEach(message => {
  items.push({
    type: 'message',
    data: message.id,
  });
});

<util.LeftPaneContext
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
  theme={util.theme}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>;
```

#### With just messages and no header

```jsx
const items = [];

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
    conversationOpenInternal: data => console.log('onClick', data),
  });
}

const messageLookup = util._.fromPairs(
  util._.map(messages, message => [message.id, message])
);
messages.forEach(message => {
  items.push({
    type: 'message',
    data: message.id,
  });
});

<util.LeftPaneContext
  gutterStyle={{ height: '500px', display: 'flex', flexDirection: 'row' }}
  theme={util.theme}
>
  <SearchResults
    items={items}
    i18n={util.i18n}
    openConversationInternal={(...args) =>
      console.log('openConversationInternal', args)
    }
    startNewConversation={(...args) =>
      console.log('startNewConversation', args)
    }
    onStartNewConversation={(...args) =>
      console.log('onStartNewConversation', args)
    }
    renderMessageSearchResult={id => (
      <MessageSearchResult
        {...messageLookup[id]}
        i18n={util.i18n}
        openConversationInternal={(...args) =>
          console.log('openConversationInternal', args)
        }
      />
    )}
  />
</util.LeftPaneContext>;
```
