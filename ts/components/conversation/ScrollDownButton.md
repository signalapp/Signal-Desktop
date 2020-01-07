### No new messages

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <ScrollDownButton
    withNewMessages={false}
    conversationId="id-1"
    scrollDown={id => console.log('scrollDown', id)}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With new messages

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <ScrollDownButton
    withNewMessages={true}
    conversationId="id-2"
    scrollDown={id => console.log('scrollDown', id)}
    i18n={util.i18n}
  />
</util.ConversationContext>
```
