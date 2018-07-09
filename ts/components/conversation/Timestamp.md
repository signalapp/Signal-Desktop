### All major transitions

```jsx
function get1201() {
  const d = new Date();
  d.setHours(0, 0, 1, 0);
  return d.getTime();
}
function getYesterday1159() {
  return get1201() - 2 * 60 * 1000;
}
function getJanuary1201() {
  const now = new Date();
  const d = new Date(now.getFullYear(), 0, 1, 0, 1);
  return d.getTime();
}
function getDecember1159() {
  return getJanuary1201() - 2 * 60 * 1000;
}

<util.ConversationContext theme={util.theme}>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      timestamp={Date.now() - 500}
      text="500ms ago - all below 1 minute are 'now'"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 5 * 1000}
      text="Five seconds ago"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 30 * 1000}
      text="30 seconds ago"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      timestamp={Date.now() - 60 * 1000}
      text="One minute ago - in minutes"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 30 * 60 * 1000}
      text="30 minutes ago"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 45 * 60 * 1000}
      text="45 minutes ago (used to round up to 1 hour with moment)"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      timestamp={Date.now() - 60 * 60 * 1000}
      text="One hour ago - in hours"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={get1201()}
      text="12:01am today"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      timestamp={getYesterday1159()}
      text="11:59pm yesterday - adds day name"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 24 * 60 * 60 * 1000}
      text="24 hours ago"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 2 * 24 * 60 * 60 * 1000}
      text="Two days ago"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      timestamp={Date.now() - 7 * 24 * 60 * 60 * 1000}
      text="Seven days ago - adds month"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 30 * 24 * 60 * 60 * 1000}
      text="Thirty days ago"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={getJanuary1201()}
      text="January 1st at 12:01am"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="red"
      timestamp={getDecember1159()}
      text="December 31st at 11:59pm - adds year"
      i18n={util.i18n}
    />
  </li>
  <li>
    <Message
      direction="incoming"
      authorColor="teal"
      timestamp={Date.now() - 366 * 24 * 60 * 60 * 1000}
      text="One year ago"
      i18n={util.i18n}
    />
  </li>
</util.ConversationContext>;
```
