Note that this component is controlled, so the text in the search box will only update
if the parent of this component feeds the updated `searchTerm` back.

#### With image

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    searchTerm=""
    avatarPath={util.gifObjectUrl}
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Just name

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    searchTerm=""
    name="John Smith"
    color="purple"
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Just phone number

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    searchTerm=""
    phoneNumber="+15553004000"
    color="green"
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Starting with a search term

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    name="John Smith"
    color="purple"
    searchTerm="Hewwo?"
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```
