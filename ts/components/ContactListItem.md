#### It's me!

```jsx
<ContactListItem
  i18n={util.i18n}
  isMe
  name="Someone 🔥 Somewhere"
  phoneNumber="(202) 555-0011"
  verified
  profileName="🔥Flames🔥"
  avatarPath={util.gifObjectUrl}
  onClick={() => console.log('onClick')}
/>
```

#### With name and profile

Note the proper spacing between these two.

```jsx
<div>
  <ContactListItem
    i18n={util.i18n}
    name="Someone 🔥 Somewhere"
    phoneNumber="(202) 555-0011"
    profileName="🔥Flames🔥"
    avatarPath={util.gifObjectUrl}
    onClick={() => console.log('onClick')}
  />
  <ContactListItem
    i18n={util.i18n}
    name="Another ❄️ Yes"
    phoneNumber="(202) 555-0011"
    profileName="❄️Ice❄️"
    avatarPath={util.gifObjectUrl}
    onClick={() => console.log('onClick')}
  />
</div>
```

#### With name and profile, verified

```jsx
<ContactListItem
  i18n={util.i18n}
  name="Someone 🔥 Somewhere"
  phoneNumber="(202) 555-0011"
  profileName="🔥Flames🔥"
  verified
  avatarPath={util.gifObjectUrl}
  onClick={() => console.log('onClick')}
/>
```

#### With name and profile, no avatar

```jsx
<ContactListItem
  i18n={util.i18n}
  name="Someone 🔥 Somewhere"
  color="teal"
  phoneNumber="(202) 555-0011"
  profileName="🔥Flames🔥"
  onClick={() => console.log('onClick')}
/>
```

#### Profile, no name, no avatar

```jsx
<ContactListItem
  i18n={util.i18n}
  phoneNumber="(202) 555-0011"
  profileName="🔥Flames🔥"
  onClick={() => console.log('onClick')}
/>
```

#### Verified, profile, no name, no avatar

```jsx
<ContactListItem
  i18n={util.i18n}
  phoneNumber="(202) 555-0011"
  profileName="🔥Flames🔥"
  verified
  onClick={() => console.log('onClick')}
/>
```

#### No name, no profile, no avatar

```jsx
<ContactListItem
  i18n={util.i18n}
  phoneNumber="(202) 555-0011"
  onClick={() => console.log('onClick')}
/>
```

#### Verified, no name, no profile, no avatar

```jsx
<ContactListItem
  i18n={util.i18n}
  phoneNumber="(202) 555-0011"
  verified
  onClick={() => console.log('onClick')}
/>
```
