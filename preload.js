"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const storage_1 = require("./ts/util/storage");
const url_1 = __importDefault(require("url"));
const path_1 = __importDefault(require("path"));
const config = url_1.default.parse(window.location.toString(), true).query;
const configAny = config;
let title = config.name;
if (config.environment !== 'production') {
    title += ` - ${config.environment}`;
}
if (config.appInstance) {
    title += ` - ${config.appInstance}`;
}
global.dcodeIO = global.dcodeIO || {};
global.dcodeIO.ByteBuffer = require('bytebuffer');
window.platform = process.platform;
window.getTitle = () => title;
window.getEnvironment = () => configAny.environment;
window.getAppInstance = () => configAny.appInstance;
window.getVersion = () => configAny.version;
window.isDev = () => config.environment === 'development';
window.getCommitHash = () => configAny.commitHash;
window.getNodeVersion = () => configAny.node_version;
window.sessionFeatureFlags = {
    useOnionRequests: true,
    useCallMessage: true,
};
window.versionInfo = {
    environment: window.getEnvironment(),
    version: window.getVersion(),
    commitHash: window.getCommitHash(),
    appInstance: window.getAppInstance(),
};
const ipc = electron_1.ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');
window.updateZoomFactor = () => {
    const zoomFactor = window.getSettingValue('zoom-factor-setting') || 100;
    window.setZoomFactor(zoomFactor / 100);
};
window.setZoomFactor = number => {
    electron_1.webFrame.setZoomFactor(number);
};
window.setPassword = async (passPhrase, oldPhrase) => new Promise((resolve, reject) => {
    ipc.once('set-password-response', (_event, error) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(undefined);
        return;
    });
    ipc.send('set-password', passPhrase, oldPhrase);
});
window.setStartInTray = async (startInTray) => new Promise((resolve, reject) => {
    ipc.once('start-in-tray-on-start-response', (_event, error) => {
        if (error) {
            reject(error);
            return;
        }
        resolve();
        return;
    });
    ipc.send('start-in-tray-on-start', startInTray);
});
window.getStartInTray = async () => {
    return new Promise(resolve => {
        ipc.once('get-start-in-tray-response', (_event, value) => {
            resolve(value);
        });
        ipc.send('get-start-in-tray');
    });
};
window._ = require('lodash');
window.open = () => null;
window.eval = global.eval = () => null;
window.drawAttention = () => {
    ipc.send('draw-attention');
};
window.showWindow = () => {
    window.log.info('show window');
    ipc.send('show-window');
};
window.setAutoHideMenuBar = autoHide => {
    ipc.send('set-auto-hide-menu-bar', autoHide);
};
window.setMenuBarVisibility = visibility => {
    ipc.send('set-menu-bar-visibility', visibility);
};
window.restart = () => {
    window.log.info('restart');
    ipc.send('restart');
};
window.closeAbout = () => {
    ipc.send('close-about');
};
window.readyForUpdates = () => {
    ipc.send('ready-for-updates');
};
ipc.on('get-theme-setting', () => {
    const theme = window.Events.getThemeSetting();
    ipc.send('get-success-theme-setting', theme);
});
window.getSettingValue = (settingID, comparisonValue = null) => {
    if (settingID === 'media-permissions') {
        return window.getMediaPermissions();
    }
    else if (settingID === 'call-media-permissions') {
        return window.getCallMediaPermissions();
    }
    else if (settingID === 'auto-update') {
        return window.getAutoUpdateEnabled();
    }
    const settingVal = storage_1.Storage.get(settingID);
    return comparisonValue ? !!settingVal === comparisonValue : settingVal;
};
window.setSettingValue = async (settingID, value) => {
    if (settingID === 'auto-update') {
        window.setAutoUpdateEnabled(value);
        return;
    }
    await storage_1.Storage.put(settingID, value);
};
window.getMediaPermissions = () => ipc.sendSync('get-media-permissions');
window.setMediaPermissions = value => {
    ipc.send('set-media-permissions', !!value);
};
window.getCallMediaPermissions = () => ipc.sendSync('get-call-media-permissions');
window.setCallMediaPermissions = value => {
    ipc.send('set-call-media-permissions', !!value);
};
window.askForMediaAccess = () => {
    ipc.send('media-access');
};
window.getAutoUpdateEnabled = () => ipc.sendSync('get-auto-update-setting');
window.setAutoUpdateEnabled = value => {
    ipc.send('set-auto-update-setting', !!value);
};
ipc.on('get-ready-for-shutdown', async () => {
    const { shutdown } = window.Events || {};
    if (!shutdown) {
        window.log.error('preload shutdown handler: shutdown method not found');
        ipc.send('now-ready-for-shutdown');
        return;
    }
    try {
        await shutdown();
        ipc.send('now-ready-for-shutdown');
    }
    catch (error) {
        ipc.send('now-ready-for-shutdown', error && error.stack ? error.stack : error);
    }
});
require("./ts/util/logging");
if (config.proxyUrl) {
    window.log.info('Using provided proxy url');
}
window.nodeSetImmediate = setImmediate;
const signal_1 = require("./ts/node/signal");
const i18n_1 = require("./ts/util/i18n");
window.Signal = (0, signal_1.setupSignal)();
const util_worker_interface_1 = require("./ts/node/util_worker_interface");
console.warn('++++++++++++++++++++++++ app', electron_1.app);
const utilWorkerPath = path_1.default.join(electron_1.app.getAppPath(), 'js', 'util_worker.js');
const utilWorker = new util_worker_interface_1.WorkerInterface(utilWorkerPath, 3 * 60 * 1000);
window.callWorker = (fnName, ...args) => utilWorker.callWorker(fnName, ...args);
setInterval(() => {
    window.nodeSetImmediate(() => { });
}, 1000);
window.React = require('react');
window.ReactDOM = require('react-dom');
window.clipboard = electron_1.clipboard;
window.getSeedNodeList = () => [
    {
        url: 'https://storage.seed1.loki.network:4433/',
    },
    {
        url: 'https://storage.seed3.loki.network:4433/',
    },
    {
        url: 'https://public.loki.foundation:4433/',
    },
];
const { locale: localFromEnv } = config;
window.i18n = (0, i18n_1.setupi18n)(localFromEnv, localeMessages);
window.addEventListener('contextmenu', e => {
    const editable = e?.target.closest('textarea, input, [contenteditable="true"]');
    const link = e?.target.closest('a');
    const selection = Boolean(window?.getSelection()?.toString());
    if (!editable && !selection && !link) {
        e.preventDefault();
    }
});
