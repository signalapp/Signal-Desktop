### All newlines

```jsx
<AddNewLines text="\n\n\n" />
```

### Starting and ending with newlines

```jsx
<AddNewLines text="\nin between\n" />
```

### With newlines in the middle

```jsx
<AddNewLines text="Before \n\n after" />
```

### No newlines

```jsx
<AddNewLines text="This is the text" />
```

### Providing custom non-newline render function

```jsx
const renderNonNewLine = ({ text, key }) => (
  <span key={key}>This is my custom content!</span>
);
<AddNewLines
  text="\n first \n second \n"
  renderNonNewLine={renderNonNewLine}
/>;
```
