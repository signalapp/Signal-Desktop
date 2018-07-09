### Three changes, all types

```js
<util.ConversationContext theme={util.theme}>
  <GroupNotification
    changes={[
      {
        type: 'add',
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
          },
          {
            phoneNumber: '(202) 555-1001',
            profileName: 'Mrs. Ice',
          },
          {
            phoneNumber: '(202) 555-1002',
            name: 'Ms. Earth',
          },
        ],
      },
      {
        type: 'name',
        newName: 'New Group Name',
      },
      {
        type: 'remove',
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
            profileName: 'Mr. Fire',
          },
        ],
      },
    ]}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Joined group

```js
<util.ConversationContext theme={util.theme}>
  <GroupNotification
    changes={[
      {
        type: 'add',
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
          },
          {
            phoneNumber: '(202) 555-1001',
            profileName: 'Mrs. Ice',
          },
          {
            phoneNumber: '(202) 555-1002',
            name: 'Ms. Earth',
          },
        ],
      },
    ]}
    i18n={util.i18n}
  />
  <GroupNotification
    changes={[
      {
        type: 'add',
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
            profileName: 'Mr. Fire',
          },
        ],
      },
    ]}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Left group

```js
<util.ConversationContext theme={util.theme}>
  <GroupNotification
    changes={[
      {
        type: 'remove',
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
            profileName: 'Mr. Fire',
          },
          {
            phoneNumber: '(202) 555-1001',
            profileName: 'Mrs. Ice',
          },
          {
            phoneNumber: '(202) 555-1002',
            name: 'Ms. Earth',
          },
        ],
      },
    ]}
    i18n={util.i18n}
  />
  <GroupNotification
    changes={[
      {
        type: 'remove',
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
            profileName: 'Mr. Fire',
          },
        ],
      },
    ]}
    i18n={util.i18n}
  />
  <GroupNotification
    changes={[
      {
        type: 'remove',
        isMe: true,
        contacts: [
          {
            phoneNumber: '(202) 555-1000',
            profileName: 'Mr. Fire',
          },
        ],
      },
    ]}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Title changed

```js
<util.ConversationContext theme={util.theme}>
  <GroupNotification
    changes={[
      {
        type: 'name',
        newName: 'New Group Name',
      },
    ]}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Generic group update

```js
<util.ConversationContext theme={util.theme}>
  <GroupNotification
    changes={[
      {
        type: 'general',
      },
    ]}
    i18n={util.i18n}
  />
</util.ConversationContext>
```
