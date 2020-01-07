### Various sizes

```jsx
<util.ConversationContext theme={util.theme}>
  <Image
    height="200"
    width="199"
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="99"
    width="99"
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="99"
    width="99"
    url={util.pngObjectUrl}
    attachment={{ pending: true }}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### Various curved corners

```jsx
<util.ConversationContext theme={util.theme}>
  <Image
    height="149"
    width="149"
    curveTopLeft
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    curveTopRight
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    curveBottomLeft
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    curveBottomRight
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    curveBottomRight
    url={util.pngObjectUrl}
    attachment={{ pending: true }}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With bottom overlay

```jsx
<util.ConversationContext theme={util.theme}>
  <Image
    height="149"
    width="149"
    bottomOverlay
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    bottomOverlay
    curveBottomRight
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    bottomOverlay
    curveBottomLeft
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    bottomOverlay
    curveBottomLeft
    url={util.pngObjectUrl}
    attachment={{ pending: true }}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With play icon

```jsx
<util.ConversationContext theme={util.theme}>
  <Image
    height="200"
    width="199"
    playIconOverlay
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="149"
    width="149"
    playIconOverlay
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="99"
    width="99"
    playIconOverlay
    url={util.pngObjectUrl}
    attachment={{}}
    i18n={util.i18n}
  />
  <Image
    height="99"
    width="99"
    playIconOverlay
    url={util.pngObjectUrl}
    attachment={{ pending: true }}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

### With dark overlay and text

```jsx
<util.ConversationContext theme={util.theme}>
  <div>
    <Image
      height="200"
      width="199"
      darkOverlay
      attachment={{}}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="149"
      width="149"
      darkOverlay
      attachment={{}}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      darkOverlay
      attachment={{}}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      darkOverlay
      attachment={{ pending: true }}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
  </div>
  <hr />
  <div>
    <Image
      height="200"
      width="199"
      darkOverlay
      attachment={{}}
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="149"
      width="149"
      darkOverlay
      attachment={{}}
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      darkOverlay
      attachment={{}}
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      darkOverlay
      attachment={{ pending: true }}
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
  </div>
</util.ConversationContext>
```

### With caption

```jsx
<util.ConversationContext theme={util.theme}>
  <div>
    <Image
      height="200"
      width="199"
      attachment={{ caption: 'dogs playing' }}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="149"
      width="149"
      attachment={{ caption: 'dogs playing' }}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      attachment={{ caption: 'dogs playing' }}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      attachment={{ caption: 'dogs playing', pending: true }}
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
  </div>
  <hr />
  <div>
    <Image
      height="200"
      width="199"
      attachment={{ caption: 'dogs playing' }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="149"
      width="149"
      attachment={{ caption: 'dogs playing' }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      attachment={{ caption: 'dogs playing' }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      attachment={{ caption: 'dogs playing', pending: true }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
      i18n={util.i18n}
    />
  </div>
</util.ConversationContext>
```

### With top-right X and soft corners

```jsx
<util.ConversationContext theme={util.theme}>
  <div>
    <Image
      height="200"
      width="199"
      attachment={{}}
      closeButton={true}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="149"
      width="149"
      attachment={{}}
      closeButton={true}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      attachment={{}}
      closeButton={true}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      attachment={{ pending: true }}
      closeButton={true}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
  </div>
  <br />
  <div>
    <Image
      height="200"
      width="199"
      attachment={{}}
      closeButton={true}
      attachment={{ caption: 'dogs playing' }}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="149"
      width="149"
      attachment={{}}
      closeButton={true}
      attachment={{ caption: 'dogs playing' }}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      closeButton={true}
      attachment={{ caption: 'dogs playing' }}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
    <Image
      height="99"
      width="99"
      closeButton={true}
      attachment={{ caption: 'dogs playing', pending: true }}
      onClick={() => console.log('onClick')}
      onClickClose={attachment => console.log('onClickClose', attachment)}
      softCorners={true}
      url={util.gifObjectUrl}
      i18n={util.i18n}
    />
  </div>
</util.ConversationContext>
```

### No border, no background

```jsx
<util.ConversationContext theme={util.theme}>
  <div style={{ padding: '10px', backgroundColor: 'lightgrey' }}>
    <div>
      <Image
        height="512"
        width="512"
        noBorder={true}
        noBackground={true}
        attachment={{}}
        onClick={() => console.log('onClick')}
        onClickClose={attachment => console.log('onClickClose', attachment)}
        url={util.squareStickerObjectUrl}
        i18n={util.i18n}
      />
    </div>
    <div>
      <Image
        height="256"
        width="256"
        noBorder={true}
        noBackground={true}
        attachment={{}}
        onClick={() => console.log('onClick')}
        onClickClose={attachment => console.log('onClickClose', attachment)}
        url={util.squareStickerObjectUrl}
        i18n={util.i18n}
      />
    </div>
    <div>
      <Image
        height="128"
        width="128"
        noBorder={true}
        noBackground={true}
        attachment={{}}
        onClick={() => console.log('onClick')}
        onClickClose={attachment => console.log('onClickClose', attachment)}
        url={util.squareStickerObjectUrl}
        i18n={util.i18n}
      />
    </div>
  </div>
</util.ConversationContext>
```
