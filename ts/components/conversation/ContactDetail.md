### With all data types

```jsx
const contact = {
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 3,
    },
    {
      value: '(202) 555-0001',
      type: 4,
      label: 'My favorite custom label',
    },
  ],
  email: [
    {
      value: 'someone@somewhere.com',
      type: 2,
    },

    {
      value: 'someone2@somewhere.com',
      type: 4,
      label: 'My second-favorite custom label',
    },
  ],
  address: [
    {
      street: '5 Pike Place',
      city: 'Seattle',
      region: 'WA',
      postcode: '98101',
      type: 1,
    },
    {
      street: '10 Pike Place',
      pobox: '3242',
      neighborhood: 'Downtown',
      city: 'Seattle',
      region: 'WA',
      postcode: '98101',
      country: 'United States',
      type: 3,
      label: 'My favorite spot!',
    },
  ],
};
<ContactDetail
  contact={contact}
  hasSignalAccount={true}
  i18n={util.i18n}
  onSendMessage={() => console.log('onSendMessage')}
/>;
```

### With missing custom labels

```jsx
const contact = {
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 4,
    },
  ],
  email: [
    {
      value: 'someone2@somewhere.com',
      type: 4,
    },
  ],
  address: [
    {
      street: '10 Pike Place, Seattle WA',
      type: 3,
    },
  ],
};
<ContactDetail
  contact={contact}
  hasSignalAccount={true}
  i18n={util.i18n}
  onSendMessage={() => console.log('onSendMessage')}
/>;
```

### With default avatar

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
};
<ContactDetail
  contact={contact}
  hasSignalAccount={true}
  i18n={util.i18n}
  onSendMessage={() => console.log('onSendMessage')}
/>;
```

### Without a Signal account

```jsx
const contact = {
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0001',
      type: 1,
    },
  ],
};
<ContactDetail
  contact={contact}
  hasSignalAccount={false}
  i18n={util.i18n}
  onSendMessage={() => console.log('onSendMessage')}
/>;
```

### No phone or email, partial addresses

```jsx
const contact = {
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  name: {
    displayName: 'Someone Somewhere',
  },
  address: [
    {
      type: 1,
      neighborhood: 'Greenwood',
      region: 'WA',
    },
    {
      type: 2,
      city: 'Seattle',
      region: 'WA',
    },
    {
      type: 3,
      label: 'My label',
      region: 'WA',
    },
    {
      type: 1,
      label: 'My label',
      postcode: '98101',
      region: 'WA',
    },
    {
      type: 2,
      label: 'My label',
      postcode: '98101',
    },
  ],
};
<ContactDetail
  contact={contact}
  hasSignalAccount={false}
  i18n={util.i18n}
  onSendMessage={() => console.log('onSendMessage')}
/>;
```

### Empty contact

```jsx
const contact = {};
<ContactDetail
  contact={contact}
  hasSignalAccount={false}
  i18n={util.i18n}
  onSendMessage={() => console.log('onSendMessage')}
/>;
```
