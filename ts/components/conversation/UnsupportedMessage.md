### From someone in your contacts

```jsx
<util.ConversationContext theme={util.theme}>
  <UnsupportedMessage
    i18n={util.i18n}
    contact={{ phoneNumber: '(202) 500-1000', name: 'Alice' }}
    downloadNewVersion={() => console.log('downloadNewVersion')}
  />
</util.ConversationContext>
```

### After you upgrade

```jsx
<util.ConversationContext theme={util.theme}>
  <UnsupportedMessage
    i18n={util.i18n}
    canProcessNow={true}
    contact={{ phoneNumber: '(202) 500-1000', name: 'Alice' }}
    downloadNewVersion={() => console.log('downloadNewVersion')}
  />
</util.ConversationContext>
```

### No name, just profile

```jsx
<util.ConversationContext theme={util.theme}>
  <UnsupportedMessage
    i18n={util.i18n}
    contact={{ phoneNumber: '(202) 500-1000', profileName: 'Mr. Fire' }}
    downloadNewVersion={() => console.log('downloadNewVersion')}
  />
</util.ConversationContext>
```

### From yourself

```jsx
<util.ConversationContext theme={util.theme}>
  <UnsupportedMessage
    i18n={util.i18n}
    contact={{
      isMe: true,
      phoneNumber: '(202) 500-1000',
      profileName: 'Mr. Fire',
    }}
    downloadNewVersion={() => console.log('downloadNewVersion')}
  />
</util.ConversationContext>
```

### From yourself, after you upgrade

```jsx
<util.ConversationContext theme={util.theme}>
  <UnsupportedMessage
    i18n={util.i18n}
    canProcessNow={true}
    contact={{
      isMe: true,
      phoneNumber: '(202) 500-1000',
      profileName: 'Mr. Fire',
    }}
    downloadNewVersion={() => console.log('downloadNewVersion')}
  />
</util.ConversationContext>
```
