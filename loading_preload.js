// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

const { ipcRenderer } = require('electron');

const url = require('url');
const i18n = require('./js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.i18n = i18n.setup(locale, localeMessages);
window.Backbone = require('backbone');
