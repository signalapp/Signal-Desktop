### From other

```jsx
<util.ConversationContext theme={util.theme}>
  <TimerNotification
    type="fromOther"
    phoneNumber="(202) 555-1000"
    profileName="Mr. Fire"
    timespan="1 hour"
    i18n={util.i18n}
  />
  <TimerNotification
    type="fromOther"
    phoneNumber="(202) 555-1000"
    profileName="Mr. Fire"
    disabled={true}
    timespan="Off"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### You changed

```jsx
<util.ConversationContext theme={util.theme}>
  <TimerNotification
    type="fromMe"
    phoneNumber="(202) 555-1000"
    timespan="1 hour"
    i18n={util.i18n}
  />
  <TimerNotification
    type="fromMe"
    phoneNumber="(202) 555-1000"
    disabled={true}
    timespan="Off"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Changed via sync

```jsx
<util.ConversationContext theme={util.theme}>
  <TimerNotification
    type="fromSync"
    phoneNumber="(202) 555-1000"
    timespan="1 hour"
    i18n={util.i18n}
  />
  <TimerNotification
    type="fromSync"
    phoneNumber="(202) 555-1000"
    disabled={true}
    timespan="Off"
    i18n={util.i18n}
  />
</util.ConversationContext>
```
