#### With name and profile

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      name: 'Someone 🔥 Somewhere',
      phoneNumber: '(202) 555-0011',
      avatarPath: util.gifObjectUrl,
    }}
    to={{
      isMe: true,
    }}
    snippet="What's <<left>>going<<right>> on?"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 24 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Selected

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      name: 'Someone 🔥 Somewhere',
      phoneNumber: '(202) 555-0011',
      avatarPath: util.gifObjectUrl,
    }}
    to={{
      isMe: true,
    }}
    isSelected={true}
    snippet="What's <<left>>going<<right>> on?"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 4 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### From you

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      isMe: true,
    }}
    to={{
      name: 'Mr. Smith',
      phoneNumber: '(202) 555-0011',
      avatarPath: util.gifObjectUrl,
    }}
    snippet="What's <<left>>going<<right>> on?"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 3 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
  <MessageSearchResult
    from={{
      isMe: true,
    }}
    to={{
      name: 'Everyone 🔥',
    }}
    snippet="How is everyone? <<left>>Going<<right>> well?"
    id="messageId2"
    conversationId="conversationId2"
    receivedAt={Date.now() - 27 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### From you and to you

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      isMe: true,
    }}
    to={{
      isMe: true,
    }}
    snippet="Tuesday: Ate two <<left>>apple<<right>>s"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 3 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Profile, with name, no avatar

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      name: 'Mr. Fire🔥',
      phoneNumber: '(202) 555-0011',
      color: 'green',
    }}
    to={{
      isMe: true,
    }}
    snippet="<<left>>Just<<right>> a second"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 7 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### With Group

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      name: 'Jon ❄️',
      phoneNumber: '(202) 555-0011',
      color: 'green',
    }}
    to={{
      name: 'My Crew',
    }}
    snippet="I'm pretty <<left>>excited<<right>>!"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 30 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Longer search results

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MessageSearchResult
    from={{
      name: 'Penny J',
      phoneNumber: '(202) 555-0011',
      color: 'purple',
      avatarPath: util.pngImagePath,
    }}
    to={{
      name: 'Softball 🥎',
    }}
    snippet="This is a really <<left>>detail<<right>>ed long line which will wrap and only be cut off after it gets to three lines. So maybe this will make it in as well?"
    id="messageId1"
    conversationId="conversationId1"
    receivedAt={Date.now() - 17 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
  <MessageSearchResult
    from={{
      name: 'Tim Smith',
      phoneNumber: '(202) 555-0011',
      color: 'red',
      avatarPath: util.pngImagePath,
    }}
    to={{
      name: 'Maple 🍁',
    }}
    snippet="Okay, here are the <<left>>detail<<right>>s:\n\n1355 Ridge Way\nCode: 234\n\nI'm excited!"
    id="messageId2"
    conversationId="conversationId2"
    receivedAt={Date.now() - 10 * 60 * 60 * 1000}
    onClick={result => console.log('onClick', result)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```
