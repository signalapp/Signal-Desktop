#### Normal, no size

```jsx
<util.ConversationContext theme={util.theme}>
  <Spinner svgSize="normal" />
  <div style={{ backgroundColor: '#2090ea' }}>
    <Spinner svgSize="normal" />
  </div>
</util.ConversationContext>
```

#### Normal, with size

```jsx
<util.ConversationContext theme={util.theme}>
  <Spinner svgSize="normal" size="100px" />
  <div style={{ backgroundColor: '#2090ea' }}>
    <Spinner svgSize="normal" size="100px" />
  </div>
</util.ConversationContext>
```

#### Small, no size

```jsx
<util.ConversationContext theme={util.theme}>
  <Spinner svgSize="small" />
  <div style={{ backgroundColor: '#2090ea' }}>
    <Spinner svgSize="small" />
  </div>
</util.ConversationContext>
```

#### Small, sizes

```jsx
<util.ConversationContext theme={util.theme}>
  <Spinner svgSize="small" size="20px" />
  <div style={{ backgroundColor: '#2090ea' }}>
    <Spinner svgSize="small" size="20px" />
  </div>
  <Spinner svgSize="small" size="14px" />
  <div style={{ backgroundColor: '#2090ea' }}>
    <Spinner svgSize="small" size="14px" />
  </div>
</util.ConversationContext>
```
