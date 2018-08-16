### Plain messages

Note that timestamp and status can be hidden with the `collapseMetadata` boolean property.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorPhoneNumber="(202) 555-2001"
      authorColor="green"
      text="🔥"
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Hello there from the new world! http://somewhere.com"
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      collapseMetadata
      direction="incoming"
      timestamp={Date.now()}
      authorColor="red"
      text="Hello there from the new world!"
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="grey"
      text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="deep_orange"
      timestamp={Date.now()}
      collapseMetadata
      text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sent"
      authorColor="pink"
      text="🔥"
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="read"
      authorColor="pink"
      text="Hello there from the new world! http://somewhere.com"
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      collapseMetadata
      direction="outgoing"
      status="sent"
      timestamp={Date.now()}
      text="Hello there from the new world! 🔥"
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      timestamp={Date.now()}
      authorColor="blue"
      text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="read"
      timestamp={Date.now()}
      collapseMetadata
      text="Hello there from the new world! And this is multiple lines of text. Lines and lines and lines."
      i18n={util.i18n}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
      onShowDetail={() => console.log('onShowDetail')}
      onDelete={() => console.log('onDelete')}
    />
  </li>
</util.ConversationContext>
```

### Status

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      direction="outgoing"
      status="sending"
      authorColor="pink"
      timestamp={Date.now()}
      text="This is still sending."
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      authorColor="red"
      timestamp={Date.now()}
      text="This has been successfully sent!"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      authorColor="blue"
      timestamp={Date.now()}
      text="This has been delivered!"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="read"
      authorColor="purple"
      timestamp={Date.now()}
      text="This has been read!"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="error"
      authorColor="purple"
      timestamp={Date.now() - 56}
      text="Error!"
      i18n={util.i18n}
      onRetrySend={() => console.log('onRetrySend')}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="error"
      authorColor="purple"
      timestamp={Date.now()}
      text="Error!"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sending"
      authorColor="pink"
      timestamp={Date.now()}
      text="🔥"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      authorColor="red"
      timestamp={Date.now()}
      text="🔥"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      authorColor="blue"
      timestamp={Date.now()}
      text="🔥"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="read"
      authorColor="purple"
      timestamp={Date.now()}
      text="🔥"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="error"
      authorColor="purple"
      timestamp={Date.now() - 57}
      text="🔥"
      i18n={util.i18n}
      onRetrySend={() => console.log('onRetrySend')}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="error"
      authorColor="purple"
      timestamp={Date.now()}
      text="🔥"
      i18n={util.i18n}
    />
  </li>
</util.ConversationContext>
```

### Long data

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="A really long link https://app.zeplin.io/project/5b2136b8e490ad6a54399857/screen/5b3bd068e03b763a0ee4c3e9"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="A really long link https://app.zeplin.io/project/5b2136b8e490ad6a54399857/screen/5b3bd068e03b763a0ee4c3e9"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum eget condimentum tellus. Aenean vulputate, dui a gravida rhoncus, mi orci varius urna, ut placerat felis ex ac elit. In pulvinar quis velit convallis varius. Quisque mattis, metus id lobortis porttitor, lacus ex laoreet dui, sit amet laoreet massa leo sed tellus. Phasellus iaculis pulvinar bibendum. In vitae imperdiet felis. Vivamus lacinia eros nec arcu varius, sodales faucibus nulla molestie. Etiam luctus lectus sit amet nulla facilisis, a porta mi tempus. Donec sit amet convallis ipsum.

      In eros risus, posuere non viverra at, finibus ac elit. Nunc convallis vulputate risus. Donec ligula justo, lacinia id vulputate in, semper non nibh. Interdum et malesuada fames ac ante ipsum primis in faucibus. Pellentesque porttitor neque a metus dapibus varius. Sed luctus purus vel semper rhoncus. In imperdiet risus ut convallis porttitor. Fusce vel ligula placerat, imperdiet ante vel, mollis ipsum.

      Etiam ultricies tortor eget mi sollicitudin suscipit. Nullam non ligula lacinia, ornare tortor in, tempor enim. Nullam nec ullamcorper enim. Vestibulum aliquet leo eget nisl aliquet vulputate. Duis quis nisl ligula. Nunc pulvinar lacus urna. Morbi imperdiet tortor eu finibus dictum. Cras ullamcorper aliquet eros, non malesuada tellus cursus eget.

      Cras sagittis, sapien vel gravida pellentesque, sem sem semper velit, vel congue ligula leo aliquet massa. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Curabitur eros diam, tempor sed lacus non, commodo imperdiet quam. Praesent eget tristique lectus, sit amet iaculis felis. Morbi molestie dui blandit augue vulputate tempus. Nulla facilisi. Nulla dictum felis eu nulla rhoncus, sed ultricies est scelerisque. Nam risus arcu, sodales at nisl eget, volutpat elementum lacus. Morbi dictum condimentum lorem, at placerat nulla eleifend a. Vestibulum hendrerit diam vulputate, sollicitudin urna vel, luctus nisl. Mauris semper sem quam, sed venenatis quam convallis in. Donec hendrerit, nibh ut mattis congue, quam nibh consectetur magna, eu posuere urna orci et turpis. Integer vitae arcu vitae est varius maximus. Sed ultrices tortor lacus, venenatis pulvinar nibh ullamcorper sit amet. Nulla vehicula metus sed diam gravida auctor sed cursus enim. Curabitur viverra non erat et mollis.`}
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum eget condimentum tellus. Aenean vulputate, dui a gravida rhoncus, mi orci varius urna, ut placerat felis ex ac elit. In pulvinar quis velit convallis varius. Quisque mattis, metus id lobortis porttitor, lacus ex laoreet dui, sit amet laoreet massa leo sed tellus. Phasellus iaculis pulvinar bibendum. In vitae imperdiet felis. Vivamus lacinia eros nec arcu varius, sodales faucibus nulla molestie. Etiam luctus lectus sit amet nulla facilisis, a porta mi tempus. Donec sit amet convallis ipsum.

      In eros risus, posuere non viverra at, finibus ac elit. Nunc convallis vulputate risus. Donec ligula justo, lacinia id vulputate in, semper non nibh. Interdum et malesuada fames ac ante ipsum primis in faucibus. Pellentesque porttitor neque a metus dapibus varius. Sed luctus purus vel semper rhoncus. In imperdiet risus ut convallis porttitor. Fusce vel ligula placerat, imperdiet ante vel, mollis ipsum.

      Etiam ultricies tortor eget mi sollicitudin suscipit. Nullam non ligula lacinia, ornare tortor in, tempor enim. Nullam nec ullamcorper enim. Vestibulum aliquet leo eget nisl aliquet vulputate. Duis quis nisl ligula. Nunc pulvinar lacus urna. Morbi imperdiet tortor eu finibus dictum. Cras ullamcorper aliquet eros, non malesuada tellus cursus eget.

      Cras sagittis, sapien vel gravida pellentesque, sem sem semper velit, vel congue ligula leo aliquet massa. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Curabitur eros diam, tempor sed lacus non, commodo imperdiet quam. Praesent eget tristique lectus, sit amet iaculis felis. Morbi molestie dui blandit augue vulputate tempus. Nulla facilisi. Nulla dictum felis eu nulla rhoncus, sed ultricies est scelerisque. Nam risus arcu, sodales at nisl eget, volutpat elementum lacus. Morbi dictum condimentum lorem, at placerat nulla eleifend a. Vestibulum hendrerit diam vulputate, sollicitudin urna vel, luctus nisl. Mauris semper sem quam, sed venenatis quam convallis in. Donec hendrerit, nibh ut mattis congue, quam nibh consectetur magna, eu posuere urna orci et turpis. Integer vitae arcu vitae est varius maximus. Sed ultrices tortor lacus, venenatis pulvinar nibh ullamcorper sit amet. Nulla vehicula metus sed diam gravida auctor sed cursus enim. Curabitur viverra non erat et mollis.`}
      i18n={util.i18n}
    />
  </li>
</util.ConversationContext>
```

### With an attachment

#### Image with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="cyan"
      direction="incoming"
      text="I am pretty confused about Pi."
      i18n={util.i18n}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="I am pretty confused about Pi."
      i18n={util.i18n}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
    />
  </li>
  <li>
    <Message
      authorColor="blue"
      direction="incoming"
      text="I am pretty confused about Pi."
      collapseMetadata
      i18n={util.i18n}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      text="I am pretty confused about Pi."
      collapseMetadata
      i18n={util.i18n}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
    />
  </li>
</util.ConversationContext>
```

#### Image

First, showing the metadata overlay on dark and light images, then a message with `collapseMetadata` set.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      collapseMetadata
      status="sent"
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Outgoing image with status

Note that the delivered indicator is always Signal Blue, not the conversation color.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      direction="outgoing"
      status="sending"
      authorColor="pink"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      authorColor="red"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      authorColor="blue"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="read"
      authorColor="purple"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachment={{ url: util.pngObjectUrl, contentType: 'image/png' }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Image with portrait aspect ratio

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Image with portrait aspect ratio and caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      text="This is an odd yellow bar. Cool, huh?"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      text="This is an odd yellow bar. Cool, huh?"
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      text="This is an odd yellow bar. Cool, huh?"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      text="This is an odd yellow bar. Cool, huh?"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        url: util.portraitYellowObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Image with landscape aspect ratio

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        url: util.landscapePurpleObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        url: util.landscapePurpleObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
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
  </li>
</util.ConversationContext>
```

#### Image with landscape aspect ratio and caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      text="An interesting horizontal bar. It's art."
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        url: util.landscapePurpleObjectUrl,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="purple"
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
  </li>
  <li>
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
  </li>
</util.ConversationContext>
```

#### Video with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      text="Beautiful, isn't it?"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.gifObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      text="Beautiful, isn't it?"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.gifObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="Beautiful, isn't it?"
      collapseMetadata
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      text="Beautiful, isn't it?"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Video

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      i18n={util.i18n}
      status="delivered"
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Missing images and videos

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: null,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: null,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: null,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: null,
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: null,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      i18n={util.i18n}
      status="delivered"
      attachment={{
        screenshot: {
          url: null,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: null,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      direction="outgoing"
      i18n={util.i18n}
      status="delivered"
      attachment={{
        screenshot: {
          url: null,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Broken source URL images and videos

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: 'nonexistent',
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: 'nonexistent',
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: 'nonexistent',
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        url: 'nonexistent',
        contentType: 'image/gif',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: 'nonexistent',
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      i18n={util.i18n}
      status="delivered"
      attachment={{
        screenshot: {
          url: 'nonexistent',
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: 'nonexistent',
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      direction="outgoing"
      i18n={util.i18n}
      status="delivered"
      attachment={{
        screenshot: {
          url: 'nonexistent',
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Audio with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      text="This is a nice song"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        url: util.mp3ObjectUrl,
        contentType: 'audio/mp3',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
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
  </li>
</util.ConversationContext>
```

#### Audio

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        url: util.mp3ObjectUrl,
        contentType: 'audio/mp3',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      attachment={{
        url: util.mp3ObjectUrl,
        contentType: 'audio/mp3',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
    />
  </li>
  <li>
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
  </li>
</util.ConversationContext>
```

#### Voice message

Voice notes are not shown any differently from audio attachments.

#### Other file type with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
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
  </li>
  <li>
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
  </li>
</util.ConversationContext>
```

#### Other file type

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
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
  </li>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
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
  </li>
</util.ConversationContext>
```

### In a group conversation

Note that the author avatar goes away if `collapseMetadata` is set.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="pink"
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      text="Just phone number"
      i18n={util.i18n}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="blue"
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      authorProfileName="On🔥!"
      text="Phone number and profile name"
      i18n={util.i18n}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="deep_orange"
      conversationType="group"
      authorName="Mr. Fire"
      authorPhoneNumber="(202) 555-0003"
      authorProfileName="On🔥!"
      text="Just contact"
      i18n={util.i18n}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="purple"
      conversationType="group"
      authorName="Mr. Fire with a super-long name and that's just what's gonna happen. No doubt."
      authorPhoneNumber="(202) 555-0003"
      authorProfileName="On🔥!"
      text="Just contact"
      i18n={util.i18n}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      authorName="Mr. Fire"
      conversationType="group"
      direction="incoming"
      i18n={util.i18n}
      attachment={{ url: util.gifObjectUrl, contentType: 'image/gif' }}
      onClickAttachment={() => console.log('onClickAttachment')}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      conversationType="group"
      authorName="Mr. Fire"
      direction="incoming"
      i18n={util.i18n}
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
        },
        contentType: 'video/mp4',
      }}
      onClickAttachment={() => console.log('onClickAttachment')}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      authorColor="green"
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
  </li>
  <li>
    <Message
      direction="incoming"
      conversationType="group"
      authorColor="red"
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
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="deep_orange"
      conversationType="group"
      authorName="Mr. Fire"
      collapseMetadata
      authorPhoneNumber="(202) 555-0003"
      authorProfileName="On🔥!"
      text="No metadata and no author avatar -- collapsed metadata"
      i18n={util.i18n}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      text="No contact, no avatar"
      authorColor="grey"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="deep_orange"
      conversationType="group"
      authorName="Mr. Fire"
      authorPhoneNumber="(202) 555-0003"
      authorColor="teal"
      text="Contact and color, but no avatar"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="pink"
      status="delivered"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Not shown"
      text="Outgoing group messages look just like normal"
      i18n={util.i18n}
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
</util.ConversationContext>
```
