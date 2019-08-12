#### Default

```jsx
<util.ConversationContext theme={util.theme}>
  <div style={{ minHeight: '500px', paddingTop: '450px' }}>
    <CompositionInput
      i18n={util.i18n}
      onSubmit={s => console.log('onSubmit', s)}
    />
  </div>
</util.ConversationContext>
```
