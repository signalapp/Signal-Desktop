#### Default

```jsx
<util.ConversationContext theme={util.theme}>
  <div
    style={{
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}
  >
    <EmojiButton
      i18n={util.i18n}
      onPickEmoji={e => console.log('onPickEmoji', e)}
      skinTone={0}
      onSetSkinTone={t => console.log('onSetSkinTone', t)}
      onClose={() => console.log('onClose')}
      recentEmojis={[
        'grinning',
        'grin',
        'joy',
        'rolling_on_the_floor_laughing',
        'smiley',
        'smile',
        'sweat_smile',
        'laughing',
        'wink',
        'blush',
        'yum',
        'sunglasses',
        'heart_eyes',
        'kissing_heart',
        'kissing',
        'kissing_smiling_eyes',
        'kissing_closed_eyes',
        'relaxed',
        'slightly_smiling_face',
        'hugging_face',
        'grinning_face_with_star_eyes',
        'thinking_face',
        'face_with_one_eyebrow_raised',
        'neutral_face',
        'expressionless',
        'no_mouth',
        'face_with_rolling_eyes',
        'smirk',
        'persevere',
        'disappointed_relieved',
        'open_mouth',
        'zipper_mouth_face',
      ]}
    />
  </div>
</util.ConversationContext>
```
