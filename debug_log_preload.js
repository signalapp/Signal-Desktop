/* global window */

const { ipcRenderer, remote } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');
const fs = require('fs');
const path = require('path');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

global.dcodeIO = global.dcodeIO || {};
global.dcodeIO.ByteBuffer = require('bytebuffer');

window.getVersion = () => config.version;
window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

// got.js appears to need this to successfully submit debug logs to the cloud
window.nodeSetImmediate = setImmediate;

window.getNodeVersion = () => config.node_version;
window.getEnvironment = () => config.environment;

require('./js/logging');
const os = require('os');

window.getOSRelease = () => `${os.type()} ${os.release} ${os.platform()}`;
window.getCommitHash = () => config.commitHash;

window.closeDebugLog = () => ipcRenderer.send('close-debug-log');

window.saveLog = logText => ipcRenderer.send('save-debug-log', logText);
