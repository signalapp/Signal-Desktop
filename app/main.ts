// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join, normalize } from 'path';
import { pathToFileURL } from 'url';
import * as os from 'os';
import { chmod, realpath, writeFile } from 'fs-extra';
import { randomBytes } from 'crypto';

import normalizePath from 'normalize-path';
import fastGlob from 'fast-glob';
import PQueue from 'p-queue';
import { get, pick, isNumber, isBoolean, some, debounce, noop } from 'lodash';
import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain as ipc,
  Menu,
  powerSaveBlocker,
  protocol as electronProtocol,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import { z } from 'zod';

import packageJson from '../package.json';
import * as GlobalErrors from './global_errors';
import { setup as setupCrashReports } from './crashReports';
import { setup as setupSpellChecker } from './spell_check';
import { redactAll, addSensitivePath } from '../ts/util/privacy';
import { strictAssert } from '../ts/util/assert';
import { consoleLogger } from '../ts/util/consoleLogger';

import './startup_config';

import type { ConfigType } from './config';
import config from './config';
import {
  Environment,
  getEnvironment,
  isTestEnvironment,
} from '../ts/environment';

// Very important to put before the single instance check, since it is based on the
//   userData directory. (see requestSingleInstanceLock below)
import * as userConfig from './user_config';

// We generally want to pull in our own modules after this point, after the user
//   data directory has been set.
import * as attachments from './attachments';
import * as attachmentChannel from './attachment_channel';
import * as bounce from '../ts/services/bounce';
import * as updater from '../ts/updater/index';
import { updateDefaultSession } from './updateDefaultSession';
import { PreventDisplaySleepService } from './PreventDisplaySleepService';
import { SystemTrayService } from './SystemTrayService';
import { SystemTraySettingCache } from './SystemTraySettingCache';
import {
  SystemTraySetting,
  shouldMinimizeToSystemTray,
  parseSystemTraySetting,
} from '../ts/types/SystemTraySetting';
import * as ephemeralConfig from './ephemeral_config';
import * as logging from '../ts/logging/main_process_logging';
import { MainSQL } from '../ts/sql/main';
import * as sqlChannels from './sql_channel';
import * as windowState from './window_state';
import type { MenuOptionsType } from './menu';
import { createTemplate } from './menu';
import { installFileHandler, installWebHandler } from './protocol_filter';
import * as OS from '../ts/OS';
import { isProduction } from '../ts/util/version';
import {
  isSgnlHref,
  isCaptchaHref,
  isSignalHttpsLink,
  parseSgnlHref,
  parseCaptchaHref,
  parseSignalHttpsLink,
  rewriteSignalHrefsIfNecessary,
} from '../ts/util/sgnlHref';
import { clearTimeoutIfNecessary } from '../ts/util/clearTimeoutIfNecessary';
import { toggleMaximizedBrowserWindow } from '../ts/util/toggleMaximizedBrowserWindow';
import {
  getTitleBarVisibility,
  TitleBarVisibility,
} from '../ts/types/Settings';
import { ChallengeMainHandler } from '../ts/main/challengeMain';
import { NativeThemeNotifier } from '../ts/main/NativeThemeNotifier';
import { PowerChannel } from '../ts/main/powerChannel';
import { SettingsChannel } from '../ts/main/settingsChannel';
import { maybeParseUrl, setUrlSearchParams } from '../ts/util/url';
import { getHeicConverter } from '../ts/workers/heicConverterMain';

import type { LocaleType } from './locale';
import { load as loadLocale } from './locale';

import type { LoggerType } from '../ts/types/Logging';

const animationSettings = systemPreferences.getAnimationSettings();

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | undefined;
let mainWindowCreated = false;
let loadingWindow: BrowserWindow | undefined;

const activeWindows = new Set<BrowserWindow>();

function getMainWindow() {
  return mainWindow;
}

const development =
  getEnvironment() === Environment.Development ||
  getEnvironment() === Environment.Staging;

const isThrottlingEnabled = development || !isProduction(app.getVersion());

const enableCI = config.get<boolean>('enableCI');
const forcePreloadBundle = config.get<boolean>('forcePreloadBundle');

const preventDisplaySleepService = new PreventDisplaySleepService(
  powerSaveBlocker
);

const challengeHandler = new ChallengeMainHandler();

const nativeThemeNotifier = new NativeThemeNotifier();
nativeThemeNotifier.initialize();

let appStartInitialSpellcheckSetting = true;

const defaultWebPrefs = {
  devTools:
    process.argv.some(arg => arg === '--enable-dev-tools') ||
    getEnvironment() !== Environment.Production ||
    !isProduction(app.getVersion()),
  spellcheck: false,
};

function showWindow() {
  if (!mainWindow) {
    return;
  }

  // Using focus() instead of show() seems to be important on Windows when our window
  //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
  //   the window to reposition:
  //   https://github.com/signalapp/Signal-Desktop/issues/1429
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
  }
}

// This code runs before the 'ready' event fires, so we don't have our logging
//   infrastructure in place yet. So we use console.log directly.
/* eslint-disable no-console */

if (!process.mas) {
  console.log('making app single instance');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log('quitting; we are the second instance');
    app.exit();
  } else {
    app.on('second-instance', (_e: Electron.Event, argv: Array<string>) => {
      // Someone tried to run a second instance, we should focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        showWindow();
      }
      if (!logger) {
        console.log(
          'second-instance: logger not initialized; skipping further checks'
        );
        return;
      }

      const incomingCaptchaHref = getIncomingCaptchaHref(argv);
      if (incomingCaptchaHref) {
        const { captcha } = parseCaptchaHref(incomingCaptchaHref, getLogger());
        challengeHandler.handleCaptcha(captcha);
        return true;
      }
      // Are they trying to open a sgnl:// href?
      const incomingHref = getIncomingHref(argv);
      if (incomingHref) {
        handleSgnlHref(incomingHref);
      }
      // Handled
      return true;
    });
  }
}
/* eslint-enable no-console */

let sqlInitTimeStart = 0;
let sqlInitTimeEnd = 0;

const sql = new MainSQL();
const heicConverter = getHeicConverter();

async function getSpellCheckSetting() {
  const fastValue = ephemeralConfig.get('spell-check');
  if (fastValue !== undefined) {
    getLogger().info('got fast spellcheck setting', fastValue);
    return fastValue;
  }

  const json = await sql.sqlCall('getItemById', ['spell-check']);

  // Default to `true` if setting doesn't exist yet
  const slowValue = json ? json.value : true;

  ephemeralConfig.set('spell-check', slowValue);

  getLogger().info('got slow spellcheck setting', slowValue);

  return slowValue;
}

let systemTrayService: SystemTrayService | undefined;
const systemTraySettingCache = new SystemTraySettingCache(
  sql,
  ephemeralConfig,
  process.argv,
  app.getVersion()
);

const windowFromUserConfig = userConfig.get('window');
const windowFromEphemeral = ephemeralConfig.get('window');
export const windowConfigSchema = z.object({
  maximized: z.boolean().optional(),
  autoHideMenuBar: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
  width: z.number(),
  height: z.number(),
  x: z.number(),
  y: z.number(),
});
type WindowConfigType = z.infer<typeof windowConfigSchema>;

let windowConfig: WindowConfigType | undefined;
const windowConfigParsed = windowConfigSchema.safeParse(
  windowFromEphemeral || windowFromUserConfig
);
if (windowConfigParsed.success) {
  windowConfig = windowConfigParsed.data;
}

if (windowFromUserConfig) {
  userConfig.set('window', null);
  ephemeralConfig.set('window', windowConfig);
}

// These will be set after app fires the 'ready' event
let logger: LoggerType | undefined;
let locale: LocaleType | undefined;
let settingsChannel: SettingsChannel | undefined;

function getLogger(): LoggerType {
  if (!logger) {
    console.warn('getLogger: Logger not yet initialized!');
    return consoleLogger;
  }

  return logger;
}

function getLocale(): LocaleType {
  if (!locale) {
    throw new Error('getLocale: Locale not yet initialized!');
  }

  return locale;
}

function prepareFileUrl(
  pathSegments: ReadonlyArray<string>,
  moreKeys?: undefined | Record<string, unknown>
): string {
  const filePath = join(...pathSegments);
  const fileUrl = pathToFileURL(filePath);
  return prepareUrl(fileUrl, moreKeys);
}

function prepareUrl(
  url: URL,
  moreKeys?: undefined | Record<string, unknown>
): string {
  return setUrlSearchParams(url, {
    name: packageJson.productName,
    locale: locale ? locale.name : undefined,
    version: app.getVersion(),
    buildCreation: config.get<number | undefined>('buildCreation'),
    buildExpiration: config.get<number | undefined>('buildExpiration'),
    serverUrl: config.get<string>('serverUrl'),
    storageUrl: config.get<string>('storageUrl'),
    updatesUrl: config.get<string>('updatesUrl'),
    directoryVersion: config.get<number | undefined>('directoryVersion') || 1,
    directoryUrl: config.get<string | null>('directoryUrl') || undefined,
    directoryEnclaveId:
      config.get<string | null>('directoryEnclaveId') || undefined,
    directoryTrustAnchor:
      config.get<string | null>('directoryTrustAnchor') || undefined,
    directoryV2Url: config.get<string>('directoryV2Url'),
    directoryV2PublicKey: config.get<string>('directoryV2PublicKey'),
    directoryV2CodeHashes: config.get<string>('directoryV2CodeHashes'),
    cdnUrl0: config.get<ConfigType>('cdn').get<string>('0'),
    cdnUrl2: config.get<ConfigType>('cdn').get<string>('2'),
    certificateAuthority: config.get<string>('certificateAuthority'),
    environment: enableCI ? 'production' : getEnvironment(),
    enableCI: enableCI ? 'true' : '',
    node_version: process.versions.node,
    hostname: os.hostname(),
    appInstance: process.env.NODE_APP_INSTANCE,
    proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy,
    contentProxyUrl: config.get<string>('contentProxyUrl'),
    sfuUrl: config.get('sfuUrl'),
    reducedMotionSetting: animationSettings.prefersReducedMotion ? 'true' : '',
    serverPublicParams: config.get<string>('serverPublicParams'),
    serverTrustRoot: config.get<string>('serverTrustRoot'),
    appStartInitialSpellcheckSetting,
    userDataPath: app.getPath('userData'),
    homePath: app.getPath('home'),
    crashDumpsPath: app.getPath('crashDumps'),
    ...moreKeys,
  }).href;
}

async function handleUrl(event: Electron.Event, rawTarget: string) {
  event.preventDefault();
  const parsedUrl = maybeParseUrl(rawTarget);
  if (!parsedUrl) {
    return;
  }

  const target = rewriteSignalHrefsIfNecessary(rawTarget);

  const { protocol, hostname } = parsedUrl;
  const isDevServer =
    process.env.SIGNAL_ENABLE_HTTP && hostname === 'localhost';
  // We only want to specially handle urls that aren't requesting the dev server
  if (
    isSgnlHref(target, getLogger()) ||
    isSignalHttpsLink(target, getLogger())
  ) {
    handleSgnlHref(target);
    return;
  }

  if ((protocol === 'http:' || protocol === 'https:') && !isDevServer) {
    try {
      await shell.openExternal(target);
    } catch (error) {
      getLogger().error(`Failed to open url: ${error.stack}`);
    }
  }
}

function handleCommonWindowEvents(window: BrowserWindow) {
  window.webContents.on('will-navigate', handleUrl);
  window.webContents.on('new-window', handleUrl);
  window.webContents.on(
    'preload-error',
    (_event: Electron.Event, preloadPath: string, error: Error) => {
      getLogger().error(`Preload error in ${preloadPath}: `, error.message);
    }
  );

  activeWindows.add(window);
  window.on('closed', () => activeWindows.delete(window));

  // Works only for mainWindow because it has `enablePreferredSizeMode`
  let lastZoomFactor = window.webContents.getZoomFactor();
  const onZoomChanged = () => {
    if (
      window.isDestroyed() ||
      !window.webContents ||
      window.webContents.isDestroyed()
    ) {
      return;
    }

    const zoomFactor = window.webContents.getZoomFactor();
    if (lastZoomFactor === zoomFactor) {
      return;
    }

    settingsChannel?.invokeCallbackInMainWindow('persistZoomFactor', [
      zoomFactor,
    ]);

    lastZoomFactor = zoomFactor;
  };
  window.webContents.on('preferred-size-changed', onZoomChanged);

  nativeThemeNotifier.addWindow(window);
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 610;
// LARGEST_LEFT_PANE_WIDTH = 380
// TIMELINE_WIDTH = 300
// TIMELINE_MARGIN = 16 + 16
// 712 = LARGEST_LEFT_PANE_WIDTH + TIMELINE_WIDTH + TIMELINE_MARGIN
const MIN_WIDTH = 712;
const MIN_HEIGHT = 550;
const BOUNDS_BUFFER = 100;

type BoundsType = {
  width: number;
  height: number;
  x: number;
  y: number;
};

function isVisible(window: BoundsType, bounds: BoundsType) {
  const boundsX = get(bounds, 'x') || 0;
  const boundsY = get(bounds, 'y') || 0;
  const boundsWidth = get(bounds, 'width') || DEFAULT_WIDTH;
  const boundsHeight = get(bounds, 'height') || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound =
    window.x + window.width >= boundsX + BOUNDS_BUFFER;
  const leftSideClearOfRightBound =
    window.x <= boundsX + boundsWidth - BOUNDS_BUFFER;

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound =
    window.y <= boundsY + boundsHeight - BOUNDS_BUFFER;

  return (
    rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound
  );
}

let windowIcon: string;

if (OS.isWindows()) {
  windowIcon = join(__dirname, '../build/icons/win/icon.ico');
} else if (OS.isLinux()) {
  windowIcon = join(__dirname, '../images/signal-logo-desktop-linux.png');
} else {
  windowIcon = join(__dirname, '../build/icons/png/512x512.png');
}

async function createWindow() {
  const usePreloadBundle =
    !isTestEnvironment(getEnvironment()) || forcePreloadBundle;

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    show: false,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    autoHideMenuBar: false,
    titleBarStyle:
      getTitleBarVisibility() === TitleBarVisibility.Hidden &&
      !isTestEnvironment(getEnvironment())
        ? 'hidden'
        : 'default',
    backgroundColor: isTestEnvironment(getEnvironment())
      ? '#ffffff' // Tests should always be rendered on a white background
      : '#3a76f0',
    webPreferences: {
      ...defaultWebPrefs,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: join(
        __dirname,
        usePreloadBundle ? '../preload.bundle.js' : '../preload.js'
      ),
      spellcheck: await getSpellCheckSetting(),
      backgroundThrottling: isThrottlingEnabled,
      enablePreferredSizeMode: true,
    },
    icon: windowIcon,
    ...pick(windowConfig, ['autoHideMenuBar', 'width', 'height', 'x', 'y']),
  };

  if (!isNumber(windowOptions.width) || windowOptions.width < MIN_WIDTH) {
    windowOptions.width = DEFAULT_WIDTH;
  }
  if (!isNumber(windowOptions.height) || windowOptions.height < MIN_HEIGHT) {
    windowOptions.height = DEFAULT_HEIGHT;
  }
  if (!isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  const startInTray =
    (await systemTraySettingCache.get()) ===
    SystemTraySetting.MinimizeToAndStartInSystemTray;

  const visibleOnAnyScreen = some(screen.getAllDisplays(), display => {
    if (
      isNumber(windowOptions.x) &&
      isNumber(windowOptions.y) &&
      isNumber(windowOptions.width) &&
      isNumber(windowOptions.height)
    ) {
      return isVisible(windowOptions as BoundsType, get(display, 'bounds'));
    }

    getLogger().error(
      "visibleOnAnyScreen: windowOptions didn't have valid bounds fields"
    );
    return false;
  });
  if (!visibleOnAnyScreen) {
    getLogger().info('Location reset needed');
    delete windowOptions.x;
    delete windowOptions.y;
  }

  getLogger().info(
    'Initializing BrowserWindow config:',
    JSON.stringify(windowOptions)
  );

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);
  if (settingsChannel) {
    settingsChannel.setMainWindow(mainWindow);
  }

  mainWindowCreated = true;
  setupSpellChecker(mainWindow, getLocale());
  if (!startInTray && windowConfig && windowConfig.maximized) {
    mainWindow.maximize();
  }
  if (!startInTray && windowConfig && windowConfig.fullscreen) {
    mainWindow.setFullScreen(true);
  }
  if (systemTrayService) {
    systemTrayService.setMainWindow(mainWindow);
  }

  function captureAndSaveWindowStats() {
    if (!mainWindow) {
      return;
    }

    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      autoHideMenuBar: mainWindow.autoHideMenuBar,
      fullscreen: mainWindow.isFullScreen(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1],
    };

    getLogger().info(
      'Updating BrowserWindow config: %s',
      JSON.stringify(windowConfig)
    );
    ephemeralConfig.set('window', windowConfig);
  }

  const debouncedCaptureStats = debounce(captureAndSaveWindowStats, 500);
  mainWindow.on('resize', debouncedCaptureStats);
  mainWindow.on('move', debouncedCaptureStats);

  const setWindowFocus = () => {
    if (!mainWindow) {
      return;
    }
    mainWindow.webContents.send('set-window-focus', mainWindow.isFocused());
  };
  mainWindow.on('focus', setWindowFocus);
  mainWindow.on('blur', setWindowFocus);
  mainWindow.once('ready-to-show', setWindowFocus);
  // This is a fallback in case we drop an event for some reason.
  setInterval(setWindowFocus, 10000);

  const moreKeys = {
    isFullScreen: String(Boolean(mainWindow.isFullScreen())),
  };

  if (getEnvironment() === Environment.Test) {
    mainWindow.loadURL(
      prepareFileUrl([__dirname, '../test/index.html'], {
        ...moreKeys,
        argv: JSON.stringify(process.argv),
      })
    );
  } else {
    mainWindow.loadURL(
      prepareFileUrl([__dirname, '../background.html'], moreKeys)
    );
  }

  if (!enableCI && config.get<boolean>('openDevTools')) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  }

  handleCommonWindowEvents(mainWindow);

  // App dock icon bounce
  bounce.init(mainWindow);

  // Emitted when the window is about to be closed.
  // Note: We do most of our shutdown logic here because all windows are closed by
  //   Electron before the app quits.
  mainWindow.on('close', async e => {
    if (!mainWindow) {
      getLogger().info('close event: no main window');
      return;
    }

    getLogger().info('close event', {
      readyForShutdown: windowState.readyForShutdown(),
      shouldQuit: windowState.shouldQuit(),
    });
    // If the application is terminating, just do the default
    if (
      isTestEnvironment(getEnvironment()) ||
      (windowState.readyForShutdown() && windowState.shouldQuit())
    ) {
      return;
    }

    // Prevent the shutdown
    e.preventDefault();

    /**
     * if the user is in fullscreen mode and closes the window, not the
     * application, we need them leave fullscreen first before closing it to
     * prevent a black screen.
     *
     * issue: https://github.com/signalapp/Signal-Desktop/issues/4348
     */

    if (mainWindow.isFullScreen()) {
      mainWindow.once('leave-full-screen', () => mainWindow?.hide());
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.hide();
    }

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    const usingTrayIcon = shouldMinimizeToSystemTray(
      await systemTraySettingCache.get()
    );
    if (!windowState.shouldQuit() && (usingTrayIcon || OS.isMacOS())) {
      return;
    }

    await requestShutdown();
    windowState.markReadyForShutdown();

    await sql.close();
    app.quit();
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = undefined;
    if (settingsChannel) {
      settingsChannel.setMainWindow(mainWindow);
    }
    if (systemTrayService) {
      systemTrayService.setMainWindow(mainWindow);
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow) {
      mainWindow.webContents.send('full-screen-change', true);
    }
  });
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow) {
      mainWindow.webContents.send('full-screen-change', false);
    }
  });

  mainWindow.once('ready-to-show', async () => {
    getLogger().info('main window is ready-to-show');

    // Ignore sql errors and show the window anyway
    await sqlInitPromise;

    if (!mainWindow) {
      return;
    }

    const shouldShowWindow =
      !app.getLoginItemSettings().wasOpenedAsHidden && !startInTray;

    if (shouldShowWindow) {
      getLogger().info('showing main window');
      mainWindow.show();
    }
  });
}

// Renderer asks if we are done with the database
ipc.on('database-ready', async event => {
  if (!sqlInitPromise) {
    getLogger().error('database-ready requested, but sqlInitPromise is falsey');
    return;
  }

  const { error } = await sqlInitPromise;
  if (error) {
    getLogger().error(
      'database-ready requested, but got sql error',
      error && error.stack
    );
    return;
  }

  getLogger().info('sending `database-ready`');
  event.sender.send('database-ready');
});

ipc.on('show-window', () => {
  showWindow();
});

ipc.on('title-bar-double-click', () => {
  if (!mainWindow) {
    return;
  }

  if (OS.isMacOS()) {
    switch (
      systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string')
    ) {
      case 'Minimize':
        mainWindow.minimize();
        break;
      case 'Maximize':
        toggleMaximizedBrowserWindow(mainWindow);
        break;
      default:
        // If this is disabled, it'll be 'None'. If it's anything else, that's unexpected,
        //   but we'll just no-op.
        break;
    }
  } else {
    // This is currently only supported on macOS. This `else` branch is just here when/if
    //   we add support for other operating systems.
    toggleMaximizedBrowserWindow(mainWindow);
  }
});

ipc.on('set-is-call-active', (_event, isCallActive) => {
  preventDisplaySleepService.setEnabled(isCallActive);

  if (!mainWindow) {
    return;
  }

  if (!isThrottlingEnabled) {
    return;
  }

  let backgroundThrottling: boolean;
  if (isCallActive) {
    getLogger().info('Background throttling disabled because a call is active');
    backgroundThrottling = false;
  } else {
    getLogger().info('Background throttling enabled because no call is active');
    backgroundThrottling = true;
  }

  mainWindow.webContents.setBackgroundThrottling(backgroundThrottling);
});

ipc.on('convert-image', async (event, uuid, data) => {
  const { error, response } = await heicConverter(uuid, data);
  event.reply(`convert-image:${uuid}`, { error, response });
});

let isReadyForUpdates = false;
async function readyForUpdates() {
  if (isReadyForUpdates) {
    return;
  }

  isReadyForUpdates = true;

  // First, install requested sticker pack
  const incomingHref = getIncomingHref(process.argv);
  if (incomingHref) {
    handleSgnlHref(incomingHref);
  }

  // Second, start checking for app updates
  try {
    strictAssert(
      settingsChannel !== undefined,
      'SettingsChannel must be initialized'
    );
    await updater.start(settingsChannel, getLogger(), getMainWindow);
  } catch (error) {
    getLogger().error(
      'Error starting update checks:',
      error && error.stack ? error.stack : error
    );
  }
}

async function forceUpdate() {
  try {
    getLogger().info('starting force update');
    await updater.force();
  } catch (error) {
    getLogger().error(
      'Error during force update:',
      error && error.stack ? error.stack : error
    );
  }
}

ipc.once('ready-for-updates', readyForUpdates);

const TEN_MINUTES = 10 * 60 * 1000;
setTimeout(readyForUpdates, TEN_MINUTES);

// the support only provides a subset of languages available within the app
// so we have to list them out here and fallback to english if not included

const SUPPORT_LANGUAGES = [
  'ar',
  'bn',
  'de',
  'en-us',
  'es',
  'fr',
  'hi',
  'hi-in',
  'hc',
  'id',
  'it',
  'ja',
  'ko',
  'mr',
  'ms',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'ta',
  'te',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-cn',
  'zh-tw',
];

function openContactUs() {
  const userLanguage = app.getLocale();
  const language = SUPPORT_LANGUAGES.includes(userLanguage)
    ? userLanguage
    : 'en-us';

  // This URL needs a hardcoded language because the '?desktop' is dropped if the page
  //   auto-redirects to the proper URL
  shell.openExternal(
    `https://support.signal.org/hc/${language}/requests/new?desktop`
  );
}

function openJoinTheBeta() {
  // If we omit the language, the site will detect the language and redirect
  shell.openExternal('https://support.signal.org/hc/articles/360007318471');
}

function openReleaseNotes() {
  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.webContents.send('show-release-notes');
    return;
  }

  shell.openExternal(
    `https://github.com/signalapp/Signal-Desktop/releases/tag/v${app.getVersion()}`
  );
}

function openSupportPage() {
  // If we omit the language, the site will detect the language and redirect
  shell.openExternal('https://support.signal.org/hc/sections/360001602812');
}

function openForums() {
  shell.openExternal('https://community.signalusers.org/');
}

function showKeyboardShortcuts() {
  if (mainWindow) {
    mainWindow.webContents.send('show-keyboard-shortcuts');
  }
}

function setupAsNewDevice() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-new-device');
  }
}

function setupAsStandalone() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-standalone');
  }
}

let screenShareWindow: BrowserWindow | undefined;
function showScreenShareWindow(sourceName: string) {
  if (screenShareWindow) {
    screenShareWindow.showInactive();
    return;
  }

  const width = 480;

  const display = screen.getPrimaryDisplay();
  const options = {
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#2e2e2e',
    darkTheme: true,
    frame: false,
    fullscreenable: false,
    height: 44,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    title: getLocale().i18n('screenShareWindow'),
    width,
    webPreferences: {
      ...defaultWebPrefs,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      preload: join(__dirname, '../ts/windows/screenShare/preload.js'),
    },
    x: Math.floor(display.size.width / 2) - width / 2,
    y: 24,
  };

  screenShareWindow = new BrowserWindow(options);

  handleCommonWindowEvents(screenShareWindow);

  screenShareWindow.loadURL(prepareFileUrl([__dirname, '../screenShare.html']));

  screenShareWindow.on('closed', () => {
    screenShareWindow = undefined;
  });

  screenShareWindow.once('ready-to-show', () => {
    if (screenShareWindow) {
      screenShareWindow.showInactive();
      screenShareWindow.webContents.send(
        'render-screen-sharing-controller',
        sourceName
      );
    }
  });
}

let aboutWindow: BrowserWindow | undefined;
function showAbout() {
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }

  const options = {
    width: 500,
    height: 500,
    resizable: false,
    title: getLocale().i18n('aboutSignalDesktop'),
    autoHideMenuBar: true,
    backgroundColor: '#3a76f0',
    show: false,
    webPreferences: {
      ...defaultWebPrefs,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      preload: join(__dirname, '../ts/windows/about/preload.js'),
      nativeWindowOpen: true,
    },
  };

  aboutWindow = new BrowserWindow(options);

  handleCommonWindowEvents(aboutWindow);

  aboutWindow.loadURL(prepareFileUrl([__dirname, '../about.html']));

  aboutWindow.on('closed', () => {
    aboutWindow = undefined;
  });

  aboutWindow.once('ready-to-show', () => {
    if (aboutWindow) {
      aboutWindow.show();
    }
  });
}

let settingsWindow: BrowserWindow | undefined;
function showSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    return;
  }

  const options = {
    width: 700,
    height: 700,
    frame: true,
    resizable: false,
    title: getLocale().i18n('signalDesktopPreferences'),
    autoHideMenuBar: true,
    backgroundColor: '#3a76f0',
    show: false,
    webPreferences: {
      ...defaultWebPrefs,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      preload: join(__dirname, '../ts/windows/settings/preload.js'),
      nativeWindowOpen: true,
    },
  };

  settingsWindow = new BrowserWindow(options);

  handleCommonWindowEvents(settingsWindow);

  settingsWindow.loadURL(prepareFileUrl([__dirname, '../settings.html']));

  settingsWindow.on('closed', () => {
    settingsWindow = undefined;
  });

  ipc.once('settings-done-rendering', () => {
    if (!settingsWindow) {
      getLogger().warn('settings-done-rendering: no settingsWindow available!');
      return;
    }

    settingsWindow.show();
  });
}

async function getIsLinked() {
  try {
    const number = await sql.sqlCall('getItemById', ['number_id']);
    const password = await sql.sqlCall('getItemById', ['password']);
    return Boolean(number && password);
  } catch (e) {
    return false;
  }
}

let stickerCreatorWindow: BrowserWindow | undefined;
async function showStickerCreator() {
  if (!(await getIsLinked())) {
    const message = getLocale().i18n('StickerCreator--Authentication--error');

    dialog.showMessageBox({
      type: 'warning',
      message,
    });

    return;
  }

  if (stickerCreatorWindow) {
    stickerCreatorWindow.show();
    return;
  }

  const { x = 0, y = 0 } = windowConfig || {};

  const options = {
    x: x + 100,
    y: y + 100,
    width: 800,
    minWidth: 800,
    height: 650,
    title: getLocale().i18n('signalDesktopStickerCreator'),
    autoHideMenuBar: true,
    backgroundColor: '#3a76f0',
    show: false,
    webPreferences: {
      ...defaultWebPrefs,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: join(__dirname, '../sticker-creator/preload.js'),
      nativeWindowOpen: true,
      spellcheck: await getSpellCheckSetting(),
    },
  };

  stickerCreatorWindow = new BrowserWindow(options);
  setupSpellChecker(stickerCreatorWindow, getLocale());

  handleCommonWindowEvents(stickerCreatorWindow);

  const appUrl = process.env.SIGNAL_ENABLE_HTTP
    ? prepareUrl(
        new URL('http://localhost:6380/sticker-creator/dist/index.html')
      )
    : prepareFileUrl([__dirname, '../sticker-creator/dist/index.html']);

  stickerCreatorWindow.loadURL(appUrl);

  stickerCreatorWindow.on('closed', () => {
    stickerCreatorWindow = undefined;
  });

  stickerCreatorWindow.once('ready-to-show', () => {
    if (!stickerCreatorWindow) {
      return;
    }

    stickerCreatorWindow.show();

    if (config.get<boolean>('openDevTools')) {
      // Open the DevTools.
      stickerCreatorWindow.webContents.openDevTools();
    }
  });
}

let debugLogWindow: BrowserWindow | undefined;
async function showDebugLogWindow() {
  if (debugLogWindow) {
    debugLogWindow.show();
    return;
  }

  const theme = settingsChannel
    ? await settingsChannel.getSettingFromMainWindow('themeSetting')
    : undefined;
  const options = {
    width: 700,
    height: 500,
    resizable: false,
    title: getLocale().i18n('debugLog'),
    autoHideMenuBar: true,
    backgroundColor: '#3a76f0',
    show: false,
    webPreferences: {
      ...defaultWebPrefs,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      preload: join(__dirname, '../ts/windows/debuglog/preload.js'),
      nativeWindowOpen: true,
    },
    parent: mainWindow,
    // Electron has [a macOS bug][0] that causes parent windows to become unresponsive if
    //   it's fullscreen and opens a fullscreen child window. Until that's fixed, we
    //   prevent the child window from being fullscreenable, which sidesteps the problem.
    // [0]: https://github.com/electron/electron/issues/32374
    fullscreenable: !OS.isMacOS(),
  };

  debugLogWindow = new BrowserWindow(options);

  handleCommonWindowEvents(debugLogWindow);

  debugLogWindow.loadURL(
    prepareFileUrl([__dirname, '../debug_log.html'], { theme })
  );

  debugLogWindow.on('closed', () => {
    debugLogWindow = undefined;
  });

  debugLogWindow.once('ready-to-show', () => {
    if (debugLogWindow) {
      debugLogWindow.show();

      // Electron sometimes puts the window in a strange spot until it's shown.
      debugLogWindow.center();
    }
  });
}

let permissionsPopupWindow: BrowserWindow | undefined;
function showPermissionsPopupWindow(forCalling: boolean, forCamera: boolean) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise<void>(async (resolveFn, reject) => {
    if (permissionsPopupWindow) {
      permissionsPopupWindow.show();
      reject(new Error('Permission window already showing'));
      return;
    }
    if (!mainWindow) {
      reject(new Error('No main window'));
      return;
    }

    const theme = settingsChannel
      ? await settingsChannel.getSettingFromMainWindow('themeSetting')
      : undefined;
    const size = mainWindow.getSize();
    const options = {
      width: Math.min(400, size[0]),
      height: Math.min(150, size[1]),
      resizable: false,
      title: getLocale().i18n('allowAccess'),
      autoHideMenuBar: true,
      backgroundColor: '#3a76f0',
      show: false,
      modal: true,
      webPreferences: {
        ...defaultWebPrefs,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        contextIsolation: true,
        preload: join(__dirname, '../ts/windows/permissions/preload.js'),
        nativeWindowOpen: true,
      },
      parent: mainWindow,
    };

    permissionsPopupWindow = new BrowserWindow(options);

    handleCommonWindowEvents(permissionsPopupWindow);

    permissionsPopupWindow.loadURL(
      prepareFileUrl([__dirname, '../permissions_popup.html'], {
        theme,
        forCalling,
        forCamera,
      })
    );

    permissionsPopupWindow.on('closed', () => {
      removeDarkOverlay();
      permissionsPopupWindow = undefined;

      resolveFn();
    });

    permissionsPopupWindow.once('ready-to-show', () => {
      if (permissionsPopupWindow) {
        addDarkOverlay();
        permissionsPopupWindow.show();
      }
    });
  });
}

async function initializeSQL(
  userDataPath: string
): Promise<{ ok: true; error: undefined } | { ok: false; error: Error }> {
  let key: string | undefined;
  const keyFromConfig = userConfig.get('key');
  if (typeof keyFromConfig === 'string') {
    key = keyFromConfig;
  } else if (keyFromConfig) {
    getLogger().warn(
      "initializeSQL: got key from config, but it wasn't a string"
    );
  }
  if (!key) {
    getLogger().info(
      'key/initialize: Generating new encryption key, since we did not find it on disk'
    );
    // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
    key = randomBytes(32).toString('hex');
    userConfig.set('key', key);
  }

  sqlInitTimeStart = Date.now();
  try {
    // This should be the first awaited call in this function, otherwise
    // `sql.sqlCall` will throw an uninitialized error instead of waiting for
    // init to finish.
    await sql.initialize({
      configDir: userDataPath,
      key,
      logger: getLogger(),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { ok: false, error };
    }

    return {
      ok: false,
      error: new Error(`initializeSQL: Caught a non-error '${error}'`),
    };
  } finally {
    sqlInitTimeEnd = Date.now();
  }

  return { ok: true, error: undefined };
}

const onDatabaseError = async (error: string) => {
  // Prevent window from re-opening
  ready = false;

  if (mainWindow) {
    settingsChannel?.invokeCallbackInMainWindow('closeDB', []);
    mainWindow.close();
  }
  mainWindow = undefined;

  const buttonIndex = dialog.showMessageBoxSync({
    buttons: [
      getLocale().i18n('copyErrorAndQuit'),
      getLocale().i18n('deleteAndRestart'),
    ],
    defaultId: 0,
    detail: redactAll(error),
    message: getLocale().i18n('databaseError'),
    noLink: true,
    type: 'error',
  });

  if (buttonIndex === 0) {
    clipboard.writeText(`Database startup error:\n\n${redactAll(error)}`);
  } else {
    await sql.removeDB();
    userConfig.remove();
    app.relaunch();
  }

  app.exit(1);
};

const runSQLCorruptionHandler = async () => {
  // This is a glorified event handler. Normally, this promise never resolves,
  // but if there is a corruption error triggered by any query that we run
  // against the database - the promise will resolve and we will call
  // `onDatabaseError`.
  const error = await sql.whenCorrupted();

  getLogger().error(
    'Detected sql corruption in main process. ' +
      `Restarting the application immediately. Error: ${error.message}`
  );

  await onDatabaseError(error.stack || error.message);
};

runSQLCorruptionHandler();

let sqlInitPromise:
  | Promise<{ ok: true; error: undefined } | { ok: false; error: Error }>
  | undefined;

ipc.on('database-error', (_event: Electron.Event, error: string) => {
  onDatabaseError(error);
});

function getAppLocale(): string {
  return getEnvironment() === Environment.Test ? 'en' : app.getLocale();
}

// Signal doesn't really use media keys so we set this switch here to unblock
// them so that other apps can use them if they need to.
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;
app.on('ready', async () => {
  updateDefaultSession(session.defaultSession);

  const [userDataPath, crashDumpsPath] = await Promise.all([
    realpath(app.getPath('userData')),
    realpath(app.getPath('crashDumps')),
  ]);

  logger = await logging.initialize(getMainWindow);

  await setupCrashReports(getLogger);

  if (!locale) {
    const appLocale = getAppLocale();
    locale = loadLocale({ appLocale, logger });
  }

  sqlInitPromise = initializeSQL(userDataPath);

  const startTime = Date.now();

  settingsChannel = new SettingsChannel();
  settingsChannel.install();

  // We use this event only a single time to log the startup time of the app
  // from when it's first ready until the loading screen disappears.
  ipc.once('signal-app-loaded', (event, info) => {
    const { preloadTime, connectTime, processedCount } = info;

    const loadTime = Date.now() - startTime;
    const sqlInitTime = sqlInitTimeEnd - sqlInitTimeStart;

    const messageTime = loadTime - preloadTime - connectTime;
    const messagesPerSec = (processedCount * 1000) / messageTime;

    const innerLogger = getLogger();
    innerLogger.info('App loaded - time:', loadTime);
    innerLogger.info('SQL init - time:', sqlInitTime);
    innerLogger.info('Preload - time:', preloadTime);
    innerLogger.info('WebSocket connect - time:', connectTime);
    innerLogger.info('Processed count:', processedCount);
    innerLogger.info('Messages per second:', messagesPerSec);

    event.sender.send('ci:event', 'app-loaded', {
      loadTime,
      sqlInitTime,
      preloadTime,
      connectTime,
      processedCount,
      messagesPerSec,
    });
  });

  const installPath = await realpath(app.getAppPath());

  addSensitivePath(userDataPath);
  addSensitivePath(crashDumpsPath);

  if (getEnvironment() !== Environment.Test) {
    installFileHandler({
      protocol: electronProtocol,
      userDataPath,
      installPath,
      isWindows: OS.isWindows(),
    });
  }

  installWebHandler({
    enableHttp: Boolean(process.env.SIGNAL_ENABLE_HTTP),
    protocol: electronProtocol,
  });

  logger.info('app ready');
  logger.info(`starting version ${packageJson.version}`);

  // This logging helps us debug user reports about broken devices.
  {
    let getMediaAccessStatus;
    // This function is not supported on Linux, so we have a fallback.
    if (systemPreferences.getMediaAccessStatus) {
      getMediaAccessStatus =
        systemPreferences.getMediaAccessStatus.bind(systemPreferences);
    } else {
      getMediaAccessStatus = noop;
    }
    logger.info(
      'media access status',
      getMediaAccessStatus('microphone'),
      getMediaAccessStatus('camera')
    );
  }

  GlobalErrors.updateLocale(locale.messages);

  // If the sql initialization takes more than three seconds to complete, we
  // want to notify the user that things are happening
  const timeout = new Promise(resolveFn =>
    setTimeout(resolveFn, 3000, 'timeout')
  );
  // eslint-disable-next-line more/no-then
  Promise.race([sqlInitPromise, timeout]).then(maybeTimeout => {
    if (maybeTimeout !== 'timeout') {
      return;
    }

    getLogger().info(
      'sql.initialize is taking more than three seconds; showing loading dialog'
    );

    loadingWindow = new BrowserWindow({
      show: false,
      width: 300,
      height: 265,
      resizable: false,
      frame: false,
      backgroundColor: '#3a76f0',
      webPreferences: {
        ...defaultWebPrefs,
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../ts/windows/loading/preload.js'),
      },
      icon: windowIcon,
    });

    loadingWindow.once('ready-to-show', async () => {
      if (!loadingWindow) {
        return;
      }
      loadingWindow.show();
      // Wait for sql initialization to complete, but ignore errors
      await sqlInitPromise;
      loadingWindow.destroy();
      loadingWindow = undefined;
    });

    loadingWindow.loadURL(prepareFileUrl([__dirname, '../loading.html']));
  });

  try {
    await attachments.clearTempPath(userDataPath);
  } catch (err) {
    logger.error(
      'main/ready: Error deleting temp dir:',
      err && err.stack ? err.stack : err
    );
  }

  // Initialize IPC channels before creating the window

  attachmentChannel.initialize({
    configDir: userDataPath,
    cleanupOrphanedAttachments,
  });
  sqlChannels.initialize(sql);
  PowerChannel.initialize({
    send(event) {
      if (!mainWindow) {
        return;
      }
      mainWindow.webContents.send(event);
    },
  });

  // Run window preloading in parallel with database initialization.
  await createWindow();

  const { error: sqlError } = await sqlInitPromise;
  if (sqlError) {
    getLogger().error('sql.initialize was unsuccessful; returning early');

    await onDatabaseError(sqlError.stack || sqlError.message);

    return;
  }

  // eslint-disable-next-line more/no-then
  appStartInitialSpellcheckSetting = await getSpellCheckSetting();

  try {
    const IDB_KEY = 'indexeddb-delete-needed';
    const item = await sql.sqlCall('getItemById', [IDB_KEY]);
    if (item && item.value) {
      await sql.sqlCall('removeIndexedDBFiles', []);
      await sql.sqlCall('removeItemById', [IDB_KEY]);
    }
  } catch (err) {
    getLogger().error(
      '(ready event handler) error deleting IndexedDB:',
      err && err.stack ? err.stack : err
    );
  }

  async function cleanupOrphanedAttachments() {
    const allAttachments = await attachments.getAllAttachments(userDataPath);
    const orphanedAttachments = await sql.sqlCall('removeKnownAttachments', [
      allAttachments,
    ]);
    await attachments.deleteAll({
      userDataPath,
      attachments: orphanedAttachments,
    });

    await attachments.deleteAllBadges({
      userDataPath,
      pathsToKeep: await sql.sqlCall('getAllBadgeImageFileLocalPaths', []),
    });

    const allStickers = await attachments.getAllStickers(userDataPath);
    const orphanedStickers = await sql.sqlCall('removeKnownStickers', [
      allStickers,
    ]);
    await attachments.deleteAllStickers({
      userDataPath,
      stickers: orphanedStickers,
    });

    const allDraftAttachments = await attachments.getAllDraftAttachments(
      userDataPath
    );
    const orphanedDraftAttachments = await sql.sqlCall(
      'removeKnownDraftAttachments',
      [allDraftAttachments]
    );
    await attachments.deleteAllDraftAttachments({
      userDataPath,
      attachments: orphanedDraftAttachments,
    });
  }

  ready = true;

  setupMenu();

  systemTrayService = new SystemTrayService({ messages: locale.messages });
  systemTrayService.setMainWindow(mainWindow);
  systemTrayService.setEnabled(
    shouldMinimizeToSystemTray(await systemTraySettingCache.get())
  );

  ensureFilePermissions([
    'config.json',
    'sql/db.sqlite',
    'sql/db.sqlite-wal',
    'sql/db.sqlite-shm',
  ]);
});

function setupMenu(options?: Partial<MenuOptionsType>) {
  const { platform } = process;
  const menuOptions = {
    // options
    development,
    devTools: defaultWebPrefs.devTools,
    includeSetup: false,
    isProduction: isProduction(app.getVersion()),
    platform,

    // actions
    forceUpdate,
    openContactUs,
    openForums,
    openJoinTheBeta,
    openReleaseNotes,
    openSupportPage,
    setupAsNewDevice,
    setupAsStandalone,
    showAbout,
    showDebugLog: showDebugLogWindow,
    showKeyboardShortcuts,
    showSettings: showSettingsWindow,
    showStickerCreator,
    showWindow,

    // overrides
    ...options,
  };
  const template = createTemplate(menuOptions, getLocale().messages);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function requestShutdown() {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  getLogger().info('requestShutdown: Requesting close of mainWindow...');
  const request = new Promise<void>(resolveFn => {
    let timeout: NodeJS.Timeout | undefined;

    if (!mainWindow) {
      resolveFn();
      return;
    }

    ipc.once('now-ready-for-shutdown', (_event, error) => {
      getLogger().info('requestShutdown: Response received');

      if (error) {
        getLogger().error(
          'requestShutdown: got error, still shutting down.',
          error
        );
      }
      clearTimeoutIfNecessary(timeout);

      resolveFn();
    });

    mainWindow.webContents.send('get-ready-for-shutdown');

    // We'll wait two minutes, then force the app to go down. This can happen if someone
    //   exits the app before we've set everything up in preload() (so the browser isn't
    //   yet listening for these events), or if there are a whole lot of stacked-up tasks.
    // Note: two minutes is also our timeout for SQL tasks in data.js in the browser.
    timeout = setTimeout(() => {
      getLogger().error(
        'requestShutdown: Response never received; forcing shutdown.'
      );
      resolveFn();
    }, 2 * 60 * 1000);
  });

  try {
    await request;
  } catch (error) {
    getLogger().error(
      'requestShutdown error:',
      error && error.stack ? error.stack : error
    );
  }
}

app.on('before-quit', () => {
  getLogger().info('before-quit event', {
    readyForShutdown: windowState.readyForShutdown(),
    shouldQuit: windowState.shouldQuit(),
  });

  systemTrayService?.markShouldQuit();
  windowState.markShouldQuit();

  if (mainWindow) {
    mainWindow.webContents.send('quit');
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  getLogger().info('main process handling window-all-closed');
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  const shouldAutoClose = !OS.isMacOS() || isTestEnvironment(getEnvironment());

  // Only automatically quit if the main window has been created
  // This is necessary because `window-all-closed` can be triggered by the
  // "optimizing application" window closing
  if (shouldAutoClose && mainWindowCreated) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!ready) {
    return;
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

// Defense in depth. We never intend to open webviews or windows. Prevent it completely.
app.on(
  'web-contents-created',
  (_createEvent: Electron.Event, contents: Electron.WebContents) => {
    contents.on('will-attach-webview', attachEvent => {
      attachEvent.preventDefault();
    });
    contents.on('new-window', newEvent => {
      newEvent.preventDefault();
    });
  }
);

app.setAsDefaultProtocolClient('sgnl');
app.setAsDefaultProtocolClient('signalcaptcha');

app.on('will-finish-launching', () => {
  // open-url must be set from within will-finish-launching for macOS
  // https://stackoverflow.com/a/43949291
  app.on('open-url', (event, incomingHref) => {
    event.preventDefault();

    if (isCaptchaHref(incomingHref, getLogger())) {
      const { captcha } = parseCaptchaHref(incomingHref, getLogger());
      challengeHandler.handleCaptcha(captcha);

      // Show window after handling captcha
      showWindow();

      return;
    }

    handleSgnlHref(incomingHref);
  });
});

ipc.on('set-badge-count', (_event: Electron.Event, count: number) => {
  app.badgeCount = count;
});

ipc.on('remove-setup-menu-items', () => {
  setupMenu();
});

ipc.on('add-setup-menu-items', () => {
  setupMenu({
    includeSetup: true,
  });
});

ipc.on('draw-attention', () => {
  if (!mainWindow) {
    return;
  }

  if (OS.isWindows() || OS.isLinux()) {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', () => {
  getLogger().info('Relaunching application');
  app.relaunch();
  app.quit();
});
ipc.on('shutdown', () => {
  app.quit();
});

ipc.on(
  'set-auto-hide-menu-bar',
  (_event: Electron.Event, autoHide: boolean) => {
    if (mainWindow) {
      mainWindow.autoHideMenuBar = autoHide;
    }
  }
);

ipc.on(
  'set-menu-bar-visibility',
  (_event: Electron.Event, visibility: boolean) => {
    if (mainWindow) {
      mainWindow.setMenuBarVisibility(visibility);
    }
  }
);

ipc.on(
  'update-system-tray-setting',
  (_event, rawSystemTraySetting /* : Readonly<unknown> */) => {
    const systemTraySetting = parseSystemTraySetting(rawSystemTraySetting);
    systemTraySettingCache.set(systemTraySetting);

    if (systemTrayService) {
      const isEnabled = shouldMinimizeToSystemTray(systemTraySetting);
      systemTrayService.setEnabled(isEnabled);
    }
  }
);

ipc.on('close-about', () => {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

ipc.on('close-screen-share-controller', () => {
  if (screenShareWindow) {
    screenShareWindow.close();
  }
});

ipc.on('stop-screen-share', () => {
  if (mainWindow) {
    mainWindow.webContents.send('stop-screen-share');
  }
});

ipc.on('show-screen-share', (_event: Electron.Event, sourceName: string) => {
  showScreenShareWindow(sourceName);
});

ipc.on('update-tray-icon', (_event: Electron.Event, unreadCount: number) => {
  if (systemTrayService) {
    systemTrayService.setUnreadCount(unreadCount);
  }
});

// Debug Log-related IPC calls

ipc.on('show-debug-log', showDebugLogWindow);
ipc.on('close-debug-log', () => {
  if (debugLogWindow) {
    debugLogWindow.close();
  }
});
ipc.on(
  'show-debug-log-save-dialog',
  async (_event: Electron.Event, logText: string) => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: 'debuglog.txt',
    });
    if (filePath) {
      await writeFile(filePath, logText);
    }
  }
);

// Permissions Popup-related IPC calls

ipc.handle(
  'show-permissions-popup',
  async (_event: Electron.Event, forCalling: boolean, forCamera: boolean) => {
    try {
      await showPermissionsPopupWindow(forCalling, forCamera);
    } catch (error) {
      getLogger().error(
        'show-permissions-popup error:',
        error && error.stack ? error.stack : error
      );
    }
  }
);
ipc.on('close-permissions-popup', () => {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.close();
  }
});

// Settings-related IPC calls

function addDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('add-dark-overlay');
  }
}
function removeDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('remove-dark-overlay');
  }
}

ipc.on('show-settings', showSettingsWindow);
ipc.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipc.on('delete-all-data', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('delete-all-data');
  }
});

ipc.on('get-built-in-images', async () => {
  if (!mainWindow) {
    getLogger().warn('ipc/get-built-in-images: No mainWindow!');
    return;
  }

  try {
    const images = await attachments.getBuiltInImages();
    mainWindow.webContents.send('get-success-built-in-images', null, images);
  } catch (error) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('get-success-built-in-images', error.message);
    } else {
      getLogger().error('Error handling get-built-in-images:', error.stack);
    }
  }
});

// Ingested in preload.js via a sendSync call
ipc.on('locale-data', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = getLocale().messages;
});

ipc.on('user-config-key', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = userConfig.get('key');
});

ipc.on('get-user-data-path', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = app.getPath('userData');
});

// Refresh the settings window whenever preferences change
ipc.on('preferences-changed', () => {
  for (const window of activeWindows) {
    if (window.webContents) {
      window.webContents.send('preferences-changed');
    }
  }
});

function getIncomingHref(argv: Array<string>) {
  return argv.find(arg => isSgnlHref(arg, getLogger()));
}

function getIncomingCaptchaHref(argv: Array<string>) {
  return argv.find(arg => isCaptchaHref(arg, getLogger()));
}

function handleSgnlHref(incomingHref: string) {
  let command;
  let args;
  let hash;

  if (isSgnlHref(incomingHref, getLogger())) {
    ({ command, args, hash } = parseSgnlHref(incomingHref, getLogger()));
  } else if (isSignalHttpsLink(incomingHref, getLogger())) {
    ({ command, args, hash } = parseSignalHttpsLink(incomingHref, getLogger()));
  }

  if (mainWindow && mainWindow.webContents) {
    if (command === 'addstickers') {
      getLogger().info('Opening sticker pack from sgnl protocol link');
      const packId = args?.get('pack_id');
      const packKeyHex = args?.get('pack_key');
      const packKey = packKeyHex
        ? Buffer.from(packKeyHex, 'hex').toString('base64')
        : '';
      mainWindow.webContents.send('show-sticker-pack', { packId, packKey });
    } else if (command === 'signal.group' && hash) {
      getLogger().info('Showing group from sgnl protocol link');
      mainWindow.webContents.send('show-group-via-link', { hash });
    } else if (command === 'signal.me' && hash) {
      getLogger().info('Showing conversation from sgnl protocol link');
      mainWindow.webContents.send('show-conversation-via-signal.me', { hash });
    } else {
      getLogger().info('Showing warning that we cannot process link');
      mainWindow.webContents.send('unknown-sgnl-link');
    }
  } else {
    getLogger().error('Unhandled sgnl link');
  }
}

ipc.on('install-sticker-pack', (_event, packId, packKeyHex) => {
  const packKey = Buffer.from(packKeyHex, 'hex').toString('base64');
  if (mainWindow) {
    mainWindow.webContents.send('install-sticker-pack', { packId, packKey });
  }
});

ipc.on('ensure-file-permissions', async event => {
  await ensureFilePermissions();
  event.reply('ensure-file-permissions-done');
});

/**
 * Ensure files in the user's data directory have the proper permissions.
 * Optionally takes an array of file paths to exclusively affect.
 *
 * @param {string[]} [onlyFiles] - Only ensure permissions on these given files
 */
async function ensureFilePermissions(onlyFiles?: Array<string>) {
  getLogger().info('Begin ensuring permissions');

  const start = Date.now();
  const userDataPath = await realpath(app.getPath('userData'));
  // fast-glob uses `/` for all platforms
  const userDataGlob = normalizePath(join(userDataPath, '**', '*'));

  // Determine files to touch
  const files = onlyFiles
    ? onlyFiles.map(f => join(userDataPath, f))
    : await fastGlob(userDataGlob, {
        markDirectories: true,
        onlyFiles: false,
        ignore: ['**/Singleton*'],
      });

  getLogger().info(`Ensuring file permissions for ${files.length} files`);

  // Touch each file in a queue
  const q = new PQueue({ concurrency: 5, timeout: 1000 * 60 * 2 });
  q.addAll(
    files.map(f => async () => {
      const isDir = f.endsWith('/');
      try {
        await chmod(normalize(f), isDir ? 0o700 : 0o600);
      } catch (error) {
        getLogger().error(
          'ensureFilePermissions: Error from chmod',
          error.message
        );
      }
    })
  );

  await q.onEmpty();

  getLogger().info(`Finish ensuring permissions in ${Date.now() - start}ms`);
}

ipc.handle('get-auto-launch', async () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipc.handle('set-auto-launch', async (_event, value) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(value) });
});

ipc.on('show-message-box', (_event, { type, message }) => {
  dialog.showMessageBox({ type, message });
});

ipc.on('show-item-in-folder', (_event, folder) => {
  shell.showItemInFolder(folder);
});

ipc.handle('show-save-dialog', async (_event, { defaultPath }) => {
  if (!mainWindow) {
    getLogger().warn('show-save-dialog: no main window');

    return { canceled: true };
  }

  return dialog.showSaveDialog(mainWindow, {
    defaultPath,
  });
});

ipc.handle('getScreenCaptureSources', async () => {
  return desktopCapturer.getSources({
    fetchWindowIcons: true,
    thumbnailSize: { height: 102, width: 184 },
    types: ['window', 'screen'],
  });
});

if (isTestEnvironment(getEnvironment())) {
  ipc.handle('ci:test-electron:done', async (_event, info) => {
    if (!process.env.TEST_QUIT_ON_COMPLETE) {
      return;
    }

    process.stdout.write(
      `ci:test-electron:done=${JSON.stringify(info)}\n`,
      () => app.quit()
    );
  });
}
