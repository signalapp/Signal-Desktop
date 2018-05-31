### All link

```jsx
<Linkify text="https://somewhere.com" />
```

### Starting and ending with link

```jsx
<Linkify text="https://somewhere.com Yes? No? https://anotherlink.com" />
```

### With a link in the middle

```jsx
<Linkify text="Before. https://somewhere.com After." />
```

### No link

```jsx
<Linkify text="Plain text" />
```

### Should not render as link

```jsx
<Linkify text="smailto:someone@somewhere.com - ftp://something.com - //local/share - \\local\share" />
```

### Should render as link

```jsx
<Linkify text="github.com - https://blah.com" />
```

### Providing custom non-link render function

```jsx
const renderNonLink = ({ text, key }) => (
  <span key={key}>This is my custom non-link content!</span>
);
<Linkify text="Before github.com After" renderNonLink={renderNonLink} />;
```
