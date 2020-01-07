### All major transitions: Extended

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

<div>
  <div>
    {"500ms ago - all below 1 minute are 'now' -- "}
    <Timestamp extended={true} timestamp={Date.now() - 500} i18n={util.i18n} />
  </div>
  <div>
    {'Five seconds ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 5 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'30 seconds ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 30 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'One minute ago - in minutes -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'30 minutes ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 30 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'45 minutes ago (used to round up to 1 hour with moment) -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 45 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'One hour ago - in hours -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'12:01am today -- '}
    <Timestamp extended={true} timestamp={get1201()} i18n={util.i18n} />
  </div>
  <div>
    {'11:59pm yesterday - adds day name -- '}
    <Timestamp
      extended={true}
      timestamp={getYesterday1159()}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'24 hours ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'Two days ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 2 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'Seven days ago - adds month -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 7 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'Thirty days ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 30 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'January 1st at 12:01am -- '}
    <Timestamp extended={true} timestamp={getJanuary1201()} i18n={util.i18n} />
  </div>
  <div>
    {'December 31st at 11:59pm - adds year -- '}
    <Timestamp extended={true} timestamp={getDecember1159()} i18n={util.i18n} />
  </div>
  <div>
    {'One year ago -- '}
    <Timestamp
      extended={true}
      timestamp={Date.now() - 366 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
</div>;
```

### All major transitions: Normal

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

<div>
  <div>
    {"500ms ago - all below 1 minute are 'now' -- "}
    <Timestamp timestamp={Date.now() - 500} i18n={util.i18n} />
  </div>
  <div>
    {'Five seconds ago -- '}
    <Timestamp timestamp={Date.now() - 5 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'30 seconds ago -- '}
    <Timestamp timestamp={Date.now() - 30 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'One minute ago - in minutes -- '}
    <Timestamp timestamp={Date.now() - 60 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'30 minutes ago -- '}
    <Timestamp timestamp={Date.now() - 30 * 60 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'45 minutes ago (used to round up to 1 hour with moment) -- '}
    <Timestamp timestamp={Date.now() - 45 * 60 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'One hour ago - in hours -- '}
    <Timestamp timestamp={Date.now() - 60 * 60 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'12:01am today -- '}
    <Timestamp timestamp={get1201()} i18n={util.i18n} />
  </div>
  <div>
    {'11:59pm yesterday - adds day name -- '}
    <Timestamp timestamp={getYesterday1159()} i18n={util.i18n} />
  </div>
  <div>
    {'24 hours ago -- '}
    <Timestamp timestamp={Date.now() - 24 * 60 * 60 * 1000} i18n={util.i18n} />
  </div>
  <div>
    {'Two days ago -- '}
    <Timestamp
      timestamp={Date.now() - 2 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'Seven days ago - adds month -- '}
    <Timestamp
      timestamp={Date.now() - 7 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'Thirty days ago -- '}
    <Timestamp
      timestamp={Date.now() - 30 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
  <div>
    {'January 1st at 12:01am -- '}
    <Timestamp timestamp={getJanuary1201()} i18n={util.i18n} />
  </div>
  <div>
    {'December 31st at 11:59pm - adds year -- '}
    <Timestamp timestamp={getDecember1159()} i18n={util.i18n} />
  </div>
  <div>
    {'One year ago -- '}
    <Timestamp
      timestamp={Date.now() - 366 * 24 * 60 * 60 * 1000}
      i18n={util.i18n}
    />
  </div>
</div>;
```
