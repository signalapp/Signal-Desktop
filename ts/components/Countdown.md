#### New timer

```jsx
<div style={{ backgroundColor: 'darkgray' }}>
  <Countdown
    expiresAt={Date.now() + 10 * 1000}
    duration={10 * 1000}
    onComplete={() => console.log('onComplete - new timer')}
  />
</div>
```

#### Already started

```jsx
<div style={{ backgroundColor: 'darkgray' }}>
  <Countdown
    expiresAt={Date.now() + 10 * 1000}
    duration={30 * 1000}
    onComplete={() => console.log('onComplete - already started')}
  />
</div>
```
