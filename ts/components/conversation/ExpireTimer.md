### Countdown at different rates

```jsx
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="10 second timer"
      i18n={util.i18n}
      expirationLength={10 * 1000}
      expirationTimestamp={Date.now() + 10 * 1000}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="cyan"
      text="30 second timer"
      i18n={util.i18n}
      expirationLength={30 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="1 minute timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 55 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="5 minute timer"
      i18n={util.i18n}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
    />
  </li>
</util.ConversationContext>
```

### Timer calculations

```jsx
<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="Full timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 60 * 1000}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="Full timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 60 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="55 timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 55 * 1000}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="55 timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 55 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="30 timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="30 timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="5 timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 5 * 1000}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="5 timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 5 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="Expired timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now()}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="Expired timer"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now()}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="Expiration is too far away"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 120 * 1000}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="Expiration is too far away"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 120 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="Already expired"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() - 20 * 1000}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="Already expired"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() - 20 * 1000}
    />
  </li>
</util.ConversationContext>
```
