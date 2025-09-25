// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import type EventEmitter from 'node:events';
import type { Store } from 'redux';
import type { SystemPreferences } from 'electron';
import type PQueue from 'p-queue/dist.js';
import type { assert } from 'chai';
import googleLibphonenumber from 'google-libphonenumber';
import type { MochaOptions } from 'mocha';

import type { textsecure } from './textsecure/index.js';
import type { Storage } from './textsecure/Storage.js';
import type {
  ChallengeHandler,
  IPCRequest as IPCChallengeRequest,
} from './challenge.js';
import type AccountManager from './textsecure/AccountManager.js';
import type { WebAPIConnectType } from './textsecure/WebAPI.js';
import type { CallingClass } from './services/calling.js';
import type * as Donations from './services/donations.js';
import type * as StorageService from './services/storage.js';
import type { BackupsService } from './services/backups/index.js';
import type * as Groups from './groups.js';
import type * as Crypto from './Crypto.js';
import type * as Curve from './Curve.js';
import type * as RemoteConfig from './RemoteConfig.js';
import type { OSType } from './util/os/shared.js';
import type {
  LocalizerType,
  SystemThemeType,
  ThemeType,
} from './types/Util.js';
import type { Receipt } from './types/Receipt.js';
import type { ConversationController } from './ConversationController.js';
import type { ReduxActions } from './state/types.js';
import type { createApp } from './state/roots/createApp.js';
import type { BatcherType } from './util/batcher.js';
import type { ConfirmationDialog } from './components/ConfirmationDialog.js';
import type { SignalProtocolStore } from './SignalProtocolStore.js';
import type { SocketStatus } from './types/SocketStatus.js';
import type { ScreenShareStatus } from './types/Calling.js';
import type { MessageCache } from './services/MessageCache.js';
import type { StateType } from './state/reducer.js';
import type { Address } from './types/Address.js';
import type { QualifiedAddress } from './types/QualifiedAddress.js';
import type { CIType } from './CI.js';
import type { IPCEventsType } from './util/createIPCEvents.js';
import type { SignalContextType } from './windows/context.js';
import type * as Message2 from './types/Message2.js';
import type { initializeMigrations } from './signal.js';
import type { RetryPlaceholders } from './util/retryPlaceholders.js';
import type { PropsPreloadType as PreferencesPropsType } from './components/Preferences.js';
import type { WindowsNotificationData } from './services/notifications.js';
import type { QueryStatsOptions } from './sql/main.js';
import type { SocketStatuses } from './textsecure/SocketManager.js';
import type { BeforeNavigateService } from './services/BeforeNavigate.js';

const { PhoneNumber, PhoneNumberFormat } = googleLibphonenumber;

export { Long } from 'long';

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
  Crypto: typeof Crypto;
  Curve: typeof Curve;
  DebugLogWindowProps?: DebugLogWindowPropsType;
  Groups: typeof Groups;
  PermissionsWindowProps?: PermissionsWindowPropsType;
  RemoteConfig: typeof RemoteConfig;
  ScreenShareWindowProps?: ScreenShareWindowPropsType;
  Services: {
    backups: BackupsService;
    beforeNavigate: BeforeNavigateService;
    calling: CallingClass;
    initializeGroupCredentialFetcher: () => Promise<void>;
    initializeNetworkObserver: (
      network: ReduxActions['network'],
      getAuthSocketStatus: () => SocketStatus
    ) => void;
    initializeUpdateListener: (updates: ReduxActions['updates']) => void;
    lightSessionResetQueue?: PQueue;
    retryPlaceholders?: RetryPlaceholders;
    storage: typeof StorageService;
    donations: typeof Donations;
  };
  SettingsWindowProps?: SettingsWindowPropsType;
  Migrations: ReturnType<typeof initializeMigrations>;
  Types: {
    Message: typeof Message2;
    Address: typeof Address;
    QualifiedAddress: typeof QualifiedAddress;
  };
  Components: {
    ConfirmationDialog: typeof ConfirmationDialog;
  };
  OS: OSType;
  State: {
    Roots: {
      createApp: typeof createApp;
    };
  };
  challengeHandler?: ChallengeHandler;

  // Only for debugging in Dev Tools
  DataReader?: unknown;
  DataWriter?: unknown;
};

declare global {
  // We want to extend various globals, so we need to use interfaces.
  /* eslint-disable no-restricted-syntax */
  interface Window {
    // Used in Sticker Creator to create proper paths to emoji images
    ROOT_PATH?: string;
    // Used for sticker creator localization
    localeMessages: { [key: string]: { message: string } };

    openArtCreator: (opts: { username: string; password: string }) => void;

    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAccountManager: () => AccountManager;
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
    libphonenumberInstance: {
      parse: (number: string) => PhoneNumber;
      getRegionCodeForNumber: (number: PhoneNumber) => string | undefined;
      format: (number: PhoneNumber, format: PhoneNumberFormat) => string;
    };
    libphonenumberFormat: typeof PhoneNumberFormat;
    nodeSetImmediate: typeof setImmediate;
    platform: string;
    preloadedImages: Array<HTMLImageElement>;
    setImmediate: typeof setImmediate;
    sendChallengeRequest: (request: IPCChallengeRequest) => void;
    showKeyboardShortcuts: () => void;
    storage: Storage;
    systemTheme: SystemThemeType;

    Signal: SignalCoreType;

    getServerTrustRoots: () => Array<string>;
    logAuthenticatedConnect?: () => void;

    // ========================================================================
    // The types below have been somewhat organized. See DESKTOP-4801
    // ========================================================================

    ConversationController: ConversationController;
    Events: IPCEventsType;
    FontFace: typeof FontFace;
    MessageCache: MessageCache;
    SignalProtocolStore: typeof SignalProtocolStore;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;
    getSignalProtocolStore: () => SignalProtocolStore;
    i18n: LocalizerType;
    // Note: used in background.html, and not type-checked
    startApp: () => void;
    textsecure: typeof textsecure;

    // IPC
    IPC: IPCType;

    // State
    reduxActions: ReduxActions;
    reduxStore: Store<StateType>;

    // Feature Flags
    Flags: FeatureFlagType;

    // Paths
    BasePaths: {
      attachments: string;
      draft: string;
      stickers: string;
      temp: string;
    };

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

  interface Set<T> {
    // Needed until TS upgrade
    difference<U>(other: ReadonlySet<U>): Set<T>;
    symmetricDifference<U>(other: ReadonlySet<U>): Set<T>;
  }
}

export type WhisperType = {
  deliveryReceiptQueue: PQueue;
  deliveryReceiptBatcher: BatcherType<Receipt>;
  events: EventEmitter;
};
