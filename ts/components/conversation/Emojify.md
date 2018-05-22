### All emoji

```jsx
<Emojify text="🔥🔥🔥" i18n={util.i18n} />
```

### With skin color modifier

```jsx
<Emojify text="👍🏾" i18n={util.i18n} />
```

### With `sizeClass` provided

```jsx
<Emojify text="🔥" sizeClass="jumbo" i18n={util.i18n} />
```

```jsx
<Emojify text="🔥" sizeClass="large" i18n={util.i18n} />
```

```jsx
<Emojify text="🔥" sizeClass="medium" i18n={util.i18n} />
```

```jsx
<Emojify text="🔥" sizeClass="small" i18n={util.i18n} />
```

```jsx
<Emojify text="🔥" sizeClass="" i18n={util.i18n} />
```

### Starting and ending with emoji

```jsx
<Emojify text="🔥in between🔥" i18n={util.i18n} />
```

### With emoji in the middle

```jsx
<Emojify text="Before 🔥🔥 after" i18n={util.i18n} />
```

### No emoji

```jsx
<Emojify text="This is the text" i18n={util.i18n} />
```

### Providing custom non-link render function

```jsx
const renderNonEmoji = ({ text, key }) => (
  <span key={key}>This is my custom content</span>
);
<Emojify
  text="Before 🔥🔥 after"
  renderNonEmoji={renderNonEmoji}
  i18n={util.i18n}
/>;
```
