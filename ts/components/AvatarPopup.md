### With avatar

```jsx
<util.ConversationContext theme={util.theme}>
  <AvatarPopup
    color="pink"
    profileName="John Smith"
    phoneNumber="(800) 555-0001"
    avatarPath={util.gifObjectUrl}
    conversationType="direct"
    onViewPreferences={(...args) => console.log('onViewPreferences', args)}
    onViewArchive={(...args) => console.log('onViewArchive', args)}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With no avatar

```jsx
<util.ConversationContext theme={util.theme}>
  <AvatarPopup
    color="green"
    profileName="John Smith"
    phoneNumber="(800) 555-0001"
    conversationType="direct"
    onViewPreferences={(...args) => console.log('onViewPreferences', args)}
    onViewArchive={(...args) => console.log('onViewArchive', args)}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With empty profileName

```jsx
<util.ConversationContext theme={util.theme}>
  <AvatarPopup
    color="green"
    profileName={null}
    phoneNumber="(800) 555-0001"
    conversationType="direct"
    onViewPreferences={(...args) => console.log('onViewPreferences', args)}
    onViewArchive={(...args) => console.log('onViewArchive', args)}
    i18n={util.i18n}
  />
</util.ConversationContext>
```
