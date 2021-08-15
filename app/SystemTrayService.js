"use strict";
// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemTrayService = void 0;
const path_1 = require("path");
const electron_1 = require("electron");
const log = __importStar(require("../ts/logging/log"));
/**
 * A class that manages an [Electron `Tray` instance][0]. It's responsible for creating
 * and destroying a `Tray`, and listening to the associated `BrowserWindow`'s visibility
 * state.
 *
 * [0]: https://www.electronjs.org/docs/api/tray
 */
class SystemTrayService {
    constructor({ messages }) {
        this.isEnabled = false;
        this.unreadCount = 0;
        log.info('System tray service: created');
        this.messages = messages;
        this.boundRender = this.render.bind(this);
    }
    /**
     * Update or clear the associated `BrowserWindow`. This is used for the hide/show
     * functionality. It attaches event listeners to the window to manage the hide/show
     * toggle in the tray's context menu.
     */
    setMainWindow(newBrowserWindow) {
        const oldBrowserWindow = this.browserWindow;
        if (oldBrowserWindow === newBrowserWindow) {
            return;
        }
        log.info(`System tray service: updating main window. Previously, there was ${oldBrowserWindow ? '' : 'not '}a window, and now there is${newBrowserWindow ? '' : ' not'}`);
        if (oldBrowserWindow) {
            oldBrowserWindow.off('show', this.boundRender);
            oldBrowserWindow.off('hide', this.boundRender);
        }
        if (newBrowserWindow) {
            newBrowserWindow.on('show', this.boundRender);
            newBrowserWindow.on('hide', this.boundRender);
        }
        this.browserWindow = newBrowserWindow;
        this.render();
    }
    /**
     * Enable or disable the tray icon. Note: if there is no associated browser window (see
     * `setMainWindow`), the tray icon will not be shown, even if enabled.
     */
    setEnabled(isEnabled) {
        if (this.isEnabled === isEnabled) {
            return;
        }
        log.info(`System tray service: ${isEnabled ? 'enabling' : 'disabling'}`);
        this.isEnabled = isEnabled;
        this.render();
    }
    /**
     * Update the unread count, which updates the tray icon if it's visible.
     */
    setUnreadCount(unreadCount) {
        if (this.unreadCount === unreadCount) {
            return;
        }
        log.info(`System tray service: setting unread count to ${unreadCount}`);
        this.unreadCount = unreadCount;
        this.render();
    }
    render() {
        if (this.isEnabled && this.browserWindow) {
            this.renderEnabled();
            return;
        }
        this.renderDisabled();
    }
    renderEnabled() {
        log.info('System tray service: rendering the tray');
        this.tray = this.tray || this.createTray();
        const { browserWindow, tray } = this;
        tray.setImage(getIcon(this.unreadCount));
        // NOTE: we want to have the show/hide entry available in the tray icon
        // context menu, since the 'click' event may not work on all platforms.
        // For details please refer to:
        // https://github.com/electron/electron/blob/master/docs/api/tray.md.
        tray.setContextMenu(electron_1.Menu.buildFromTemplate([
            Object.assign({ id: 'toggleWindowVisibility' }, ((browserWindow === null || browserWindow === void 0 ? void 0 : browserWindow.isVisible())
                ? {
                    label: this.messages.hide.message,
                    click: () => {
                        var _a;
                        log.info('System tray service: hiding the window from the context menu');
                        // We re-fetch `this.browserWindow` here just in case the browser window
                        //   has changed while the context menu was open. Same applies in the
                        //   "show" case below.
                        (_a = this.browserWindow) === null || _a === void 0 ? void 0 : _a.hide();
                    },
                }
                : {
                    label: this.messages.show.message,
                    click: () => {
                        log.info('System tray service: showing the window from the context menu');
                        if (this.browserWindow) {
                            this.browserWindow.show();
                            forceOnTop(this.browserWindow);
                        }
                    },
                })),
            {
                id: 'quit',
                label: this.messages.quit.message,
                click: () => {
                    log.info('System tray service: quitting the app from the context menu');
                    electron_1.app.quit();
                },
            },
        ]));
    }
    renderDisabled() {
        log.info('System tray service: rendering no tray');
        if (!this.tray) {
            return;
        }
        this.tray.destroy();
        this.tray = undefined;
    }
    createTray() {
        log.info('System tray service: creating the tray');
        // This icon may be swiftly overwritten.
        const result = new electron_1.Tray(getIcon(this.unreadCount));
        // Note: "When app indicator is used on Linux, the click event is ignored." This
        //   doesn't mean that the click event is always ignored on Linux; it depends on how
        //   the app indicator is set up.
        //
        // See <https://github.com/electron/electron/blob/v13.1.3/docs/api/tray.md#class-tray>.
        result.on('click', () => {
            const { browserWindow } = this;
            if (!browserWindow) {
                return;
            }
            if (!browserWindow.isVisible()) {
                browserWindow.show();
            }
            forceOnTop(browserWindow);
        });
        result.setToolTip(this.messages.signalDesktop.message);
        return result;
    }
    /**
     * This is exported for testing, because Electron doesn't have any easy way to hook
     * into the existing tray instances. It should not be used by "real" code.
     */
    _getTray() {
        return this.tray;
    }
}
exports.SystemTrayService = SystemTrayService;
function getIcon(unreadCount) {
    let iconSize;
    switch (process.platform) {
        case 'darwin':
            iconSize = '16';
            break;
        case 'win32':
            iconSize = '32';
            break;
        default:
            iconSize = '256';
            break;
    }
    if (unreadCount > 0) {
        const filename = `${String(unreadCount >= 10 ? 10 : unreadCount)}.png`;
        return path_1.join(__dirname, '..', 'images', 'alert', iconSize, filename);
    }
    return path_1.join(__dirname, '..', 'images', `icon_${iconSize}.png`);
}
function forceOnTop(browserWindow) {
    // On some versions of GNOME the window may not be on top when restored.
    // This trick should fix it.
    // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
    browserWindow.setAlwaysOnTop(true);
    browserWindow.focus();
    browserWindow.setAlwaysOnTop(false);
}
