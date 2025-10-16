// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import type EventEmitter from 'node:events';
import type { Store } from 'redux';
import type { SystemPreferences } from 'electron';
import type { assert } from 'chai';
import type { MochaOptions } from 'mocha';

import type { IPCRequest as IPCChallengeRequest } from './challenge.dom.js';
import type { OSType } from './util/os/shared.std.js';
import type { SystemThemeType, ThemeType } from './types/Util.std.js';
import type { ConversationController } from './ConversationController.preload.js';
import type { ReduxActions } from './state/types.std.js';
import type { ScreenShareStatus } from './types/Calling.std.js';
import type { MessageCache } from './services/MessageCache.preload.js';
import type { StateType } from './state/reducer.preload.js';
import type { CIType } from './CI.preload.js';
import type { IPCEventsType } from './util/createIPCEvents.preload.js';
import type { SignalContextType } from './windows/context.preload.js';
import type { PropsPreloadType as PreferencesPropsType } from './components/Preferences.dom.js';
import type { WindowsNotificationData } from './services/notifications.preload.js';
import type { QueryStatsOptions } from './sql/main.main.js';
import type { SocketStatuses } from './textsecure/SocketManager.preload.js';

export type IPCType = {
  addSetupMenuItems: () => void;
  clearAllWindowsNotifications: () => Promise<void>;
  closeAbout: () => void;
  crashReports: {
    getCount: () => Promise<number>;
    writeToLog: () => Promise<void>;
    erase: () => Promise<void>;
  };
  drawAttention: () => void;
  getAutoLaunch: () => Promise<boolean | undefined>;
  getMediaAccessStatus: (
    mediaType: 'screen' | 'microphone' | 'camera'
  ) => Promise<ReturnType<SystemPreferences['getMediaAccessStatus']>>;
  getMediaCameraPermissions: () => Promise<boolean | undefined>;
  openSystemMediaPermissions: (
    mediaType: 'microphone' | 'camera' | 'screenCapture'
  ) => Promise<void>;
  getMediaPermissions: () => Promise<boolean | undefined>;
  whenWindowVisible: () => Promise<void>;
  logAppLoadedEvent?: (options: { processedCount?: number }) => void;
  readyForUpdates: () => void;
  removeSetupMenuItems: () => unknown;
  setAutoHideMenuBar: (value: boolean) => void;
  setAutoLaunch: (value: boolean) => Promise<void>;
  setBadge: (badge: number | 'marked-unread') => void;
  setMediaPermissions: (value: boolean) => Promise<void>;
  setMediaCameraPermissions: (value: boolean) => Promise<void>;
  setMenuBarVisibility: (value: boolean) => void;
  showDebugLog: () => void;
  showPermissionsPopup: (
    forCalling: boolean,
    forCamera: boolean
  ) => Promise<void>;
  showSettings: () => void;
  showWindow: () => void;
  showWindowsNotification: (data: WindowsNotificationData) => Promise<void>;
  shutdown: () => void;
  startTrackingQueryStats: () => void;
  stopTrackingQueryStats: (options?: QueryStatsOptions) => void;
  titleBarDoubleClick: () => void;
  updateTrayIcon: (count: number) => void;
};

export type FeatureFlagType = {
  GV2_ENABLE_SINGLE_CHANGE_PROCESSING: boolean;
  GV2_ENABLE_CHANGE_PROCESSING: boolean;
  GV2_ENABLE_STATE_PROCESSING: boolean;
  GV2_ENABLE_PRE_JOIN_FETCH: boolean;
  GV2_MIGRATION_DISABLE_ADD: boolean;
  GV2_MIGRATION_DISABLE_INVITE: boolean;
};

type AboutWindowPropsType = {
  appEnv: string;
  arch: string;
  platform: string;
};

type DebugLogWindowPropsType = {
  downloadLog: (text: string) => unknown;
  fetchLogs: () => Promise<string>;
  uploadLogs: (text: string) => Promise<string>;
};

type PermissionsWindowPropsType = {
  forCamera: boolean;
  forCalling: boolean;
  onAccept: () => void;
  onClose: () => void;
};

type ScreenShareWindowPropsType = {
  onStopSharing: () => void;
  presentedSourceName: string | undefined;
  getStatus: () => ScreenShareStatus;
  setRenderCallback: (cb: () => void) => void;
};

type SettingsOnRenderCallbackType = (props: PreferencesPropsType) => void;

type SettingsWindowPropsType = {
  onRender: (callback: SettingsOnRenderCallbackType) => void;
};

export type SignalCoreType = {
  AboutWindowProps?: AboutWindowPropsType;
  DebugLogWindowProps?: DebugLogWindowPropsType;
  PermissionsWindowProps?: PermissionsWindowPropsType;
  ScreenShareWindowProps?: ScreenShareWindowPropsType;
  SettingsWindowProps?: SettingsWindowPropsType;

  OS: OSType;

  // Only for debugging in Dev Tools
  Services?: {
    storage: unknown;
    backups: unknown;
    calling: unknown;
    donations: unknown;
  };
  DataReader?: unknown;
  DataWriter?: unknown;
};

declare global {
  // We want to extend various globals, so we need to use interfaces.
  /* eslint-disable no-restricted-syntax */
  interface Window {
    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAppInstance: () => string | undefined;
    getBuildCreation: () => number;
    getBuildExpiration: () => number;
    getHostName: () => string;
    getInteractionMode: () => 'mouse' | 'keyboard';
    getServerPublicParams: () => string;
    getGenericServerPublicParams: () => string;
    getBackupServerPublicParams: () => string;
    getSfuUrl: () => string;
    getIceServerOverride: () => string;
    getSocketStatus: () => SocketStatuses;
    getTitle: () => string;
    waitForEmptyEventQueue: () => Promise<void>;
    getVersion: () => string;
    isAfterVersion: (version: string, anotherVersion: string) => boolean;
    isBeforeVersion: (version: string, anotherVersion: string) => boolean;
    initialTheme?: ThemeType;
    nodeSetImmediate: typeof setImmediate;
    platform: string;
    setImmediate: typeof setImmediate;
    sendChallengeRequest: (request: IPCChallengeRequest) => void;
    systemTheme: SystemThemeType;

    Signal: SignalCoreType;

    getServerTrustRoots: () => Array<string>;
    logAuthenticatedConnect?: () => void;

    // ========================================================================
    // The types below have been somewhat organized. See DESKTOP-4801
    // ========================================================================

    ConversationController: ConversationController;
    Events: IPCEventsType;
    MessageCache: MessageCache;
    Whisper: WhisperType;
    // Note: used in background.html, and not type-checked
    startApp: () => void;

    // IPC
    IPC: IPCType;

    // State
    reduxActions: ReduxActions;
    reduxStore: Store<StateType>;

    // Feature Flags
    Flags: FeatureFlagType;

    // Test only
    SignalCI?: CIType;

    // TODO DESKTOP-4801
    SignalContext: SignalContextType;

    // Used only in preload to calculate load time
    preloadCompileStartTime: number;
    preloadStartTime: number;
    preloadEndTime: number;

    // Test only
    RETRY_DELAY: boolean;
    assert: typeof assert;
    testUtilities: {
      setup: MochaOptions;
      debug: (info: unknown) => void;
      onTestEvent: (event: unknown) => void;
      initialize: () => Promise<void>;
      prepareTests: () => void;
    };
  }

  interface Element {
    // WebKit-specific
    scrollIntoViewIfNeeded: (bringToCenter?: boolean) => void;
  }

  // Uint8Array and ArrayBuffer are type-compatible in TypeScript's covariant
  // type checker, but in reality they are not. Let's assert correct use!
  interface Uint8Array {
    __uint8array: never;
  }

  interface ArrayBuffer {
    __arrayBuffer: never;
  }

  interface SharedArrayBuffer {
    __arrayBuffer: never;
  }
}

export type WhisperType = {
  events: EventEmitter;
};
