DocumentListEntry example:

```js
<DocumentListEntry
  fileName="meow.jpg"
  fileSize={1024 * 1000 * 2}
  timestamp={Date.now()}
/>
<DocumentListEntry
  fileName="rickroll.wmv"
  fileSize={1024 * 1000 * 8}
  timestamp={Date.now() - 24 * 60 * 1000}
/>
<DocumentListEntry
  fileName="kitten.gif"
  fileSize={1024 * 1000 * 1.2}
  timestamp={Date.now() - 14 * 24 * 60 * 1000}
/>
```
