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
<MessageBody text="🔥" disableJumbomoji i18n={util.i18n} />
```

### Links disabled

```jsx
<MessageBody text="http://somewhere.com" disableLinks i18n={util.i18n} />
```
