// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// we are requiring backbone in preload.js, and we need to tell backbone where
// jquery is after it's loaded.
window.Backbone.$ = window.Backbone.$ || window.$;
