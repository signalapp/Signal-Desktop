### With a contact

#### Including all data types

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [
    {
      name: {
        displayName: 'Someone Somewhere',
      },
      number: [
        {
          value: util.CONTACTS[0].id,
          type: 1,
        },
      ],
      avatar: {
        avatar: {
          path: util.gifObjectUrl,
        },
      },
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### In group conversation

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [
    {
      name: {
        displayName: 'Someone Somewhere',
      },
      number: [
        {
          value: util.CONTACTS[0].id,
          type: 1,
        },
      ],
      avatar: {
        avatar: {
          path: util.gifObjectUrl,
        },
      },
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme} type="group">
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### If contact has no signal account

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [
    {
      name: {
        displayName: 'Someone Somewhere',
      },
      number: [
        {
          value: '+12025551000',
          type: 1,
        },
      ],
      avatar: {
        avatar: {
          path: util.gifObjectUrl,
        },
      },
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### With organization name instead of name

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [
    {
      organization: 'United Somewheres, Inc.',
      email: [
        {
          value: 'someone@somewheres.com',
          type: 2,
        },
      ],
      avatar: {
        avatar: {
          path: util.gifObjectUrl,
        },
      },
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### No displayName or organization

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [
    {
      name: {
        givenName: 'Someone',
      },
      number: [
        {
          value: '+12025551000',
          type: 1,
        },
      ],
      avatar: {
        avatar: {
          path: util.gifObjectUrl,
        },
      },
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### Default avatar

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [
    {
      name: {
        displayName: 'Someone Somewhere',
      },
      number: [
        {
          value: util.CONTACTS[0].id,
          type: 1,
        },
      ],
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### Empty contact

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  contact: [{}],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```

#### Contact with caption (cannot currently be sent)

```jsx
const outgoing = new Whisper.Message({
  type: 'outgoing',
  sent_at: Date.now() - 18000000,
  body: 'I want to introduce you to Someone...',
  contact: [
    {
      name: {
        displayName: 'Someone Somewhere',
      },
      number: [
        {
          value: util.CONTACTS[0].id,
          type: 1,
        },
      ],
      avatar: {
        avatar: {
          path: util.gifObjectUrl,
        },
      },
    },
  ],
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={{ model: incoming }} />
  <util.BackboneWrapper View={View} options={{ model: outgoing }} />
</util.ConversationContext>;
```
