### Name variations, 1:1 conversation

Note the five items in gear menu, and the second-level menu with disappearing messages options. Disappearing message set to 'off'.

#### With name and profile, verified

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    i18n={util.i18n}
    color="red"
    isVerified={true}
    avatarPath={util.gifObjectUrl}
    name="Someone 🔥 Somewhere"
    phoneNumber="(202) 555-0001"
    id="1"
    profileName="🔥Flames🔥"
    onSetDisappearingMessages={seconds =>
      console.log('onSetDisappearingMessages', seconds)
    }
    onDeleteMessages={() => console.log('onDeleteMessages')}
    onResetSession={() => console.log('onResetSession')}
    onShowSafetyNumber={() => console.log('onShowSafetyNumber')}
    onShowAllMedia={() => console.log('onShowAllMedia')}
    onShowGroupMembers={() => console.log('onShowGroupMembers')}
    onGoBack={() => console.log('onGoBack')}
  />
</util.ConversationContext>
```

#### With name, not verified, no avatar

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    i18n={util.i18n}
    color="blue"
    isVerified={false}
    name="Someone 🔥 Somewhere"
    phoneNumber="(202) 555-0002"
    id="2"
  />
</util.ConversationContext>
```

#### Profile, no name

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    i18n={util.i18n}
    color="teal"
    isVerified={false}
    phoneNumber="(202) 555-0003"
    id="3"
    profileName="🔥Flames🔥"
  />
</util.ConversationContext>
```

#### No name, no profile, no color

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader i18n={util.i18n} phoneNumber="(202) 555-0011" id="11" />
</util.ConversationContext>
```

### With back button

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    showBackButton={true}
    color="deep_orange"
    i18n={util.i18n}
    phoneNumber="(202) 555-0004"
    id="4"
  />
</util.ConversationContext>
```

### Disappearing messages set

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    color="indigo"
    i18n={util.i18n}
    phoneNumber="(202) 555-0005"
    id="5"
    expirationSettingName="10 seconds"
    timerOptions={[
      {
        name: 'off',
        value: 0,
      },
      {
        name: '10 seconds',
        value: 10,
      },
    ]}
    onSetDisappearingMessages={seconds =>
      console.log('onSetDisappearingMessages', seconds)
    }
    onDeleteMessages={() => console.log('onDeleteMessages')}
    onResetSession={() => console.log('onResetSession')}
    onShowSafetyNumber={() => console.log('onShowSafetyNumber')}
    onShowAllMedia={() => console.log('onShowAllMedia')}
    onShowGroupMembers={() => console.log('onShowGroupMembers')}
    onGoBack={() => console.log('onGoBack')}
  />
</util.ConversationContext>
```

### In a group

Note that the menu should includes 'Show Members' instead of 'Show Safety Number'

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    i18n={util.i18n}
    color="green"
    phoneNumber="(202) 555-0006"
    id="6"
    isGroup={true}
    onSetDisappearingMessages={seconds =>
      console.log('onSetDisappearingMessages', seconds)
    }
    onDeleteMessages={() => console.log('onDeleteMessages')}
    onResetSession={() => console.log('onResetSession')}
    onShowSafetyNumber={() => console.log('onShowSafetyNumber')}
    onShowAllMedia={() => console.log('onShowAllMedia')}
    onShowGroupMembers={() => console.log('onShowGroupMembers')}
    onGoBack={() => console.log('onGoBack')}
  />
</util.ConversationContext>
```

### In chat with yourself

This is the 'Note to self' conversation. Note that the menu should not have a 'Show Safety Number' entry.

```jsx
<util.ConversationContext theme={util.theme}>
  <ConversationHeader
    color="cyan"
    i18n={util.i18n}
    phoneNumber="(202) 555-0007"
    id="7"
    isMe={true}
  />
</util.ConversationContext>
```
