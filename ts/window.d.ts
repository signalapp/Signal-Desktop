// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import type { Store } from 'redux';
import type * as Backbone from 'backbone';
import type PQueue from 'p-queue/dist';
import type { assert } from 'chai';
import type { PhoneNumber, PhoneNumberFormat } from 'google-libphonenumber';
import type { MochaOptions } from 'mocha';

import type { ConversationModelCollectionType } from './model-types.d';
import type { textsecure } from './textsecure';
import type { Storage } from './textsecure/Storage';
import type {
  ChallengeHandler,
  IPCRequest as IPCChallengeRequest,
} from './challenge';
import type AccountManager from './textsecure/AccountManager';
import type { WebAPIConnectType } from './textsecure/WebAPI';
import type { CallingClass } from './services/calling';
import type * as StorageService from './services/storage';
import type { BackupsService } from './services/backups';
import type * as Groups from './groups';
import type * as Crypto from './Crypto';
import type * as Curve from './Curve';
import type * as RemoteConfig from './RemoteConfig';
import type { OSType } from './util/os/shared';
import type { LocalizerType, SystemThemeType, ThemeType } from './types/Util';
import type { Receipt } from './types/Receipt';
import type { ConversationController } from './ConversationController';
import type { ReduxActions } from './state/types';
import type { createApp } from './state/roots/createApp';
import type { ConversationModel } from './models/conversations';
import type { BatcherType } from './util/batcher';
import type { ConfirmationDialog } from './components/ConfirmationDialog';
import type { SignalProtocolStore } from './SignalProtocolStore';
import type { SocketStatus } from './types/SocketStatus';
import type { ScreenShareStatus } from './types/Calling';
import type { MessageCache } from './services/MessageCache';
import type { StateType } from './state/reducer';
import type { Address } from './types/Address';
import type { QualifiedAddress } from './types/QualifiedAddress';
import type { CIType } from './CI';
import type { IPCEventsType } from './util/createIPCEvents';
import type { SignalContextType } from './windows/context';
import type * as Message2 from './types/Message2';
import type { initializeMigrations } from './signal';
import type { RetryPlaceholders } from './util/retryPlaceholders';
import type { PropsPreloadType as PreferencesPropsType } from './components/Preferences';
import type { WindowsNotificationData } from './services/notifications';
import type { QueryStatsOptions } from './sql/main';
import type { SocketStatuses } from './textsecure/SocketManager';

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
  getAutoLaunch: () => Promise<boolean>;
  getMediaAccessStatus: (
    mediaType: 'screen' | 'microphone' | 'camera'
  ) => Promise<string | undefined>;
  getMediaCameraPermissions: () => Promise<boolean>;
  getMediaPermissions: () => Promise<boolean>;
  logAppLoadedEvent?: (options: { processedCount?: number }) => void;
  readyForUpdates: () => void;
  removeSetupMenuItems: () => unknown;
  setAutoHideMenuBar: (value: boolean) => void;
  setAutoLaunch: (value: boolean) => Promise<void>;
  setBadge: (badge: number | 'marked-unread') => void;
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
    calling: CallingClass;
    backups: BackupsService;
    initializeGroupCredentialFetcher: () => Promise<void>;
    initializeNetworkObserver: (
      network: ReduxActions['network'],
      getAuthSocketStatus: () => SocketStatus
    ) => void;
    initializeUpdateListener: (updates: ReduxActions['updates']) => void;
    retryPlaceholders?: RetryPlaceholders;
    lightSessionResetQueue?: PQueue;
    storage: typeof StorageService;
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
  conversationControllerStart: () => void;
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
    getConversations: () => ConversationModelCollectionType;
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

    getServerTrustRoot: () => string;
    logAuthenticatedConnect?: () => void;

    // ========================================================================
    // The types below have been somewhat organized. See DESKTOP-4801
    // ========================================================================

    // Backbone
    Backbone: typeof Backbone;

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
  }
}

export type WhisperType = {
  Conversation: typeof ConversationModel;
  ConversationCollection: typeof ConversationModelCollectionType;

  deliveryReceiptQueue: PQueue;
  deliveryReceiptBatcher: BatcherType<Receipt>;
  events: Backbone.Events;
};
