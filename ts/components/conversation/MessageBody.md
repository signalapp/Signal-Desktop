### Plain text

```jsx
<MessageBody text="Plain text message" />
```

```jsx
<MessageBody text="Plain text message\n\nWith a new line." />
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
<MessageBody text="With skin color modifier: 👍🏾" />
```

### Text and emoji

```jsx
<MessageBody text="Plain text 🔥message. With 🔥emoji🔥 sprinkled 🔥about" />
```

```jsx
<MessageBody text="🔥Message starting and ending with emoji🔥" />
```

### Links

```jsx
<MessageBody text="This before and after link. Before. https://somewhere.com After." />
```

```jsx
<MessageBody text="Link https://somewhere.com\nWhat do you think? How about this one? \n\nhttps://anotherlink.com" />
```

```jsx
<MessageBody text="Link https://somewhere.com\nWhat do you think? How about this one? \n\nhttps://anotherlink.com" />
```

```jsx
<MessageBody text="should not render as link:\nmailto:someone@somewhere.com\nftp://something.com\n//local/share\n\\local\share\n\nshould render as link:\ngithub.com\nhttps://blah.com" />
```
