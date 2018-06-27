### Timer change

```jsx
const fromOther = new Whisper.Message({
  type: 'incoming',
  flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
  source: '+12025550003',
  sent_at: Date.now() - 200000,
  expireTimer: 120,
  expirationStartTimestamp: Date.now() - 1000,
  expirationTimerUpdate: {
    source: '+12025550003',
  },
});
const fromUpdate = new Whisper.Message({
  type: 'incoming',
  flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
  source: util.ourNumber,
  sent_at: Date.now() - 200000,
  expireTimer: 120,
  expirationStartTimestamp: Date.now() - 1000,
  expirationTimerUpdate: {
    fromSync: true,
    source: util.ourNumber,
  },
});
const fromMe = new Whisper.Message({
  type: 'incoming',
  flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
  source: util.ourNumber,
  sent_at: Date.now() - 200000,
  expireTimer: 120,
  expirationStartTimestamp: Date.now() - 1000,
  expirationTimerUpdate: {
    source: util.ourNumber,
  },
});
const View = Whisper.ExpirationTimerUpdateView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: fromOther }} />
  <util.BackboneWrapper View={View} options={{ model: fromUpdate }} />
  <util.BackboneWrapper View={View} options={{ model: fromMe }} />
  <Notification type="timerUpdate" onClick={() => console.log('onClick')} />
</util.ConversationContext>;
```

### Safety number change

```js
const incoming = new Whisper.Message({
  type: 'keychange',
  sent_at: Date.now() - 200000,
  key_changed: '+12025550003',
});
const View = Whisper.KeyChangeView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
</util.ConversationContext>;
```

### Marking as verified

```js
const fromPrimary = new Whisper.Message({
  type: 'verified-change',
  sent_at: Date.now() - 200000,
  verifiedChanged: '+12025550003',
  verified: true,
});
const local = new Whisper.Message({
  type: 'verified-change',
  sent_at: Date.now() - 200000,
  verifiedChanged: '+12025550003',
  local: true,
  verified: true,
});

const View = Whisper.VerifiedChangeView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: fromPrimary }} />
  <util.BackboneWrapper View={View} options={{ model: local }} />
</util.ConversationContext>;
```

### Marking as not verified

```js
const fromPrimary = new Whisper.Message({
  type: 'verified-change',
  sent_at: Date.now() - 200000,
  verifiedChanged: '+12025550003',
});
const local = new Whisper.Message({
  type: 'verified-change',
  sent_at: Date.now() - 200000,
  verifiedChanged: '+12025550003',
  local: true,
});

const View = Whisper.VerifiedChangeView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: fromPrimary }} />
  <util.BackboneWrapper View={View} options={{ model: local }} />
</util.ConversationContext>;
```

### Group update

```js
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 200000,
  group_update: {
    joined: ['+12025550007', '+12025550008', '+12025550009'],
  },
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550003',
    type: 'incoming',
  })
);

const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

### End session

```js
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 200000,
  flags: textsecure.protobuf.DataMessage.Flags.END_SESSION,
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550003',
    type: 'incoming',
  })
);

const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```
