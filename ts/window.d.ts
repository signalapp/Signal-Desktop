// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import type { Cancelable } from 'lodash';
import { Store } from 'redux';
import * as Backbone from 'backbone';
import * as Underscore from 'underscore';
import PQueue from 'p-queue/dist';
import { Ref } from 'react';
import { assert } from 'chai';

import { imageToBlurHash } from './util/imageToBlurHash';
import * as Util from './util';
import {
  ConversationModelCollectionType,
  MessageModelCollectionType,
} from './model-types.d';
import { textsecure } from './textsecure';
import { Storage } from './textsecure/Storage';
import {
  ChallengeHandler,
  IPCRequest as IPCChallengeRequest,
} from './challenge';
import { WebAPIConnectType } from './textsecure/WebAPI';
import { CallingClass } from './services/calling';
import * as Groups from './groups';
import * as Crypto from './Crypto';
import * as Curve from './Curve';
import * as RemoteConfig from './RemoteConfig';
import * as OS from './OS';
import { Environment, getEnvironment } from './environment';
import { LocalizerType, ThemeType } from './types/Util';
import type { Receipt } from './types/Receipt';
import { ConversationController } from './ConversationController';
import { ReduxActions } from './state/types';
import { createStore } from './state/createStore';
import { createApp } from './state/roots/createApp';
import { createChatColorPicker } from './state/roots/createChatColorPicker';
import { createConversationDetails } from './state/roots/createConversationDetails';
import { createGroupLinkManagement } from './state/roots/createGroupLinkManagement';
import { createGroupV1MigrationModal } from './state/roots/createGroupV1MigrationModal';
import { createGroupV2JoinModal } from './state/roots/createGroupV2JoinModal';
import { createGroupV2Permissions } from './state/roots/createGroupV2Permissions';
import { createMessageDetail } from './state/roots/createMessageDetail';
import { createConversationNotificationsSettings } from './state/roots/createConversationNotificationsSettings';
import { createPendingInvites } from './state/roots/createPendingInvites';
import { createSafetyNumberViewer } from './state/roots/createSafetyNumberViewer';
import { createShortcutGuideModal } from './state/roots/createShortcutGuideModal';
import { createStickerManager } from './state/roots/createStickerManager';
import { createStickerPreviewModal } from './state/roots/createStickerPreviewModal';
import * as appDuck from './state/ducks/app';
import * as callingDuck from './state/ducks/calling';
import * as conversationsDuck from './state/ducks/conversations';
import * as emojisDuck from './state/ducks/emojis';
import * as expirationDuck from './state/ducks/expiration';
import * as itemsDuck from './state/ducks/items';
import * as linkPreviewsDuck from './state/ducks/linkPreviews';
import * as networkDuck from './state/ducks/network';
import * as updatesDuck from './state/ducks/updates';
import * as userDuck from './state/ducks/user';
import * as searchDuck from './state/ducks/search';
import * as stickersDuck from './state/ducks/stickers';
import * as conversationsSelectors from './state/selectors/conversations';
import * as searchSelectors from './state/selectors/search';
import AccountManager from './textsecure/AccountManager';
import Data from './sql/Client';
import { PhoneNumber, PhoneNumberFormat } from 'google-libphonenumber';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { BatcherType } from './util/batcher';
import { AttachmentList } from './components/conversation/AttachmentList';
import { ChatColorPicker } from './components/ChatColorPicker';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ContactModal } from './components/conversation/ContactModal';
import { MessageDetail } from './components/conversation/MessageDetail';
import { Quote } from './components/conversation/Quote';
import { StagedLinkPreview } from './components/conversation/StagedLinkPreview';
import { DisappearingTimeDialog } from './components/DisappearingTimeDialog';
import { SignalProtocolStore } from './SignalProtocolStore';
import { StartupQueue } from './util/StartupQueue';
import { SocketStatus } from './types/SocketStatus';
import SyncRequest from './textsecure/SyncRequest';
import { MessageController } from './util/MessageController';
import { StateType } from './state/reducer';
import { SystemTraySetting } from './types/SystemTraySetting';
import { UUID } from './types/UUID';
import { Address } from './types/Address';
import { QualifiedAddress } from './types/QualifiedAddress';
import { CI } from './CI';
import { IPCEventsType } from './util/createIPCEvents';
import { ConversationView } from './views/conversation_view';
import type { SignalContextType } from './windows/context';
import type * as Message2 from './types/Message2';
import type { initializeMigrations } from './signal';
import { RendererConfigType } from './types/RendererConfig';

export { Long } from 'long';

// Synced with the type in ts/shims/showConfirmationDialog
// we are duplicating it here because that file cannot import/export.
type ConfirmationDialogViewProps = {
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
    enableStorageService: () => void;
    eraseAllStorageServiceState: (options?: {
      keepUnknownFields?: boolean | undefined;
    }) => Promise<void>;
    initializeGroupCredentialFetcher: () => Promise<void>;
    initializeNetworkObserver: (network: ReduxActions['network']) => void;
    initializeUpdateListener: (updates: ReduxActions['updates']) => void;
    retryPlaceholders?: Util.RetryPlaceholders;
    lightSessionResetQueue?: PQueue;
    runStorageServiceSyncJob: (() => void) & Cancelable;
    storageServiceUploadJob: (() => void) & Cancelable;
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
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
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
    loadImage: any;
    isBehindProxy: () => boolean;
    getAutoLaunch: () => Promise<boolean>;
    setAutoLaunch: (value: boolean) => Promise<void>;

    PQueue: typeof PQueue;
    PQueueType: PQueue;
    Mustache: {
      render: (template: string, data: any, partials?: any) => string;
      parse: (template: string) => void;
    };
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
    // Used in test/index.html, and therefore not type-checked!
    testUtilities: {
      onComplete: (data: any) => void;
      prepareTests: () => void;
    };
  }

  // We want to extend `Error`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Error {
    originalError?: Event;
    reason?: any;
    stackForLog?: string;

    // Used in sticker creator to attach messages to errors
    errorMessageI18nKey?: string;
  }

  // We want to extend `Element`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
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
    __array_buffer: never;
  }

  interface SharedArrayBuffer {
    __array_buffer: never;
  }
}

export class CertificateValidatorType {
  validate: (cerficate: any, certificateTime: number) => Promise<void>;
}

export class GumVideoCapturer {
  constructor(
    maxWidth: number,
    maxHeight: number,
    maxFramerate: number,
    localPreview: Ref<HTMLVideoElement>
  );
}

export class CanvasVideoRenderer {
  constructor(canvas: Ref<HTMLCanvasElement>);
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
