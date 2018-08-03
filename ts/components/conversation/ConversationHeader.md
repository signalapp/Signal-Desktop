### Name variations, 1:1 conversation

Note the five items in gear menu, and the second-level menu with disappearing messages options. Disappearing message set to 'off'.

#### With name and profile, verified

```jsx
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
```

#### With name, not verified, no avatar

```jsx
<ConversationHeader
  i18n={util.i18n}
  color="blue"
  isVerified={false}
  name="Someone 🔥 Somewhere"
  phoneNumber="(202) 555-0002"
  id="2"
/>
```

#### Profile, no name

```jsx
<ConversationHeader
  i18n={util.i18n}
  color="teal"
  isVerified={false}
  phoneNumber="(202) 555-0003"
  id="3"
  profileName="🔥Flames🔥"
/>
```

#### No name, no profile, no color

```jsx
<ConversationHeader i18n={util.i18n} phoneNumber="(202) 555-0011" id="11" />
```

### With back button

```jsx
<ConversationHeader
  showBackButton={true}
  color="deep_orange"
  i18n={util.i18n}
  phoneNumber="(202) 555-0004"
  id="4"
/>
```

### Disappearing messages set

```jsx
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
```

### In a group

Note that the menu should includes 'Show Members' instead of 'Show Safety Number'

```jsx
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
```

### In chat with yourself

Note that the menu should not have a 'Show Safety Number' entry.

```jsx
<ConversationHeader
  color="cyan"
  i18n={util.i18n}
  phoneNumber="(202) 555-0007"
  id="7"
  isMe={true}
/>
```
