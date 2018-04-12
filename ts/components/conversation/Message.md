
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
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

### With an attachment

#### Image with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'I am pretty confused about Pi.',
  sent_at: Date.now() - 18000000,
  attachments: [{
    data: util.gif,
    fileName: 'pi.gif',
    contentType: 'image/gif',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Image

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  attachments: [{
    data: util.gif,
    fileName: 'pi.gif',
    contentType: 'image/gif',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Video with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: "Beautiful, isn't it?",
  sent_at: Date.now() - 10000,
  attachments: [{
    data: util.mp4,
    fileName: 'freezing_bubble.mp4',
    contentType: 'video/mp4',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Video

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 10000,
  attachments: [{
    data: util.mp4,
    fileName: 'freezing_bubble.mp4',
    contentType: 'video/mp4',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Audio with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'This is a nice song',
  sent_at: Date.now() - 15000,
  attachments: [{
    data: util.mp3,
    fileName: 'agnus_dei.mp3',
    contentType: 'audio/mp3',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Audio

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 15000,
  attachments: [{
    data: util.mp3,
    fileName: 'agnus_dei.mp3',
    contentType: 'audio/mp3',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Voice message

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 15000,
  attachments: [{
    flags: textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
    data: util.mp3,
    fileName: 'agnus_dei.mp3',
    contentType: 'audio/mp3',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Other file type with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'My manifesto is now complete!',
  sent_at: Date.now() - 15000,
  attachments: [{
    data: util.txt,
    fileName: 'lorum_ipsum.txt',
    contentType: 'text/plain',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```

#### Other file type

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 15000,
  attachments: [{
    data: util.txt,
    fileName: 'lorum_ipsum.txt',
    contentType: 'text/plain',
  }],
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550003',
  type: 'incoming',
}));
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={{ model: incoming }}
  />
  <util.BackboneWrapper
    View={View}
    options={{ model: outgoing }}
  />
</util.ConversationContext>
```
