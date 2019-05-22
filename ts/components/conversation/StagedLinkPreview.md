#### Still loading

```jsx
<util.ConversationContext theme={util.theme}>
  <StagedLinkPreview
    isLoaded={false}
    onClose={() => console.log('onClose')}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

#### No image

```jsx
<util.ConversationContext theme={util.theme}>
  <StagedLinkPreview
    isLoaded={true}
    title="This is a super-sweet site"
    domain="instagram.com"
    onClose={() => console.log('onClose')}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

#### Image

```jsx
<util.ConversationContext theme={util.theme}>
  <StagedLinkPreview
    isLoaded={true}
    title="This is a super-sweet site"
    domain="instagram.com"
    image={{
      url: util.gifObjectUrl,
      contentType: 'image/gif',
    }}
    onClose={() => console.log('onClose')}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

#### Image, no title

```jsx
<util.ConversationContext theme={util.theme}>
  <StagedLinkPreview
    isLoaded={true}
    domain="instagram.com"
    image={{
      url: util.gifObjectUrl,
      contentType: 'image/gif',
    }}
    onClose={() => console.log('onClose')}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

#### No image, long title

```jsx
<util.ConversationContext theme={util.theme}>
  <StagedLinkPreview
    isLoaded={true}
    title="This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?"
    domain="instagram.com"
    onClose={() => console.log('onClose')}
    i18n={util.i18n}
  />
</util.ConversationContext>
```

#### Image, long title

```jsx
<util.ConversationContext theme={util.theme}>
  <StagedLinkPreview
    isLoaded={true}
    title="This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?"
    domain="instagram.com"
    image={{
      url: util.gifObjectUrl,
      contentType: 'image/gif',
    }}
    onClose={() => console.log('onClose')}
    i18n={util.i18n}
  />
</util.ConversationContext>
```
