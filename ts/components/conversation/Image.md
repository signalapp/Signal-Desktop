### Various sizes

```jsx
<Image height='200' width='199' url={util.pngObjectUrl} />
<Image height='149' width='149' url={util.pngObjectUrl} />
<Image height='99' width='99' url={util.pngObjectUrl} />
```

### Various curved corners

```jsx
<Image height='149' width='149' curveTopLeft url={util.pngObjectUrl} />
<Image height='149' width='149' curveTopRight url={util.pngObjectUrl} />
<Image height='149' width='149' curveBottomLeft url={util.pngObjectUrl} />
<Image height='149' width='149' curveBottomRight url={util.pngObjectUrl} />
```

### With bottom overlay

```jsx
<Image height='149' width='149' bottomOverlay url={util.pngObjectUrl} />
<Image height='149' width='149' bottomOverlay curveBottomRight url={util.pngObjectUrl} />
<Image height='149' width='149' bottomOverlay curveBottomLeft url={util.pngObjectUrl} />
```

### With play icon

```jsx
<Image height='200' width='199' playIconOverlay url={util.pngObjectUrl} />
<Image height='149' width='149' playIconOverlay url={util.pngObjectUrl} />
<Image height='99' width='99' playIconOverlay url={util.pngObjectUrl} />
```

### With dark overlay and text

```jsx
<div>
  <div>
    <Image height="200" width="199" darkOverlay url={util.pngObjectUrl} />
    <Image height="149" width="149" darkOverlay url={util.pngObjectUrl} />
    <Image height="99" width="99" darkOverlay url={util.pngObjectUrl} />
  </div>
  <hr />
  <div>
    <Image
      height="200"
      width="199"
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
    />
    <Image
      height="149"
      width="149"
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
    />
    <Image
      height="99"
      width="99"
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
    />
  </div>
</div>
```

### With caption

```jsx
<div>
  <div>
    <Image
      height="200"
      width="199"
      attachment={{ caption: 'dogs playing' }}
      url={util.pngObjectUrl}
    />
    <Image
      height="149"
      width="149"
      attachment={{ caption: 'dogs playing' }}
      url={util.pngObjectUrl}
    />
    <Image
      height="99"
      width="99"
      attachment={{ caption: 'dogs playing' }}
      url={util.pngObjectUrl}
    />
  </div>
  <hr />
  <div>
    <Image
      height="200"
      width="199"
      attachment={{ caption: 'dogs playing' }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
    />
    <Image
      height="149"
      width="149"
      attachment={{ caption: 'dogs playing' }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
    />
    <Image
      height="99"
      width="99"
      attachment={{ caption: 'dogs playing' }}
      darkOverlay
      overlayText="+3"
      url={util.pngObjectUrl}
    />
  </div>
</div>
```
