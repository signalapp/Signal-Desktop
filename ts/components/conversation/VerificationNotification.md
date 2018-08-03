### Marking as verified

```js
<util.ConversationContext theme={util.theme}>
  <VerificationNotification
    type="markVerified"
    isLocal={true}
    contact={{
      phoneNumber: '(202) 555-0003',
      profileName: 'Mr. Fire',
    }}
    i18n={util.i18n}
  />
  <VerificationNotification
    type="markVerified"
    isLocal={false}
    contact={{
      phoneNumber: '(202) 555-0003',
      profileName: 'Mr. Fire',
    }}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Marking as not verified

```js
<util.ConversationContext theme={util.theme}>
  <VerificationNotification
    type="markNotVerified"
    isLocal={true}
    contact={{
      phoneNumber: '(202) 555-0003',
      profileName: 'Mr. Fire',
    }}
    i18n={util.i18n}
  />
  <VerificationNotification
    type="markNotVerified"
    isLocal={false}
    contact={{
      phoneNumber: '(202) 555-0003',
      profileName: 'Mr. Fire',
    }}
    i18n={util.i18n}
  />
</util.ConversationContext>
```
