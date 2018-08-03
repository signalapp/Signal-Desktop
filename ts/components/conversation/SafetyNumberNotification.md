### In group conversation

```js
<util.ConversationContext theme={util.theme}>
  <SafetyNumberNotification
    i18n={util.i18n}
    isGroup={true}
    contact={{ phoneNumber: '(202) 500-1000', profileName: 'Mr. Fire' }}
    onVerify={() => console.log('onVerify')}
  />
</util.ConversationContext>
```

### In one-on-one conversation

```js
<util.ConversationContext theme={util.theme}>
  <SafetyNumberNotification
    i18n={util.i18n}
    isGroup={false}
    contact={{ phoneNumber: '(202) 500-1000', profileName: 'Mr. Fire' }}
    onVerify={() => console.log('onVerify')}
  />
</util.ConversationContext>
```
