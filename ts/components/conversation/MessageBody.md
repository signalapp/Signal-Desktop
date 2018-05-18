### All components: emoji, links, newline

```jsx
<MessageBody text="Fire 🔥 http://somewhere.com\nSecond Line" />
```

### Jumbo emoji

```jsx
<MessageBody text="🔥" />
```

```jsx
<MessageBody text="🔥🔥" />
```

```jsx
<MessageBody text="🔥🔥🔥🔥" />
```

```jsx
<MessageBody text="🔥🔥🔥🔥🔥🔥🔥🔥" />
```

```jsx
<MessageBody text="🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥" />
```

```jsx
<MessageBody text="🔥 text disables jumbomoji" />
```

### Jumbomoji disabled

```jsx
<MessageBody text="🔥" disableJumbomoji />
```

### Links disabled

```jsx
<MessageBody text="http://somewhere.com" disableLinks />
```
