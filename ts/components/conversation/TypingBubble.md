### In message bubble

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <div className="module-message-container">
    <TypingBubble conversationType="direct" i18n={util.i18n} />
  </div>
  <div className="module-message-container">
    <TypingBubble color="teal" conversationType="direct" i18n={util.i18n} />
  </div>
</util.ConversationContext>
```

### In message bubble, group conversation

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <div className="module-message-container">
    <TypingBubble color="red" conversationType="group" i18n={util.i18n} />
  </div>
  <div className="module-message-container">
    <TypingBubble
      color="purple"
      authorName="First Last"
      conversationType="group"
      i18n={util.i18n}
    />
  </div>
  <div className="module-message-container">
    <TypingBubble
      avatarPath={util.gifObjectUrl}
      color="blue"
      conversationType="group"
      i18n={util.i18n}
    />
  </div>
</util.ConversationContext>
```
