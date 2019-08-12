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
      direction="outgoing"
      status="error"
      authorColor="purple"
      timestamp={Date.now() - 56}
      text="Error!"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      onRetrySend={() => console.log('onRetrySend')}
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
      direction="outgoing"
      status="error"
      authorColor="purple"
      timestamp={Date.now() - 57}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
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
  <li>
    <Message
      direction="incoming"
      status="error"
      authorColor="purple"
      timestamp={Date.now()}
      text="🔥"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
    />
  </li>
</util.ConversationContext>
```

### All colors

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="red"
      timestamp={Date.now()}
      text="This is red"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="deep_orange"
      timestamp={Date.now()}
      text="This is deep_orange"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="brown"
      timestamp={Date.now()}
      text="This is brown"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="pink"
      timestamp={Date.now()}
      text="This is pink"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="purple"
      timestamp={Date.now()}
      text="This is purple"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="indigo"
      timestamp={Date.now()}
      text="This is indigo"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="blue"
      timestamp={Date.now()}
      text="This is blue"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="teal"
      timestamp={Date.now()}
      text="This is teal"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="green"
      timestamp={Date.now()}
      text="This is green"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="light_green"
      timestamp={Date.now()}
      text="This is light_green"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="blue_grey"
      timestamp={Date.now()}
      text="This is blue_grey"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      status="delivered"
      authorColor="grey"
      timestamp={Date.now()}
      text="This is grey"
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
      authorColor="purple"
      direction="incoming"
      text="A really long link https://app.zeplin.io/project/5b2136b8e490ad6a54399857/screen/5b3bd068e03b763a0ee4c3e9"
      timestamp={Date.now()}
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="outgoing"
      status="delivered"
      text="A really long link https://app.zeplin.io/project/5b2136b8e490ad6a54399857/screen/5b3bd068e03b763a0ee4c3e9"
      timestamp={Date.now()}
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      text={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam efficitur finibus tellus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eu metus leo. Nullam consequat leo ut accumsan aliquam. In est elit, faucibus vel arcu vitae, dapibus egestas nunc. Curabitur nec orci semper, auctor justo ornare, sagittis massa. Aliquam ultrices sem ac ex vestibulum dapibus. Etiam erat purus, interdum sit amet magna vitae, elementum lacinia leo. Duis vel mauris dui. Morbi sed accumsan erat, at facilisis metus. Nullam molestie lectus eleifend congue ultrices. Nunc porta at justo semper egestas. Proin non iaculis nibh. Cras sit amet urna dignissim, venenatis arcu a, pulvinar ipsum.

      Integer et justo ut urna tempor ultrices. Lorem ipsum dolor sit amet, consectetur adipiscing elit. In bibendum a nulla non blandit. In iaculis id orci maximus elementum. Mauris ultricies ipsum et magna iaculis, non porta orci elementum. Curabitur ipsum magna, porttitor id cursus nec, euismod at orci. Sed et ex id neque hendrerit auctor sed et mauris. In hac habitasse platea dictumst.

      Aliquam erat volutpat. Mauris quis erat luctus enim tincidunt fringilla. Vestibulum ornare, erat sit amet pretium gravida, tortor ipsum pretium eros, ac congue mauris elit vel elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Maecenas ultrices neque vulputate, pellentesque massa non, imperdiet justo. Curabitur vel ex non enim volutpat fringilla. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. In gravida consectetur justo sit amet feugiat. Vivamus non eros dignissim, interdum magna at, suscipit mauris. Duis sit amet dui tempor, ornare arcu ultrices, convallis neque. Proin quis risus leo. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Nunc lectus sapien, feugiat sit amet orci nec, consectetur vehicula odio. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Maecenas porta scelerisque egestas.

      Fusce diam massa, lacinia sit amet vehicula vitae, pretium sed augue. Duis diam velit, efficitur eget fringilla vel, pharetra eu lacus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas et convallis tellus. Aenean in orci tincidunt, finibus nulla ut, aliquam quam. Nullam feugiat egestas urna, ultricies suscipit justo venenatis eget. Curabitur sollicitudin odio eu tincidunt porta. Nullam in metus in purus rutrum varius et sit amet nibh. Nunc at efficitur turpis, a tincidunt dolor.

      Nam non leo euismod, volutpat leo quis, semper orci. Proin malesuada ultrices ex, nec fringilla ante condimentum eu. Sed vel gravida nibh. Vivamus sed tincidunt sem. Phasellus arcu orci, condimentum nec fringilla ac, maximus a arcu. Mauris sit amet sodales nisl. Etiam molestie consequat auctor. Proin auctor pulvinar mi vitae consequat.

      Phasellus commodo viverra condimentum. Nam vitae facilisis nibh, dapibus eleifend nisl. Quisque eu massa nunc.`}
      timestamp={Date.now()}
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="outgoing"
      status="delivered"
      text={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam efficitur finibus tellus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eu metus leo. Nullam consequat leo ut accumsan aliquam. In est elit, faucibus vel arcu vitae, dapibus egestas nunc. Curabitur nec orci semper, auctor justo ornare, sagittis massa. Aliquam ultrices sem ac ex vestibulum dapibus. Etiam erat purus, interdum sit amet magna vitae, elementum lacinia leo. Duis vel mauris dui. Morbi sed accumsan erat, at facilisis metus. Nullam molestie lectus eleifend congue ultrices. Nunc porta at justo semper egestas. Proin non iaculis nibh. Cras sit amet urna dignissim, venenatis arcu a, pulvinar ipsum.

      Integer et justo ut urna tempor ultrices. Lorem ipsum dolor sit amet, consectetur adipiscing elit. In bibendum a nulla non blandit. In iaculis id orci maximus elementum. Mauris ultricies ipsum et magna iaculis, non porta orci elementum. Curabitur ipsum magna, porttitor id cursus nec, euismod at orci. Sed et ex id neque hendrerit auctor sed et mauris. In hac habitasse platea dictumst.

      Aliquam erat volutpat. Mauris quis erat luctus enim tincidunt fringilla. Vestibulum ornare, erat sit amet pretium gravida, tortor ipsum pretium eros, ac congue mauris elit vel elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Maecenas ultrices neque vulputate, pellentesque massa non, imperdiet justo. Curabitur vel ex non enim volutpat fringilla. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. In gravida consectetur justo sit amet feugiat. Vivamus non eros dignissim, interdum magna at, suscipit mauris. Duis sit amet dui tempor, ornare arcu ultrices, convallis neque. Proin quis risus leo. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Nunc lectus sapien, feugiat sit amet orci nec, consectetur vehicula odio. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Maecenas porta scelerisque egestas.

      Fusce diam massa, lacinia sit amet vehicula vitae, pretium sed augue. Duis diam velit, efficitur eget fringilla vel, pharetra eu lacus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas et convallis tellus. Aenean in orci tincidunt, finibus nulla ut, aliquam quam. Nullam feugiat egestas urna, ultricies suscipit justo venenatis eget. Curabitur sollicitudin odio eu tincidunt porta. Nullam in metus in purus rutrum varius et sit amet nibh. Nunc at efficitur turpis, a tincidunt dolor.

      Nam non leo euismod, volutpat leo quis, semper orci. Proin malesuada ultrices ex, nec fringilla ante condimentum eu. Sed vel gravida nibh. Vivamus sed tincidunt sem. Phasellus arcu orci, condimentum nec fringilla ac, maximus a arcu. Mauris sit amet sodales nisl. Etiam molestie consequat auctor. Proin auctor pulvinar mi vitae consequat.

      Phasellus commodo viverra condimentum. Nam vitae facilisis nibh, dapibus eleifend nisl. Quisque eu massa nunc.`}
      timestamp={Date.now()}
      i18n={util.i18n}
    />
  </li>
</util.ConversationContext>
```

### Pending long message download

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      textPending={true}
      text={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis fringilla nulla velit, id finibus orci porttitor at. Donec eget orci nunc. Fusce nisl arcu, porttitor eget eleifend id, malesuada et diam. Donec porta id magna vel egestas. Donec justo odio, dignissim ac lorem in, bibendum congue arcu. Sed aliquam, tortor non ultricies pretium, orci dui auctor augue, id efficitur orci erat a velit. Morbi efficitur ante quis ex malesuada, vitae eleifend risus dapibus. Donec sollicitudin justo sed viverra vulputate. Donec iaculis dolor velit, sit amet feugiat lacus gravida in. Lorem ipsum dolor sit amet, consectetur adipiscing elit.

      In commodo, lacus lacinia efficitur rutrum, purus neque aliquet turpis, ac tincidunt dolor quam vitae dolor. Vestibulum ultrices orci non finibus lobortis. Etiam in efficitur augue, at pulvinar diam. Praesent gravida erat vitae dolor varius, eu fermentum justo fermentum. Nullam feugiat orci ipsum, ut congue orci varius in. Duis arcu elit, mattis ac nisi at, hendrerit pretium magna. Quisque volutpat ipsum leo, at ultrices arcu rhoncus mattis. Quisque pellentesque nisl suscipit tempor aliquet. Quisque venenatis massa eget ex fermentum, et iaculis dui porttitor. Nam sed tortor tincidunt, eleifend diam vitae, facilisis erat. Suspendisse ornare justo molestie felis bibendum, non laoreet urna posuere. Ut in felis vel mauris commodo semper et non massa. Vivamus vitae sagittis est. Nullam faucibus justo metus, eget aliquet mi vestibulum sit amet.

      Nulla tincidunt dui non massa aliquam, nec luctus turpis dapibus. Duis sollicitudin consectetur justo ut volutpat. Suspendisse a consectetur ligula, nec rutrum felis. Curabitur neque lorem, finibus id molestie at, ultricies vel tortor. Praesent porttitor augue non magna blandit, quis pulvinar risus iaculis. Sed at lorem risus. Pellentesque laoreet odio et justo blandit dignissim. Curabitur eget venenatis leo, eget vehicula sem. Proin eros nisi, faucibus et malesuada a, porta id tortor. Etiam imperdiet eleifend commodo. Nunc at malesuada mi, vitae volutpat sema`}
      timestamp={Date.now()}
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="outgoing"
      status="delivered"
      textPending={true}
      text={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis fringilla nulla velit, id finibus orci porttitor at. Donec eget orci nunc. Fusce nisl arcu, porttitor eget eleifend id, malesuada et diam. Donec porta id magna vel egestas. Donec justo odio, dignissim ac lorem in, bibendum congue arcu. Sed aliquam, tortor non ultricies pretium, orci dui auctor augue, id efficitur orci erat a velit. Morbi efficitur ante quis ex malesuada, vitae eleifend risus dapibus. Donec sollicitudin justo sed viverra vulputate. Donec iaculis dolor velit, sit amet feugiat lacus gravida in. Lorem ipsum dolor sit amet, consectetur adipiscing elit.

      In commodo, lacus lacinia efficitur rutrum, purus neque aliquet turpis, ac tincidunt dolor quam vitae dolor. Vestibulum ultrices orci non finibus lobortis. Etiam in efficitur augue, at pulvinar diam. Praesent gravida erat vitae dolor varius, eu fermentum justo fermentum. Nullam feugiat orci ipsum, ut congue orci varius in. Duis arcu elit, mattis ac nisi at, hendrerit pretium magna. Quisque volutpat ipsum leo, at ultrices arcu rhoncus mattis. Quisque pellentesque nisl suscipit tempor aliquet. Quisque venenatis massa eget ex fermentum, et iaculis dui porttitor. Nam sed tortor tincidunt, eleifend diam vitae, facilisis erat. Suspendisse ornare justo molestie felis bibendum, non laoreet urna posuere. Ut in felis vel mauris commodo semper et non massa. Vivamus vitae sagittis est. Nullam faucibus justo metus, eget aliquet mi vestibulum sit amet.

      Nulla tincidunt dui non massa aliquam, nec luctus turpis dapibus. Duis sollicitudin consectetur justo ut volutpat. Suspendisse a consectetur ligula, nec rutrum felis. Curabitur neque lorem, finibus id molestie at, ultricies vel tortor. Praesent porttitor augue non magna blandit, quis pulvinar risus iaculis. Sed at lorem risus. Pellentesque laoreet odio et justo blandit dignissim. Curabitur eget venenatis leo, eget vehicula sem. Proin eros nisi, faucibus et malesuada a, porta id tortor. Etiam imperdiet eleifend commodo. Nunc at malesuada mi, vitae volutpat sema`}
      timestamp={Date.now()}
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
      authorColor="blue"
      direction="incoming"
      text="I am pretty confused about Pi."
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
    />
  </li>
  <li>
    <Message
      authorColor="blue"
      direction="outgoing"
      status="delivered"
      text="I am pretty confused about Pi."
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
      onDownload={() => console.log('onDownload')}
      onReply={() => console.log('onReply')}
    />
  </li>
  <li>
    <Message
      authorColor="blue"
      direction="outgoing"
      text="I am pretty confused about Pi."
      collapseMetadata
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Sticker

Stickers have no background, but they have all the standard message bubble features.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      timestamp={Date.now()}
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      expirationLength={60 * 1000}
      expirationTimestamp={Date.now() + 30 * 1000}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      authorName="Mr. Sticker"
      conversationType="group"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      authorName="Mr. Sticker (and a really long suffix, long long long long long)"
      conversationType="group"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      conversationType="group"
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Sticker with collapsed metadata

First set is in a 1:1 conversation, second set is in a group.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      collapseMetadata
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      collapseMetadata
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      authorName="Mr. Sticker"
      conversationType="group"
      collapseMetadata
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      conversationType="group"
      collapseMetadata
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.squareStickerObjectUrl,
          contentType: 'image/png',
          width: 128,
          height: 128,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Sticker with pending image

A sticker with no attachments (what our selectors produce for a pending sticker) is not displayed at all.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      collapseMetadata
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      collapseMetadata
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      isSticker={true}
      authorName="Mr. Sticker"
      conversationType="group"
      collapseMetadata
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      isSticker={true}
      conversationType="group"
      collapseMetadata
      status="sent"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Multiple images

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Multiple images with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Two images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Three images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Four images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Five images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Six images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="sent"
      authorColor="red"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="delivered"
      authorColor="blue"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      status="read"
      authorColor="purple"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Pending images

```
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      text="Hey there!"
      i18n={util.i18n}
      attachments={[
        {
          pending: true,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="sent"
      timestamp={Date.now()}
      text="Hey there!"
      i18n={util.i18n}
      attachments={[
        {
          pending: true,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Three images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          pending: true,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      text="Three images"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          pending: true,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  </util.ConversationContext>
```

#### Image with portrait aspect ratio

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="purple"
      direction="outgoing"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      text="This is an odd yellow bar. Cool, huh?"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="This is an odd yellow bar. Cool, huh?"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="This is an odd yellow bar. Cool, huh?"
      status="delivered"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="All notifications"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now() - 366 * 24 * 60 * 60 * 1000}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="All notifications"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now() - 366 * 24 * 60 * 60 * 1000}
      attachments={[
        {
          url: util.portraitYellowObjectUrl,
          contentType: 'image/gif',
          width: 20,
          height: 200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="delivered"
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="An interesting horizontal bar. It's art."
      i18n={util.i18n}
      timestamp={Date.now()}
      status="delivered"
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="An interesting horizontal bar. It's art."
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="An interesting horizontal bar. It's art."
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.landscapePurpleObjectUrl,
          contentType: 'image/gif',
          width: 200,
          height: 50,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          screenshot: {
            url: util.gifObjectUrl,
          },
          contentType: 'video/mp4',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="Beautiful, isn't it?"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          screenshot: {
            url: util.gifObjectUrl,
          },
          contentType: 'video/mp4',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="Beautiful, isn't it?"
      collapseMetadata
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="Beautiful, isn't it?"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="delivered"
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: null,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: null,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: null,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="Did something go wrong?"
      direction="outgoing"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: null,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          screenshot: {
            url: null,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      timestamp={Date.now()}
      i18n={util.i18n}
      status="delivered"
      attachments={[
        {
          screenshot: {
            url: null,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      text="Did something go wrong?"
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          screenshot: {
            url: null,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="Did something go wrong?"
      direction="outgoing"
      timestamp={Date.now()}
      i18n={util.i18n}
      status="delivered"
      attachments={[
        {
          screenshot: {
            url: null,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: 'nonexistent',
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="Did something go wrong?"
      direction="outgoing"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: 'nonexistent',
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          screenshot: {
            url: 'nonexistent',
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      timestamp={Date.now()}
      i18n={util.i18n}
      status="delivered"
      attachments={[
        {
          screenshot: {
            url: 'nonexistent',
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Image/video which is too big

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          width: 4097,
          height: 4096,
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          width: 4096,
          height: 4097,
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          height: 4096,
          width: 4097,
          screenshot: {
            url: util.gifObjectUrl,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      timestamp={Date.now()}
      i18n={util.i18n}
      status="delivered"
      attachments={[
        {
          height: 4097,
          width: 4096,
          screenshot: {
            url: util.gifObjectUrl,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Image/video missing height/width

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          height: 240,
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          fileName: 'image.gif',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      status="delivered"
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          width: 320,
          screenshot: {
            url: util.gifObjectUrl,
            width: 320,
            height: 240,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      timestamp={Date.now()}
      i18n={util.i18n}
      status="delivered"
      attachments={[
        {
          screenshot: {
            url: util.gifObjectUrl,
          },
          contentType: 'video/mp4',
          fileName: 'video.mp4',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      i18n={util.i18n}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="sent"
      text="This is a nice song"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      text="This is a nice song"
      collapseMetadata
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="This is a nice song"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      status="sent"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="My manifesto is now complete!"
      status="sent"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      text="My manifesto is now complete!"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="My manifesto is now complete!"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      text="My manifesto is now complete!"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName:
            'reallly_long_filename_because_it_needs_all_the_information.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="My manifesto is now complete!"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'filename_with_long_extension.the_txt_is_beautiful',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="My manifesto is now complete!"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'a_normal_four_letter_extension.jpeg',
          fileSize: '3.05 KB',
        },
      ]}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      collapseMetadata
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Other file type pending

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      text="My manifesto is now complete!"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          pending: true,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      text="My manifesto is now complete!"
      status="sent"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          pending: true,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          pending: true,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          pending: true,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
    />
  </li>
</util.ConversationContext>
```

#### Dangerous file type

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'blah.exe',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={isDangerous =>
        console.log('showVisualAttachment - isDangerous:', isDangerous)
      }
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'blah.exe',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={isDangerous =>
        console.log('showVisualAttachment - isDangerous:', isDangerous)
      }
    />
  </li>
</util.ConversationContext>
```

#### Link previews, full-size image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 800,
            height: 1200,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 800,
            height: 1200,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 800,
            height: 1200,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 800,
            height: 1200,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
</util.ConversationContext>
```

#### Link previews, stickers url

Sticker link previews are forced to use the small link preview form, no matter the image size.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://signal.org/addsticker/#pack_id=11111"
      previews={[
        {
          title: 'This is a really sweet post',
          isStickerPack: true,
          domain: 'instagram.com',
          image: {
            url: util.squareStickerObjectUrl,
            contentType: 'image/png',
            width: 512512,
            height: 512512,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      text="Pretty sweet link: https://signal.org/addsticker/#pack_id=11111"
      previews={[
        {
          title: 'This is a really sweet post',
          isStickerPack: true,
          domain: 'signal.org',
          image: {
            url: util.squareStickerObjectUrl,
            contentType: 'image/png',
            width: 512,
            height: 512,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
</util.ConversationContext>
```

#### Link previews, small image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 160,
            height: 120,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 160,
            height: 120,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title:
            'This is a really sweet post with a really long name. Gotta restrict that to just two lines, you know how that goes...',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 160,
            height: 120,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title:
            'This is a really sweet post with a really long name. Gotta restrict that to just two lines, you know how that goes...',
          domain: 'instagram.com',
          image: {
            url: util.pngObjectUrl,
            contentType: 'image/png',
            width: 160,
            height: 120,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
</util.ConversationContext>
```

#### Link previews with pending image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            pending: true,
            contentType: 'image/png',
            width: 800,
            height: 1200,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            pending: true,
            contentType: 'image/png',
            width: 800,
            height: 1200,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            pending: true,
            contentType: 'image/png',
            width: 160,
            height: 120,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            pending: true,
            contentType: 'image/png',
            width: 160,
            height: 120,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
</util.ConversationContext>
```

#### Link previews, no image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title:
            'This is a really sweet post with a really long name. Gotta restrict that to just two lines, you know how that goes...',
          domain: 'instagram.com',
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      direction="outgoing"
      i18n={util.i18n}
      timestamp={Date.now()}
      status="sent"
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title:
            'This is a really sweet post with a really long name. Gotta restrict that to just two lines, you know how that goes...',
          domain: 'instagram.com',
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
</util.ConversationContext>
```

### Tap to view

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="pink"
      conversationType="direct"
      authorPhoneNumber="(202) 555-0003"
      isTapToViewExpired={false}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId1"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="blue"
      isTapToViewExpired={true}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      conversationType="direct"
      i18n={util.i18n}
      id="messageId2"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      isTapToViewExpired={false}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId3"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      authorColor="blue"
      isTapToViewExpired={true}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      conversationType="group"
      i18n={util.i18n}
      id="messageId4"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      authorProfileName="A very long profile name which cannot be shown in its entirety, or maybe it can!"
      authorColor="blue"
      isTapToViewExpired={true}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      conversationType="group"
      i18n={util.i18n}
      id="messageId4"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      collapseMetadata={true}
      authorColor="blue"
      isTapToViewExpired={true}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      conversationType="direct"
      i18n={util.i18n}
      id="messageId5"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="red"
      status="delivered"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Not shown"
      isTapToViewExpired={false}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="green"
      status="read"
      collapseMetadata={true}
      timestamp={Date.now()}
      isTapToViewExpired={false}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId8"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="red"
      status="delivered"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Not shown"
      isTapToViewExpired={true}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="green"
      status="read"
      collapseMetadata={true}
      timestamp={Date.now()}
      isTapToViewExpired={true}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId8"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      isTapToViewExpired={false}
      isTapToView={true}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId3"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="blue"
      isTapToViewExpired={true}
      isTapToView={true}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId4"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="red"
      status="delivered"
      timestamp={Date.now()}
      isTapToViewExpired={false}
      isTapToView={true}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="outgoing"
      authorColor="red"
      status="delivered"
      timestamp={Date.now()}
      isTapToViewExpired={true}
      isTapToView={true}
      expirationLength={5 * 60 * 1000}
      expirationTimestamp={Date.now() + 5 * 60 * 1000}
      text="This should not be shown"
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      status="delivered"
      timestamp={Date.now()}
      isTapToViewExpired={false}
      isTapToView={true}
      text="This should not be shown"
      attachments={[
        {
          pending: true,
          contentType: 'image/gif',
        },
      ]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      status="delivered"
      timestamp={Date.now()}
      isTapToViewExpired={true}
      isTapToView={true}
      isTapToViewError={true}
      text="This should not be shown"
      attachments={[]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      status="delivered"
      conversationType="group"
      timestamp={Date.now()}
      isTapToViewExpired={true}
      isTapToView={true}
      isTapToViewError={true}
      text="This should not be shown"
      attachments={[]}
      i18n={util.i18n}
      id="messageId6"
      displayTapToViewMessage={(...args) =>
        console.log('displayTapToViewMessage', args)
      }
      authorAvatarPath={util.gifObjectUrl}
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
      collapseMetadata={true}
      timestamp={Date.now()}
      authorColor="pink"
      conversationType="group"
      authorPhoneNumber="(202) 555-0003"
      text="Collapsed metadata"
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.gifObjectUrl,
          contentType: 'image/gif',
          width: 320,
          height: 240,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          screenshot: {
            url: util.pngObjectUrl,
            width: 800,
            height: 1200,
          },
          contentType: 'video/mp4',
          width: 800,
          height: 1200,
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.mp3ObjectUrl,
          contentType: 'audio/mp3',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      timestamp={Date.now()}
      attachments={[
        {
          url: util.txtObjectUrl,
          contentType: 'text/plain',
          fileName: 'my_manifesto.txt',
          fileSize: '3.05 KB',
        },
      ]}
      showVisualAttachment={() => console.log('showVisualAttachment')}
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
      authorColor="green"
      authorName="Mr. Fire"
      conversationType="group"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
          image: {
            url: util.gifObjectUrl,
            contentType: 'image/gif',
            width: 320,
            height: 240,
          },
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
    />
  </li>
  <li>
    <Message
      authorColor="green"
      authorName="Mr. Fire"
      conversationType="group"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      text="Pretty sweet link: https://instagram.com/something"
      previews={[
        {
          title: 'This is a really sweet post',
          domain: 'instagram.com',
        },
      ]}
      onClickLinkPreview={url => console.log('onClickLinkPreview', url)}
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
