#### With name and profile

```jsx
<div style={{ backgroundColor: 'gray', color: 'white' }}>
  <ContactName
    i18n={util.i18n}
    name="Someone 🔥 Somewhere"
    phoneNumber="+12025550011"
    profileName="🔥Flames🔥"
  />
</div>
```

#### Profile, no name

```jsx
<div style={{ backgroundColor: 'gray', color: 'white' }}>
  <ContactName
    i18n={util.i18n}
    phoneNumber="+12025550011"
    profileName="🔥Flames🔥"
  />
</div>
```

#### No name, no profile

```jsx
<div style={{ backgroundColor: 'gray', color: 'white' }}>
  <ContactName i18n={util.i18n} phoneNumber="+12025550011" />
</div>
```
