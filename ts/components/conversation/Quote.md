### With a quotation, text-only replies

#### Plain text

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### With emoji

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="About 🔥six🔥"
    i18n={util.i18n}
    quote={{
      text: 'How many 🔥ferrets🔥 do you have?',
      attachments: [],
      authorName: 'Mr. 🔥Fire🔥',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="About 🔥six🔥"
    i18n={util.i18n}
    quote={{
      text: 'How many 🔥ferrets🔥 do you have?',
      attachments: [],
      authorName: 'Mr. 🔥Fire🔥',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Replies to you or yourself

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
      isFromMe: true,
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
      isFromMe: true,
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### In a group conversation

```jsx
<util.ConversationContext theme={util.theme} type="group">
  <Message
    direction="incoming"
    timestamp={Date.now()}
    conversationType="group"
    authorName="Mr. 🔥Fire🔥"
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    authorAvatarPath={util.gifObjectUrl}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    conversationType="group"
    authorName="Mr. 🔥Fire🔥"
    status="sending"
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    authorAvatarPath={util.gifObjectUrl}
  />
</util.ConversationContext>
```

#### A lot of text in quotation

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Woo, otters!"
    i18n={util.i18n}
    quote={{
      text:
        'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
        'After that, probably dogs. And then, you know, reptiles of all types. ' +
        'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
        'really smart.',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Woo, otters!"
    i18n={util.i18n}
    quote={{
      text:
        'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
        'After that, probably dogs. And then, you know, reptiles of all types. ' +
        'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
        'really smart.',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### A lot of text in quotation, with icon

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Woo, otters!"
    i18n={util.i18n}
    quote={{
      text:
        'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
        'After that, probably dogs. And then, you know, reptiles of all types. ' +
        'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
        'really smart.',
      attachments: [
        {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Woo, otters!"
    i18n={util.i18n}
    quote={{
      text:
        'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
        'After that, probably dogs. And then, you know, reptiles of all types. ' +
        'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
        'really smart.',
      attachments: [
        {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### A lot of text in quotation, with image

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Woo, otters!"
    i18n={util.i18n}
    quote={{
      text:
        'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
        'After that, probably dogs. And then, you know, reptiles of all types. ' +
        'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
        'really smart.',
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Woo, otters!"
    i18n={util.i18n}
    quote={{
      text:
        'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
        'After that, probably dogs. And then, you know, reptiles of all types. ' +
        'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
        'really smart.',
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Image with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Totally, it's a pretty unintuitive concept."
    i18n={util.i18n}
    quote={{
      text: 'I am pretty confused about Pi.',
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Totally, it's a pretty unintuitive concept."
    i18n={util.i18n}
    quote={{
      text: 'I am pretty confused about Pi.',
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Image

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Yeah, pi. Tough to wrap your head around."
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Yeah, pi. Tough to wrap your head around."
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Image with no thumbnail

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Yeah, pi. Tough to wrap your head around."
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Yeah, pi. Tough to wrap your head around."
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'image/gif',
          fileName: 'pi.gif',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Video with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Sweet the way the video sneaks up on you!"
    i18n={util.i18n}
    quote={{
      text: 'Check out this video I found!',
      attachments: [
        {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Sweet the way the video sneaks up on you!"
    i18n={util.i18n}
    quote={{
      text: 'Check out this video I found!',
      attachments: [
        {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Video

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Awesome!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Awesome!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Video with no thumbnail

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Awesome!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Awesome!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
          },
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Audio with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="I really like it!"
    i18n={util.i18n}
    quote={{
      text: 'Check out this beautiful song!',
      attachments: [
        {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="I really like it!"
    i18n={util.i18n}
    quote={{
      text: 'Check out this beautiful song!',
      attachments: [
        {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Audio

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="I really like it!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="I really like it!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
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
    author: '+12025550011',
    id: Date.now() - 1000,
    attachments: [
      {
        contentType: 'audio/mp3',
        fileName: 'agnus_dei.mp4',
      },
    ],
  },
});
const incoming = new Whisper.Message(
  Object.assign({}, outgoing.attributes, {
    source: '+12025550011',
    type: 'incoming',
    quote: Object.assign({}, outgoing.attributes.quote, {
      author: '+12025550005',
    }),
  })
);
const View = Whisper.MessageView;
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Thanks for letting me know!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
          // Note: generated from 'flags' attribute, proposed afternoon of
          //   4/6 in Quoted Replies group
          isVoiceMessage: true,
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Thanks for letting me know!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
          isVoiceMessage: true,
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>;
```

#### Other file type with caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="I can't read latin."
    i18n={util.i18n}
    quote={{
      text: 'This is my manifesto. Tell me what you think!',
      attachments: [
        {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="I can't read latin."
    i18n={util.i18n}
    quote={{
      text: 'This is my manifesto. Tell me what you think!',
      attachments: [
        {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Other file type

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    text="Sorry, I can't read latin!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    color="green"
    text="Sorry, I can't read latin!"
    i18n={util.i18n}
    quote={{
      attachments: [
        {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
      ],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

### With a quotation, including attachment

#### Quote, image attachment, and caption

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    attachment={{
      url: util.gifObjectUrl,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    attachment={{
      url: util.gifObjectUrl,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    color="green"
    text="About six"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Quote, image attachment

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    attachment={{
      url: util.gifObjectUrl,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    attachment={{
      url: util.gifObjectUrl,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    color="green"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Quote, portrait image attachment

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    attachment={{
      url: util.portraitYellowObjectUrl,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    attachment={{
      url: util.portraitYellowObjectUrl,
      fileName: 'pi.gif',
      contentType: 'image/gif',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    color="green"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Quote, video attachment

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    attachment={{
      url: util.mp4ObjectUrl,
      fileName: 'freezing_bubble.mp4',
      contentType: 'video/mp4',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    attachment={{
      url: util.mp4ObjectUrl,
      fileName: 'freezing_bubble.mp4',
      contentType: 'video/mp4',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    color="green"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Quote, audio attachment

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    attachment={{
      data: util.mp3ObjectUrl,
      fileName: 'agnus_dei.mp3',
      contentType: 'audio/mp3',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    attachment={{
      data: util.mp3ObjectUrl,
      fileName: 'agnus_dei.mp3',
      contentType: 'audio/mp3',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    color="green"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

#### Quote, file attachment

```jsx
<util.ConversationContext theme={util.theme}>
  <Message
    direction="incoming"
    timestamp={Date.now()}
    color="green"
    attachment={{
      data: util.txtObjectUrl,
      fileName: 'lorum_ipsum.txt',
      contentType: 'text/plain',
      fileSize: '3.05 KB',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
  <Message
    direction="outgoing"
    timestamp={Date.now()}
    status="sending"
    attachment={{
      data: util.txtObjectUrl,
      fileName: 'lorum_ipsum.txt',
      contentType: 'text/plain',
      fileSize: '3.05 KB',
    }}
    onClickQuote={() => console.log('onClickQuote')}
    color="green"
    i18n={util.i18n}
    quote={{
      text: 'How many ferrets do you have?',
      attachments: [],
      authorPhoneNumber: '(202) 555-0011',
    }}
    onClickQuote={() => console.log('onClickQuote')}
  />
</util.ConversationContext>
```

### In bottom bar

#### Plain text

```jsx
<div className={util.theme}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorTitle={util.ourNumber}
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={window.i18n}
    />
  </div>
</div>
```

#### With an icon

```jsx
<div className={util.theme}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorTitle={util.ourNumber}
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={window.i18n}
      attachments={[
        {
          contentType: 'image/jpeg',
          fileName: 'llama.jpg',
        },
      ]}
    />
  </div>
</div>
```

#### With an image

```jsx
<div className={util.theme}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorTitle={util.ourNumber}
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={window.i18n}
      attachments={[
        {
          contentType: 'image/gif',
          fileName: 'llama.gif',
          thumbnail: {
            objectUrl: util.gifObjectUrl,
          },
        },
      ]}
    />
  </div>
</div>
```

#### With a close button

```jsx
<div className={util.theme}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorTitle={util.ourNumber}
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      onClose={() => console.log('Close was clicked!')}
      i18n={window.i18n}
    />
  </div>
</div>
```

#### With a close button and icon

```jsx
<div className={util.theme}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorTitle={util.ourNumber}
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      onClose={() => console.log('Close was clicked!')}
      i18n={window.i18n}
      attachments={[
        {
          contentType: 'image/jpeg',
          fileName: 'llama.jpg',
        },
      ]}
    />
  </div>
</div>
```

#### With a close button and image

```jsx
<div className={util.theme}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorTitle={util.ourNumber}
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      onClose={() => console.log('Close was clicked!')}
      i18n={window.i18n}
      attachments={[
        {
          contentType: 'image/gif',
          fileName: 'llama.gif',
          thumbnail: {
            objectUrl: util.gifObjectUrl,
          },
        },
      ]}
    />
  </div>
</div>
```
