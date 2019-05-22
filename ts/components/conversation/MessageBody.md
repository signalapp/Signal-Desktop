### All components: emoji, links, newline

```jsx
<MessageBody
  text="Fire 🔥 http://somewhere.com\nSecond Line"
  i18n={util.i18n}
/>
```

### Jumbo emoji

```jsx
<MessageBody text="🔥" i18n={util.i18n} />
```

```jsx
<MessageBody text="🔥🔥" i18n={util.i18n} />
```

```jsx
<MessageBody text="🔥🔥🔥🔥" i18n={util.i18n} />
```

```jsx
<MessageBody text="🔥🔥🔥🔥🔥🔥🔥🔥" i18n={util.i18n} />
```

```jsx
<MessageBody text="🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥" i18n={util.i18n} />
```

```jsx
<MessageBody text="🔥 text disables jumbomoji" i18n={util.i18n} />
```

### Jumbomoji disabled

```jsx
<MessageBody text="🔥" disableJumbomoji={true} i18n={util.i18n} />
```

### Links disabled

```jsx
<MessageBody text="http://somewhere.com" disableLinks={true} i18n={util.i18n} />
```

### Emoji in link

```jsx
<MessageBody text="http://somewhere.com?s=🔥\nCool, huh?" i18n={util.i18n} />
```

### Text pending

```jsx
<MessageBody
  text="http://somewhere.com?s=🔥\nCool, huh?"
  textPending={true}
  i18n={util.i18n}
/>
```

### Text pending, disable links

```jsx
<MessageBody
  text="http://somewhere.com?s=🔥\nCool, huh?"
  textPending={true}
  disableLinks={true}
  i18n={util.i18n}
/>
```
