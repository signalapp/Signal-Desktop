#### All Options

```jsx
<util.ConversationContext theme={util.theme}>
  <ConfirmationDialog
    i18n={util.i18n}
    onClose={() => console.log('onClose')}
    onAffirmative={() => console.log('onAffirmative')}
    affirmativeText="Affirm"
    onNegative={() => console.log('onNegative')}
    negativeText="Negate"
  >
    asdf child
  </ConfirmationDialog>
</util.ConversationContext>
```
