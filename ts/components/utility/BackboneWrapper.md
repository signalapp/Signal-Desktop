Rendering a real `Whisper.MessageView` using `<util.ConversationContext />` and
`<util.BackboneWrapper />`.

```jsx
const model = new Whisper.Message({
  type: 'outgoing',
  body: 'text',
  sent_at: Date.now() - 5000,
});
const View = Whisper.MessageView;
const options = {
  model,
};
<util.ConversationContext theme={util.theme}>
  <util.BackboneWrapper View={View} options={options} />
</util.ConversationContext>;
```
