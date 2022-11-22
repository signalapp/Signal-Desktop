// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import type { Store } from 'redux';
import type * as Backbone from 'backbone';
import type * as Underscore from 'underscore';
import type PQueue from 'p-queue/dist';
import type { assert } from 'chai';
import type * as Mustache from 'mustache';

import type { PhoneNumber, PhoneNumberFormat } from 'google-libphonenumber';
import type { imageToBlurHash } from './util/imageToBlurHash';
import type * as Util from './util';
import type {
  ConversationModelCollectionType,
  MessageModelCollectionType,
} from './model-types.d';
import type { textsecure } from './textsecure';
import type { Storage } from './textsecure/Storage';
import type {
  ChallengeHandler,
  IPCRequest as IPCChallengeRequest,
} from './challenge';
import type { WebAPIConnectType } from './textsecure/WebAPI';
import type { CallingClass } from './services/calling';
import type * as StorageService from './services/storage';
import type * as Groups from './groups';
import type * as Crypto from './Crypto';
import type * as Curve from './Curve';
import type * as RemoteConfig from './RemoteConfig';
import type * as OS from './OS';
import type { getEnvironment } from './environment';
import type { LocalizerType, ThemeType } from './types/Util';
import type { Receipt } from './types/Receipt';
import type { ConversationController } from './ConversationController';
import type { ReduxActions } from './state/types';
import type { createStore } from './state/createStore';
import type { createApp } from './state/roots/createApp';
import type { createChatColorPicker } from './state/roots/createChatColorPicker';
import type { createConversationDetails } from './state/roots/createConversationDetails';
import type { createGroupLinkManagement } from './state/roots/createGroupLinkManagement';
import type { createGroupV1MigrationModal } from './state/roots/createGroupV1MigrationModal';
import type { createGroupV2JoinModal } from './state/roots/createGroupV2JoinModal';
import type { createGroupV2Permissions } from './state/roots/createGroupV2Permissions';
import type { createMessageDetail } from './state/roots/createMessageDetail';
import type { createConversationNotificationsSettings } from './state/roots/createConversationNotificationsSettings';
import type { createPendingInvites } from './state/roots/createPendingInvites';
import type { createSafetyNumberViewer } from './state/roots/createSafetyNumberViewer';
import type { createShortcutGuideModal } from './state/roots/createShortcutGuideModal';
import type { createStickerManager } from './state/roots/createStickerManager';
import type { createStickerPreviewModal } from './state/roots/createStickerPreviewModal';
import type * as appDuck from './state/ducks/app';
import type * as callingDuck from './state/ducks/calling';
import type * as conversationsDuck from './state/ducks/conversations';
import type * as emojisDuck from './state/ducks/emojis';
import type * as expirationDuck from './state/ducks/expiration';
import type * as itemsDuck from './state/ducks/items';
import type * as linkPreviewsDuck from './state/ducks/linkPreviews';
import type * as networkDuck from './state/ducks/network';
import type * as updatesDuck from './state/ducks/updates';
import type * as userDuck from './state/ducks/user';
import type * as searchDuck from './state/ducks/search';
import type * as stickersDuck from './state/ducks/stickers';
import type * as conversationsSelectors from './state/selectors/conversations';
import type * as searchSelectors from './state/selectors/search';
import type AccountManager from './textsecure/AccountManager';
import type Data from './sql/Client';
import type { MessageModel } from './models/messages';
import type { ConversationModel } from './models/conversations';
import type { BatcherType } from './util/batcher';
import type { AttachmentList } from './components/conversation/AttachmentList';
import type { ChatColorPicker } from './components/ChatColorPicker';
import type { ConfirmationDialog } from './components/ConfirmationDialog';
import type { ContactModal } from './components/conversation/ContactModal';
import type { MessageDetail } from './components/conversation/MessageDetail';
import type { Quote } from './components/conversation/Quote';
import type { StagedLinkPreview } from './components/conversation/StagedLinkPreview';
import type { DisappearingTimeDialog } from './components/DisappearingTimeDialog';
import type { SignalProtocolStore } from './SignalProtocolStore';
import type { StartupQueue } from './util/StartupQueue';
import type { SocketStatus } from './types/SocketStatus';
import type SyncRequest from './textsecure/SyncRequest';
import type { MessageController } from './util/MessageController';
import type { StateType } from './state/reducer';
import type { SystemTraySetting } from './types/SystemTraySetting';
import type { UUID } from './types/UUID';
import type { Address } from './types/Address';
import type { QualifiedAddress } from './types/QualifiedAddress';
import type { CI } from './CI';
import type { IPCEventsType } from './util/createIPCEvents';
import type { ConversationView } from './views/conversation_view';
import type { SignalContextType } from './windows/context';
import type * as Message2 from './types/Message2';
import type { initializeMigrations } from './signal';

export { Long } from 'long';

// Synced with the type in ts/shims/showConfirmationDialog
// we are duplicating it here because that file cannot import/export.
type ConfirmationDialogViewProps = {
  dialogName: string;
  cancelText?: string;
  confirmStyle?: 'affirmative' | 'negative';
  message: string;
  okText: string;
  reject?: (error: Error) => void;
  resolve: () => void;
};

export declare class WebAudioRecorderClass {
  constructor(
    node: GainNode,
    options: {
      encoding: string;
      workerDir: string;
      options?: { timeLimit?: number };
    }
  );

  // Callbacks
  onComplete?: (recorder: WebAudioRecorderClass, blob: Blob) => unknown;
  onError?: (recorder: WebAudioRecorderClass, error: Error) => unknown;
  onTimeout?: () => unknown;

  // Class properties
  startRecording: () => unknown;
  finishRecording: () => unknown;
  isRecording: () => boolean;
  cancelRecording: () => unknown;
  worker: Worker;
}

export type SignalCoreType = {
  Crypto: typeof Crypto;
  Curve: typeof Curve;
  Data: typeof Data;
  Groups: typeof Groups;
  RemoteConfig: typeof RemoteConfig;
  Services: {
    calling: CallingClass;
    initializeGroupCredentialFetcher: () => Promise<void>;
    initializeNetworkObserver: (network: ReduxActions['network']) => void;
    initializeUpdateListener: (updates: ReduxActions['updates']) => void;
    retryPlaceholders?: Util.RetryPlaceholders;
    lightSessionResetQueue?: PQueue;
    storage: typeof StorageService;
  };
  Migrations: ReturnType<typeof initializeMigrations>;
  Types: {
    Message: typeof Message2;
    UUID: typeof UUID;
    Address: typeof Address;
    QualifiedAddress: typeof QualifiedAddress;
  };
  Util: typeof Util;
  Components: {
    AttachmentList: typeof AttachmentList;
    ChatColorPicker: typeof ChatColorPicker;
    ConfirmationDialog: typeof ConfirmationDialog;
    ContactModal: typeof ContactModal;
    DisappearingTimeDialog: typeof DisappearingTimeDialog;
    MessageDetail: typeof MessageDetail;
    Quote: typeof Quote;
    StagedLinkPreview: typeof StagedLinkPreview;
  };
  OS: typeof OS;
  State: {
    createStore: typeof createStore;
    Roots: {
      createApp: typeof createApp;
      createChatColorPicker: typeof createChatColorPicker;
      createConversationDetails: typeof createConversationDetails;
      createGroupLinkManagement: typeof createGroupLinkManagement;
      createGroupV1MigrationModal: typeof createGroupV1MigrationModal;
      createGroupV2JoinModal: typeof createGroupV2JoinModal;
      createGroupV2Permissions: typeof createGroupV2Permissions;
      createMessageDetail: typeof createMessageDetail;
      createConversationNotificationsSettings: typeof createConversationNotificationsSettings;
      createPendingInvites: typeof createPendingInvites;
      createSafetyNumberViewer: typeof createSafetyNumberViewer;
      createShortcutGuideModal: typeof createShortcutGuideModal;
      createStickerManager: typeof createStickerManager;
      createStickerPreviewModal: typeof createStickerPreviewModal;
    };
    Ducks: {
      app: typeof appDuck;
      calling: typeof callingDuck;
      conversations: typeof conversationsDuck;
      emojis: typeof emojisDuck;
      expiration: typeof expirationDuck;
      items: typeof itemsDuck;
      linkPreviews: typeof linkPreviewsDuck;
      network: typeof networkDuck;
      updates: typeof updatesDuck;
      user: typeof userDuck;
      search: typeof searchDuck;
      stickers: typeof stickersDuck;
    };
    Selectors: {
      conversations: typeof conversationsSelectors;
      search: typeof searchSelectors;
    };
  };
  conversationControllerStart: () => void;
  challengeHandler?: ChallengeHandler;
};

declare global {
  // We want to extend various globals, so we need to use interfaces.
  /* eslint-disable no-restricted-syntax */
  interface Window {
    // Used in Sticker Creator to create proper paths to emoji images
    ROOT_PATH?: string;
    // Used for sticker creator localization
    localeMessages: { [key: string]: { message: string } };

    // Note: used in background.html, and not type-checked
    startApp: () => void;

    preloadStartTime: number;
    preloadEndTime: number;

    removeSetupMenuItems: () => unknown;
    showPermissionsPopup: (
      forCalling: boolean,
      forCamera: boolean
    ) => Promise<void>;

    FontFace: typeof FontFace;
    _: typeof Underscore;
    $: typeof jQuery;

    imageToBlurHash: typeof imageToBlurHash;
    isBehindProxy: () => boolean;
    getAutoLaunch: () => Promise<boolean>;
    setAutoLaunch: (value: boolean) => Promise<void>;

    Mustache: typeof Mustache;
    WebAudioRecorder: typeof WebAudioRecorderClass;

    addSetupMenuItems: () => void;
    attachmentDownloadQueue: Array<MessageModel> | undefined;
    startupProcessingQueue: StartupQueue | undefined;
    baseAttachmentsPath: string;
    baseStickersPath: string;
    baseTempPath: string;
    baseDraftPath: string;
    closeAbout: () => void;
    crashReports: {
      getCount: () => Promise<number>;
      upload: () => Promise<void>;
      erase: () => Promise<void>;
    };
    drawAttention: () => void;
    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAccountManager: () => AccountManager;
    getAppInstance: () => string | undefined;
    getBuiltInImages: () => Promise<Array<string>>;
    getConversations: () => ConversationModelCollectionType;
    getBuildCreation: () => number;
    getEnvironment: typeof getEnvironment;
    getExpiration: () => number;
    getHostName: () => string;
    getInteractionMode: () => 'mouse' | 'keyboard';
    getLocale: () => string;
    getMediaCameraPermissions: () => Promise<boolean>;
    getMediaPermissions: () => Promise<boolean>;
    getServerPublicParams: () => string;
    getSfuUrl: () => string;
    getSocketStatus: () => SocketStatus;
    getSyncRequest: (timeoutMillis?: number) => SyncRequest;
    getTitle: () => string;
    waitForEmptyEventQueue: () => Promise<void>;
    getVersion: () => string;
    i18n: LocalizerType;
    isAfterVersion: (version: string, anotherVersion: string) => boolean;
    isBeforeVersion: (version: string, anotherVersion: string) => boolean;
    isFullScreen: () => boolean;
    isMaximized: () => boolean;
    initialTheme?: ThemeType;
    libphonenumberInstance: {
      parse: (number: string) => PhoneNumber;
      getRegionCodeForNumber: (number: PhoneNumber) => string | undefined;
      format: (number: PhoneNumber, format: PhoneNumberFormat) => string;
    };
    libphonenumberFormat: typeof PhoneNumberFormat;
    nodeSetImmediate: typeof setImmediate;
    onFullScreenChange: (fullScreen: boolean, maximized: boolean) => void;
    platform: string;
    preloadedImages: Array<HTMLImageElement>;
    reduxActions: ReduxActions;
    reduxStore: Store<StateType>;
    restart: () => void;
    setImmediate: typeof setImmediate;
    showWindow: () => void;
    showSettings: () => void;
    shutdown: () => void;
    showDebugLog: () => void;
    sendChallengeRequest: (request: IPCChallengeRequest) => void;
    setAutoHideMenuBar: (value: boolean) => void;
    setBadgeCount: (count: number) => void;
    setMenuBarVisibility: (value: boolean) => void;
    updateSystemTraySetting: (value: SystemTraySetting) => void;
    showConfirmationDialog: (options: ConfirmationDialogViewProps) => void;
    showKeyboardShortcuts: () => void;
    storage: Storage;
    systemTheme: ThemeType;
    textsecure: typeof textsecure;
    titleBarDoubleClick: () => void;
    updateTrayIcon: (count: number) => void;
    Backbone: typeof Backbone;
    CI?: CI;

    Accessibility: {
      reducedMotionSetting: boolean;
    };
    Signal: SignalCoreType;

    ConversationController: ConversationController;
    Events: IPCEventsType;
    MessageController: MessageController;
    SignalProtocolStore: typeof SignalProtocolStore;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;

    getServerTrustRoot: () => string;
    readyForUpdates: () => void;
    logAppLoadedEvent?: (options: { processedCount?: number }) => void;
    logAuthenticatedConnect?: () => void;

    // Runtime Flags
    isShowingModal?: boolean;

    // Feature Flags
    GV2_ENABLE_SINGLE_CHANGE_PROCESSING: boolean;
    GV2_ENABLE_CHANGE_PROCESSING: boolean;
    GV2_ENABLE_STATE_PROCESSING: boolean;
    GV2_ENABLE_PRE_JOIN_FETCH: boolean;
    GV2_MIGRATION_DISABLE_ADD: boolean;
    GV2_MIGRATION_DISABLE_INVITE: boolean;

    RETRY_DELAY: boolean;

    // Context Isolation
    SignalContext: SignalContextType;

    // Test only
    assert: typeof assert;
    testUtilities: {
      onComplete: (info: unknown) => void;
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
  Conversation: typeof ConversationModel;
  ConversationCollection: typeof ConversationModelCollectionType;
  Message: typeof MessageModel;
  MessageCollection: typeof MessageModelCollectionType;

  deliveryReceiptQueue: PQueue;
  deliveryReceiptBatcher: BatcherType<Receipt>;
  events: Backbone.Events;

  // Backbone views

  ConversationView: typeof ConversationView;

  // Note: we can no longer use 'View.extend' once we've moved to Typescript's preferred
  //   'extend View' syntax. Thus, we'll need to typescriptify most of it at once.

  InboxView: typeof Backbone.View;
  View: typeof Backbone.View;
};
