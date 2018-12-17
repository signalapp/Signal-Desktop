### In message bubble

```jsx
<util.ConversationContext theme={util.theme}>
  <li>
    <TypingBubble conversationType="direct" i18n={util.i18n} />
  </li>
  <li>
    <TypingBubble color="teal" conversationType="direct" i18n={util.i18n} />
  </li>
</util.ConversationContext>
```

### In message bubble, group conversation

```jsx
<util.ConversationContext theme={util.theme}>
  <li>
    <TypingBubble color="red" conversationType="group" i18n={util.i18n} />
  </li>
  <li>
    <TypingBubble
      color="purple"
      authorName="First Last"
      conversationType="group"
      i18n={util.i18n}
    />
  </li>
  <li>
    <TypingBubble
      avatarPath={util.gifObjectUrl}
      color="blue"
      conversationType="group"
      i18n={util.i18n}
    />
  </li>
</util.ConversationContext>
```
