### Plain messages

Note that timestamp and status can be hidden with the `collapseMetadata` boolean property.

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="🔥"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Hello there from the new world! http://somewhere.com"
    i18n={util.i18n}
  />
  <Message
    collapseMetadata
    direction="incoming"
    timestamp={Date.now()}
    color="red"
    text="Hello there from the new world!"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="grey"
    text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="deep_orange"
    timestamp={Date.now()}
    collapseMetadata
    text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sent"
    color="pink"
    text="🔥"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="read"
    color="pink"
    text="Hello there from the new world! http://somewhere.com"
    i18n={util.i18n}
  />
  <Message
    collapseMetadata
    direction="outgoing"
    status="sent"
    timestamp={Date.now()}
    text="Hello there from the new world! 🔥"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="sent"
    timestamp={Date.now()}
    color="blue"
    text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="read"
    timestamp={Date.now()}
    collapseMetadata
    text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Timestamps

```jsx
function get1201() {
  const d = new Date();
  d.setHours(0, 0, 1, 0);
  return d.getTime();
}
function getYesterday1159() {
  return get1201() - 2 * 60 * 1000;
}
function getJanuary1201() {
  const now = new Date();
  const d = new Date(now.getFullYear(), 0, 1, 0, 1);
  return d.getTime();
}
function getDecember1159() {
  return getJanuary1201() - 2 * 60 * 1000;
}

<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    color="red"
    timestamp={Date.now() - 500}
    text="500ms ago - all below 1 minute are 'now'"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 5 * 1000}
    text="Five seconds ago"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 30 * 1000}
    text="30 seconds ago"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="red"
    timestamp={Date.now() - 60 * 1000}
    text="One minute ago - in minutes"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 30 * 60 * 1000}
    text="30 minutes ago"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 45 * 60 * 1000}
    text="45 minutes ago (used to round up to 1 hour with moment)"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="red"
    timestamp={Date.now() - 60 * 60 * 1000}
    text="One hour ago - in hours"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={get1201()}
    text="12:01am today"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="red"
    timestamp={getYesterday1159()}
    text="11:59pm yesterday - adds day name"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 24 * 60 * 60 * 1000}
    text="24 hours ago"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 2 * 24 * 60 * 60 * 1000}
    text="Two days ago"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="red"
    timestamp={Date.now() - 7 * 24 * 60 * 60 * 1000}
    text="Seven days ago - adds month"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 30 * 24 * 60 * 60 * 1000}
    text="Thirty days ago"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={getJanuary1201()}
    text="January 1st at 12:01am"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="red"
    timestamp={getDecember1159()}
    text="December 31st at 11:59pm - adds year"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    color="teal"
    timestamp={Date.now() - 366 * 24 * 60 * 60 * 1000}
    text="One year ago"
    i18n={util.i18n}
  />
</util.ConversationContext>;
```

### Status

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="outgoing"
    status="sending"
    color="pink"
    timestamp={Date.now()}
    text="This is still sending."
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="sent"
    color="red"
    timestamp={Date.now()}
    text="This has been successfully sent!"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="delivered"
    color="blue"
    timestamp={Date.now()}
    text="This has been delivered!"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="read"
    color="purple"
    timestamp={Date.now()}
    text="This has been read!"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="sending"
    color="pink"
    timestamp={Date.now()}
    text="🔥"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="sent"
    color="red"
    timestamp={Date.now()}
    text="🔥"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="delivered"
    color="blue"
    timestamp={Date.now()}
    text="🔥"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    status="read"
    color="purple"
    timestamp={Date.now()}
    text="🔥"
    i18n={util.i18n}
  />
</util.ConversationContext>
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

### Disappearing messages

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="cyan"
    direction="incoming"
    text="Full timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 60 * 1000}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="Full timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 60 * 1000}
  />
  <Message
    color="cyan"
    direction="incoming"
    text="55 timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 55 * 1000}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="55 timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 55 * 1000}
  />
  <Message
    color="cyan"
    direction="incoming"
    text="30 timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 30 * 1000}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="30 timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 30 * 1000}
  />
  <Message
    color="cyan"
    direction="incoming"
    text="5 timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 5 * 1000}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="5 timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 5 * 1000}
  />
  <Message
    color="cyan"
    direction="incoming"
    text="Expired timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now()}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="Expired timer"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now()}
  />
  <Message
    color="cyan"
    direction="incoming"
    text="Expiration is too far away"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 120 * 1000}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="Expiration is too far away"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 120 * 1000}
  />
  <Message
    color="cyan"
    direction="incoming"
    text="Already expired"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() - 20 * 1000}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="Already expired"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() - 20 * 1000}
  />
</util.ConversationContext>
```

### With an attachment

#### Image with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="cyan"
    direction="incoming"
    text="I am pretty confused about Pi."
    i18n={util.i18n}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="I am pretty confused about Pi."
    i18n={util.i18n}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="blue"
    direction="incoming"
    text="I am pretty confused about Pi."
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="I am pretty confused about Pi."
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Image

First, showing the metadata overlay on dark and light images, then a message with `collapseMetadata` set.

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 30 * 1000}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="sent"
    i18n={util.i18n}
    expirationLength={60 * 1000}
    expirationTimestamp={Date.now() + 30 * 1000}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="sent"
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="purple"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    status="sent"
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Outgoing image with status

Note that the delivered indicator is always Signal Blue, not the conversation color.

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="outgoing"
    status="sending"
    color="pink"
    timestamp={Date.now()}
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="sent"
    color="red"
    timestamp={Date.now()}
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    color="blue"
    timestamp={Date.now()}
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="read"
    color="purple"
    timestamp={Date.now()}
    i18n={util.i18n}
    attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Image with portrait aspect ratio

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="purple"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Image with portrait aspect ratio and caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    text="This is an odd yellow bar. Cool, huh?"
    direction="incoming"
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="delivered"
    text="This is an odd yellow bar. Cool, huh?"
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="purple"
    text="This is an odd yellow bar. Cool, huh?"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="This is an odd yellow bar. Cool, huh?"
    collapseMetadata
    i18n={util.i18n}
    attachment={{ url: util.portraitYellowObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Image with landscape aspect ratio

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    i18n={util.i18n}
    status="delivered"
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="purple"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Image with landscape aspect ratio and caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    text="An interesting horizontal bar. It's art."
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="An interesting horizontal bar. It's art."
    i18n={util.i18n}
    status="delivered"
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="purple"
    text="An interesting horizontal bar. It's art."
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="An interesting horizontal bar. It's art."
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.landscapePurpleObjectUrl,
      contentType: 'image/gif',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Video with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    text="Beautiful, isn't it?"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="Beautiful, isn't it?"
    status="delivered"
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    text="Beautiful, isn't it?"
    collapseMetadata
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="Beautiful, isn't it?"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Video

We don't currently overlay message metadata on top of videos like we do with images.

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    status="delivered"
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Audio with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    text="This is a nice song"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="sent"
    text="This is a nice song"
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    text="This is a nice song"
    collapseMetadata
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="This is a nice song"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Audio

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    status="sent"
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    i18n={util.i18n}
    collapseMetadata
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

#### Voice message

Voice notes are not shown any differently from audio attachments.

#### Other file type with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    text="My manifesto is now complete!"
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="My manifesto is now complete!"
    status="sent"
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    direction="incoming"
    text="My manifesto is now complete!"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="My manifesto is now complete!"
    i18n={util.i18n}
    collapseMetadata
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    direction="incoming"
    text="My manifesto is now complete!"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName:
        'reallly_long_filename_because_it_needs_all_the_information.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="My manifesto is now complete!"
    i18n={util.i18n}
    collapseMetadata
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'filename_with_long_extension.the_txt_is_beautiful',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    text="My manifesto is now complete!"
    i18n={util.i18n}
    collapseMetadata
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'a_normal_four_letter_extension.jpeg',
      fileSize: '3.05 KB',
    }}
  />
</util.ConversationContext>
```

#### Other file type

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    color="green"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    i18n={util.i18n}
    status="sent"
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    color="green"
    direction="incoming"
    collapseMetadata
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
  <Message
    direction="outgoing"
    i18n={util.i18n}
    collapseMetadata
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
  />
</util.ConversationContext>
```

### In a group conversation

Note that the author avatar goes away if `collapseMetadata` is set.

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="pink"
    conversationType="group"
    authorPhoneNumber="(202) 555-0003"
    text="Just phone number"
    i18n={util.i18n}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="blue"
    conversationType="group"
    authorPhoneNumber="(202) 555-0003"
    authorProfileName="On🔥!"
    text="Phone number and profile name"
    i18n={util.i18n}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="deep_orange"
    conversationType="group"
    authorName="Mr. Fire"
    authorPhoneNumber="(202) 555-0003"
    authorProfileName="On🔥!"
    text="Just contact"
    i18n={util.i18n}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="purple"
    conversationType="group"
    authorName="Mr. Fire with a super-long name and that's just what's gonna happen. No doubt."
    authorPhoneNumber="(202) 555-0003"
    authorProfileName="On🔥!"
    text="Just contact"
    i18n={util.i18n}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    color="green"
    authorName="Mr. Fire"
    conversationType="group"
    direction="incoming"
    i18n={util.i18n}
    attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
    onClickAttachment={() => console.log('onClickAttachment')}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    color="green"
    conversationType="group"
    authorName="Mr. Fire"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp4ObjectUrl,
      contentType: 'video/mp4',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    color="green"
    conversationType="group"
    authorName="Mr. Fire"
    direction="incoming"
    i18n={util.i18n}
    attachment={{
      url: util.mp3ObjectUrl,
      contentType: 'audio/mp3',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="incoming"
    conversationType="group"
    color="red"
    authorName="Mr. Fire"
    text="My manifesto is now complete!"
    i18n={util.i18n}
    attachment={{
      url: util.txtObjectUrl,
      contentType: 'text/plain',
      fileName: 'my_manifesto.txt',
      fileSize: '3.05 KB',
    }}
    onClickAttachment={() => console.log('onClickAttachment')}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="deep_orange"
    conversationType="group"
    authorName="Mr. Fire"
    collapseMetadata
    authorPhoneNumber="(202) 555-0003"
    authorProfileName="On🔥!"
    text="No metadata and no author avatar"
    i18n={util.i18n}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    conversationType="group"
    authorPhoneNumber="(202) 555-0003"
    text="No contact, no avatar"
    i18n={util.i18n}
  />
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="deep_orange"
    conversationType="group"
    authorName="Mr. Fire"
    authorPhoneNumber="(202) 555-0003"
    text="Contact and color, but no avatar"
    i18n={util.i18n}
  />
  <Message
    direction="outgoing"
    color="pink"
    status="delivered"
    timestamp={Date.now()}
    conversationType="group"
    authorName="Not shown"
    text="Outgoing group messages look just like normal"
    i18n={util.i18n}
    authorAvatarPath={util.gifObjectUrl}
  />
</util.ConversationContext>
```
