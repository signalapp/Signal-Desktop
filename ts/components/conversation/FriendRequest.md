### Friend Requests

#### Parameters

| Name                 | Values                                       |
| -------------------- | -------------------------------------------- |
| text                 | string                                       |
| timestamp            | number                                       |
| direction            | 'outgoing' \| 'incoming                      |
| status               | 'sending' \| 'sent' \| 'read' \| 'delivered' |
| friendStatus         | 'pending' \| 'accepted' \| 'declined'        |
| i18n                 | Localizer                                    |
| onAccept             | function                                     |
| onDecline            | function                                     |
| onDeleteConversation | function                                     |
| onRetrySend          | function                                     |

#### Example

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios}>
  <li>
    <FriendRequest
      text="This is my friend request message!"
      timestamp={1567994022804}
      direction="outgoing"
      status="sending"
      friendStatus="pending"
      i18n={util.i18n}
      onAccept={() => console.log('Accepted friend request')}
      onDecline={() => console.log('Declined friend request')}
      onDeleteConversation={() => console.log('Delete conversation')}
      onRetrySend={() => console.log('Retry sending message')}
    />
  </li>
</util.ConversationContext>
```
