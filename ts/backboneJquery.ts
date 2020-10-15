// we are requiring backbone in preload.js, and we need to tell backbone where
// jquery is after it's loaded.
window.Backbone.$ = window.Backbone.$ || window.$;
