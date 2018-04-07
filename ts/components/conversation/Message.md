
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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
  source: '+12025550100',
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

### With a quotation, text-only replies

#### Plain text

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: 'About six',
  sent_at: Date.now() - 18000000,
  quote: {
    text: 'How many ferrets do you have?',
    author: '+12025550100',
    id: Date.now() - 1000,
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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

#### Image with caption

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  body: "Totally, it's a pretty unintuitive concept.",
  sent_at: Date.now() - 18000000,
  quote: {
    text: 'I am pretty confused about Pi.',
    author: '+12025550100',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'image/gif',
      fileName: 'pi.gif',
      thumbnail: {
        contentType: 'image/gif',
        data: util.gif,
      }
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: "Yeah, pi. Tough to wrap your head around.",
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'image/gif',
      fileName: 'pi.gif',
      thumbnail: {
        contentType: 'image/gif',
        data: util.gif,
      }
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: "Sweet the way the video sneaks up on you!",
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    text: 'Check out this video I found!',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'video/mp4',
      fileName: 'freezing_bubble.mp4',
      thumbnail: {
        contentType: 'image/gif',
        data: util.gif,
      }
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: "Awesome!",
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'video/mp4',
      fileName: 'freezing_bubble.mp4',
      thumbnail: {
        contentType: 'image/gif',
        data: util.gif,
      }
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: 'I really like it!',
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    text: 'Check out this beautiful song!',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'audio/mp3',
      fileName: 'agnus_dei.mp4',
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: 'I really like it!',
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'audio/mp3',
      fileName: 'agnus_dei.mp4',
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: 'I really like it!',
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    id: Date.now() - 1000,
    attachments: {
      // proposed as of afternoon of 4/6 in Quoted Replies group
      flags: textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
      contentType: 'audio/mp3',
      fileName: 'agnus_dei.mp4',
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: "I can't read latin.",
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    text: 'This is my manifesto. Tell me what you think!',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'text/plain',
      fileName: 'lorum_ipsum.txt',
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
  body: "Sorry, I can't read latin!",
  sent_at: Date.now() - 18000000,
  quote: {
    author: '+12025550100',
    id: Date.now() - 1000,
    attachments: {
      contentType: 'text/plain',
      fileName: 'lorum_ipsum.txt',
    }
  },
});
const incoming = new Whisper.Message(Object.assign({}, outgoing.attributes, {
  source: '+12025550100',
  type: 'incoming',
  quote: Object.assign({}, outgoing.attributes.quote, {
    author: '+12025550200',
  }),
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
