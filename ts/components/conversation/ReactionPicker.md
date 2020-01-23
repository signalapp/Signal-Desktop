### Reaction Picker

#### Base

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <ReactionPicker onPick={e => console.log(`Picked reaction: ${e}`)} />
</util.ConversationContext>
```

#### Selected

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  {['❤️', '👍', '👎', '😂', '😮', '😢', '😡'].map(e => (
    <div key={e} style={{ height: '100px' }}>
      <ReactionPicker
        selected={e}
        onPick={e => console.log(`Picked reaction: ${e}`)}
      />
    </div>
  ))}
</util.ConversationContext>
```
