### All emoji

```jsx
<Emojify text="🔥🔥🔥" />
```

### With skin color modifier

```jsx
<Emojify text="👍🏾" />
```

### With `sizeClass` provided

```jsx
<Emojify text="🔥" sizeClass="jumbo" />
```

```jsx
<Emojify text="🔥" sizeClass="large" />
```

```jsx
<Emojify text="🔥" sizeClass="medium" />
```

```jsx
<Emojify text="🔥" sizeClass="small" />
```

```jsx
<Emojify text="🔥" sizeClass="" />
```

### Starting and ending with emoji

```jsx
<Emojify text="🔥in between🔥" />
```

### With emoji in the middle

```jsx
<Emojify text="Before 🔥🔥 after" />
```

### No emoji

```jsx
<Emojify text="This is the text" />
```

### Providing custom non-link render function

```jsx
const renderNonEmoji = ({ text, key }) => (
  <span key={key}>This is my custom content</span>
);
<Emojify text="Before 🔥🔥 after" renderNonEmoji={renderNonEmoji} />;
```
