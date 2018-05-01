Placeholder component:

```jsx
<util.ConversationContext theme={util.theme}>
  <Message />
</util.ConversationContext>
```

## MessageView (Backbone)

### Plain messages

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'How are you doing this fine day?',
  sent_at: Date.now() - 18000,
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

### In a group conversation

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'How are you doing this fine day?',
  sent_at: Date.now() - 200000,
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550003',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme} type="group">
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

### With an error

#### General error

```jsx
const error = new Error('Something went wrong!');

const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: "This message won't get through...",
  sent_at: Date.now() - 200000,
  errors: [error],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550003',
    type: 'incoming',
    body: null,
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### Network error (outgoing only)

```jsx
const error = new Error('Something went wrong!');
error.name = 'MessageError';

const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 200000,
  errors: [error],
  body: "This message won't get through...",
});
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme} type="group">
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### Network error, partial send in group (outgoing only)

```jsx
const error = new Error('Something went wrong!');
error.name = 'MessageError';

const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 200000,
  errors: [error],
  conversationId: util.groupNumber,
  body: "This message won't get through...",
});
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme} type="group">
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### No message contents

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 200000,
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

### Disappearing

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 200000,
  expireTimer: 120,
  expirationStartTimestamp: Date.now() - 1000,
  body: 'This message will self-destruct in two minutes',
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

### Notfications

#### Timer change

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
</util.ConversationContext>;
```

#### Safety number change

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

#### Marking as verified

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

#### Marking as not verified

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

#### Group update

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

#### End session

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

### With an attachment

#### Image with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'I am pretty confused about Pi.',
  sent_at: Date.now() - 18000000,
  attachments: [
    {
      data: util.gif,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    },
  ],
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

#### Image

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  attachments: [
    {
      data: util.gif,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    },
  ],
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

#### Image with portrait aspect ratio

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  attachments: [
    {
      data: util.portraitYellow,
      fileName: 'portraitYellow.png',
      contentType: 'image/png',
    },
  ],
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

#### Image with portrait aspect ratio and caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'This is an odd yellow bar. Cool, huh?',
  sent_at: Date.now() - 18000000,
  attachments: [
    {
      data: util.portraitYellow,
      fileName: 'portraitYellow.png',
      contentType: 'image/png',
    },
  ],
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

#### Image with landscape aspect ratio

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  attachments: [
    {
      data: util.landscapePurple,
      fileName: 'landscapePurple.jpg',
      contentType: 'image/jpeg',
    },
  ],
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

#### Image with landscape aspect ratio and caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: "An interesting horizontal bar. It's art.",
  sent_at: Date.now() - 18000000,
  attachments: [
    {
      data: util.landscapePurple,
      fileName: 'landscapePurple.jpg',
      contentType: 'image/jpeg',
    },
  ],
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

#### Video with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: "Beautiful, isn't it?",
  sent_at: Date.now() - 10000,
  attachments: [
    {
      data: util.mp4,
      fileName: 'freezing_bubble.mp4',
      contentType: 'video/mp4',
    },
  ],
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

#### Video

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 10000,
  attachments: [
    {
      data: util.mp4,
      fileName: 'freezing_bubble.mp4',
      contentType: 'video/mp4',
    },
  ],
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

#### Audio with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'This is a nice song',
  sent_at: Date.now() - 15000,
  attachments: [
    {
      data: util.mp3,
      fileName: 'agnus_dei.mp3',
      contentType: 'audio/mp3',
    },
  ],
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

#### Audio

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 15000,
  attachments: [
    {
      data: util.mp3,
      fileName: 'agnus_dei.mp3',
      contentType: 'audio/mp3',
    },
  ],
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

#### Voice message

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 15000,
  attachments: [
    {
      flags: textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
      data: util.mp3,
      fileName: 'agnus_dei.mp3',
      contentType: 'audio/mp3',
    },
  ],
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

#### Other file type with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'My manifesto is now complete!',
  sent_at: Date.now() - 15000,
  attachments: [
    {
      data: util.txt,
      fileName: 'lorum_ipsum.txt',
      contentType: 'text/plain',
    },
  ],
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

#### Other file type

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 15000,
  attachments: [
    {
      data: util.txt,
      fileName: 'lorum_ipsum.txt',
      contentType: 'text/plain',
    },
  ],
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
