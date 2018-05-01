DocumentListItem example:

```js
<DocumentListItem
  fileName="meow.jpg"
  fileSize={1024 * 1000 * 2}
  timestamp={Date.now()}
/>
<DocumentListItem
  fileName="rickroll.wmv"
  fileSize={1024 * 1000 * 8}
  timestamp={Date.now() - 24 * 60 * 1000}
/>
<DocumentListItem
  fileName="kitten.gif"
  fileSize={1024 * 1000 * 1.2}
  timestamp={Date.now() - 14 * 24 * 60 * 1000}
/>
```
