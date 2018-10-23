### With avatar

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    color="pink"
    name="John Smith"
    avatarPath={util.gifObjectUrl}
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="pink"
    name="Puppies"
    avatarPath={util.gifObjectUrl}
    conversationType="group"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With only name

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    color="blue"
    name="John"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="green"
    name="John Smith"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="red"
    name="Puppies"
    conversationType="group"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Just phone number

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    color="pink"
    phoneNumber="(555) 353-3433"
    conversationType="direct"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### All colors

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    color="signal-blue"
    name="Group"
    conversationType="group"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="red"
    name="Red"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="deep_orange"
    name="Deep Orange"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="brown"
    name="Broen"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="pink"
    name="Pink"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="purple"
    name="Purple"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="indigo"
    name="Indigo"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="blue"
    name="Blue"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="teal"
    name="Teal"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="green"
    name="Green"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="light_green"
    name="Light Green"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={28}
    color="blue_grey"
    name="Blue Grey"
    conversationType="direct"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### 36px

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={36}
    color="teal"
    name="John Smith"
    avatarPath={util.gifObjectUrl}
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={36}
    color="teal"
    name="John"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={36}
    color="teal"
    name="John Smith"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar size={36} color="teal" conversationType="direct" i18n={util.i18n} />
  <Avatar
    size={36}
    color="teal"
    name="Pupplies"
    conversationType="group"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### 48px

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={48}
    color="teal"
    name="John Smith"
    avatarPath={util.gifObjectUrl}
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={48}
    color="teal"
    name="John"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={48}
    color="teal"
    name="John Smith"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar size={48} color="teal" conversationType="direct" i18n={util.i18n} />
  <Avatar
    size={48}
    color="teal"
    name="Pupplies"
    conversationType="group"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### 80px

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={80}
    color="teal"
    name="John Smith"
    avatarPath={util.gifObjectUrl}
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={80}
    color="teal"
    name="John"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar
    size={80}
    color="teal"
    name="John Smith"
    conversationType="direct"
    i18n={util.i18n}
  />
  <Avatar size={80} color="teal" conversationType="direct" i18n={util.i18n} />
  <Avatar
    size={80}
    color="teal"
    name="Pupplies"
    conversationType="group"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Broken color

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    color="fake"
    name="F"
    conversationType="direct"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Broken image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    color="pink"
    name="John Smith"
    avatarPath="nonexistent"
    conversationType="direct"
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Broken image for group

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <Avatar
    size={28}
    avatarPath="nonexistent"
    color="pink"
    name="Puppies"
    avatarPath="nonexistent"
    conversationType="group"
    i18n={util.i18n}
  />
</util.ConversationContext>
```
