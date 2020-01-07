### Idle

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <TimelineLoadingRow state="idle" />
</util.ConversationContext>
```

### Countdown

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <TimelineLoadingRow
    state="countdown"
    duration={30000}
    expiresAt={Date.now() + 20000}
    onComplete={() => console.log('onComplete')}
  />
</util.ConversationContext>
```

### Loading

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <TimelineLoadingRow state="loading" />
</util.ConversationContext>
```
