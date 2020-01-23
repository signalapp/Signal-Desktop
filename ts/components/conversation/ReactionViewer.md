### Reaction Viewer

#### Few Reactions

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <ReactionViewer
    i18n={util.i18n}
    reactions={[
      { emoji: '❤️', from: { id: '+14155552671', name: 'Amelia Briggs' } },
      { emoji: '👍', from: { id: '+14155552671', name: 'Joel Ferrari' } },
    ]}
  />
</util.ConversationContext>
```

#### Many Reactions

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <ReactionViewer
    i18n={util.i18n}
    reactions={[
      {
        emoji: '❤️',
        timestamp: 1,
        from: { id: '+14155552671', name: 'Ameila Briggs' },
      },
      {
        emoji: '❤️',
        timestamp: 2,
        from: { id: '+14155552672', name: 'Adam Burrel' },
      },
      {
        emoji: '❤️',
        timestamp: 3,
        from: { id: '+14155552673', name: 'Rick Owens' },
      },
      {
        emoji: '❤️',
        timestamp: 4,
        from: { id: '+14155552674', name: 'Bojack Horseman' },
      },
      {
        emoji: '❤️',
        timestamp: 4,
        from: { id: '+14155552675', name: 'Cayce Pollard' },
      },
      {
        emoji: '❤️',
        timestamp: 5,
        from: { id: '+14155552676', name: 'Foo McBarrington' },
      },
      {
        emoji: '❤️',
        timestamp: 6,
        from: { id: '+14155552677', name: 'Ameila Briggs' },
      },
      {
        emoji: '❤️',
        timestamp: 7,
        from: { id: '+14155552678', name: 'Adam Burrel' },
      },
      {
        emoji: '❤️',
        timestamp: 8,
        from: { id: '+14155552679', name: 'Rick Owens' },
      },
      {
        emoji: '👍',
        timestamp: 9,
        from: { id: '+14155552671', name: 'Adam Burrel' },
      },
      {
        emoji: '👎',
        timestamp: 10,
        from: { id: '+14155552671', name: 'Rick Owens' },
      },
      {
        emoji: '😂',
        timestamp: 11,
        from: { id: '+14155552671', name: 'Bojack Horseman' },
      },
      {
        emoji: '😮',
        timestamp: 12,
        from: { id: '+14155552671', name: 'Cayce Pollard' },
      },
      {
        emoji: '😢',
        timestamp: 13,
        from: { id: '+14155552671', name: 'Foo McBarrington' },
      },
      {
        emoji: '😡',
        timestamp: 14,
        from: { id: '+14155552671', name: 'Foo McBarrington' },
      },
    ]}
  />
</util.ConversationContext>
```

#### Name Overflow

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <ReactionViewer
    i18n={util.i18n}
    reactions={[
      {
        emoji: '❤️',
        from: { id: '+14155552671', name: 'Foo McBarringtonMcBazzingtonMcKay' },
      },
    ]}
  />
</util.ConversationContext>
```
