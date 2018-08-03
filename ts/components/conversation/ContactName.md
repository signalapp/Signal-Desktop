#### Number, name and profile

```jsx
<ContactName
  i18n={util.i18n}
  name="Someone 🔥 Somewhere"
  phoneNumber="(202) 555-0011"
  profileName="🔥Flames🔥"
/>
```

#### Number and profile, no name

```jsx
<ContactName
  i18n={util.i18n}
  phoneNumber="(202) 555-0011"
  profileName="🔥Flames🔥"
/>
```

#### No name, no profile

```jsx
<ContactName i18n={util.i18n} phoneNumber="(202) 555-0011" />
```
