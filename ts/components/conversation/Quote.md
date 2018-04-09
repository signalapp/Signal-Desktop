
This is Reply.md.

```jsx
const model = new Whisper.Message({
  type: 'outgoing',
  body: 'text',
  sent_at: Date.now() - 18000000,
})
const View = Whisper.MessageView;
const options = {
  model,
};
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper
    View={View}
    options={options}
  />
</util.ConversationContext>
```
