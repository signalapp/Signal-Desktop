// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import { Store } from 'redux';
import * as Backbone from 'backbone';
import * as Underscore from 'underscore';
import moment from 'moment';
import PQueue from 'p-queue/dist';
import { Ref } from 'react';
import { imageToBlurHash } from './util/imageToBlurHash';
import * as Util from './util';
import {
  ConversationModelCollectionType,
  MessageModelCollectionType,
} from './model-types.d';
import { TextSecureType } from './textsecure.d';
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
import { getEnvironment } from './environment';
import { LocalizerType } from './types/Util';
import type { Receipt } from './types/Receipt';
import { ConversationController } from './ConversationController';
import { ReduxActions } from './state/types';
import { createStore } from './state/createStore';
import { createApp } from './state/roots/createApp';
import { createChatColorPicker } from './state/roots/createChatColorPicker';
import { createConversationDetails } from './state/roots/createConversationDetails';
import { createForwardMessageModal } from './state/roots/createForwardMessageModal';
import { createGroupLinkManagement } from './state/roots/createGroupLinkManagement';
import { createGroupV1MigrationModal } from './state/roots/createGroupV1MigrationModal';
import { createGroupV2JoinModal } from './state/roots/createGroupV2JoinModal';
import { createGroupV2Permissions } from './state/roots/createGroupV2Permissions';
import { createLeftPane } from './state/roots/createLeftPane';
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
import { ContactWithHydratedAvatar } from './textsecure/SendMessage';
import Data from './sql/Client';
import { PhoneNumberFormat } from 'google-libphonenumber';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { BatcherType } from './util/batcher';
import { AttachmentList } from './components/conversation/AttachmentList';
import { ChatColorPicker } from './components/ChatColorPicker';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ContactDetail } from './components/conversation/ContactDetail';
import { ContactModal } from './components/conversation/ContactModal';
import { ErrorModal } from './components/ErrorModal';
import { Lightbox } from './components/Lightbox';
import { MediaGallery } from './components/conversation/media-gallery/MediaGallery';
import { MessageDetail } from './components/conversation/MessageDetail';
import { ProgressModal } from './components/ProgressModal';
import { Quote } from './components/conversation/Quote';
import { StagedLinkPreview } from './components/conversation/StagedLinkPreview';
import { DisappearingTimeDialog } from './components/DisappearingTimeDialog';
import { WhatsNewLink } from './components/WhatsNewLink';
import { DownloadedAttachmentType } from './types/Attachment';
import { ElectronLocaleType } from './util/mapToSupportLocale';
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
import type { EmbeddedContactType } from './types/EmbeddedContact';

export { Long } from 'long';

export type WhatIsThis = any;

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

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    startApp: () => void;

    removeSetupMenuItems: () => unknown;
    showPermissionsPopup: (
      forCalling: boolean,
      forCamera: boolean
    ) => Promise<void>;

    FontFace: typeof FontFace;
    _: typeof Underscore;
    $: typeof jQuery;

    moment: typeof moment;
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

    WhatIsThis: WhatIsThis;

    addSetupMenuItems: () => void;
    attachmentDownloadQueue: Array<MessageModel> | undefined;
    startupProcessingQueue: StartupQueue | undefined;
    baseAttachmentsPath: string;
    baseStickersPath: string;
    baseTempPath: string;
    crashReports: {
      getCount: () => Promise<number>;
      upload: () => Promise<void>;
      erase: () => Promise<void>;
    };
    drawAttention: () => void;
    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAccountManager: () => AccountManager;
    getBuiltInImages: () => Promise<Array<string>>;
    getConversations: () => ConversationModelCollectionType;
    getBuildCreation: () => number;
    getEnvironment: typeof getEnvironment;
    getExpiration: () => string;
    getHostName: () => string;
    getInboxCollection: () => ConversationModelCollectionType;
    getInteractionMode: () => 'mouse' | 'keyboard';
    getLocale: () => ElectronLocaleType;
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
    isActive: () => boolean;
    isAfterVersion: (version: string, anotherVersion: string) => boolean;
    isBeforeVersion: (version: string, anotherVersion: string) => boolean;
    isFullScreen: () => boolean;
    libphonenumber: {
      util: {
        getRegionCodeForNumber: (number: string) => string;
        parseNumber: (
          e164: string,
          defaultRegionCode?: string
        ) =>
          | { isValidNumber: false; error: unknown }
          | {
              isValidNumber: true;
              regionCode: string | undefined;
              countryCode: string;
              nationalNumber: string;
              e164: string;
            };
      };
      parse: (number: string) => string;
      getRegionCodeForNumber: (number: string) => string;
      format: (number: string, format: PhoneNumberFormat) => string;
    };
    nodeSetImmediate: typeof setImmediate;
    onFullScreenChange: (fullScreen: boolean) => void;
    platform: string;
    preloadedImages: Array<WhatIsThis>;
    reduxActions: ReduxActions;
    reduxStore: Store<StateType>;
    registerForActive: (handler: () => void) => void;
    restart: () => void;
    setImmediate: typeof setImmediate;
    showWindow: () => void;
    showSettings: () => void;
    shutdown: () => void;
    showDebugLog: () => void;
    sendChallengeRequest: (request: IPCChallengeRequest) => void;
    setAutoHideMenuBar: (value: WhatIsThis) => void;
    setBadgeCount: (count: number) => void;
    setMenuBarVisibility: (value: WhatIsThis) => void;
    updateSystemTraySetting: (value: SystemTraySetting) => void;
    showConfirmationDialog: (options: ConfirmationDialogViewProps) => void;
    showKeyboardShortcuts: () => void;
    storage: Storage;
    systemTheme: WhatIsThis;
    textsecure: TextSecureType;
    titleBarDoubleClick: () => void;
    unregisterForActive: (handler: () => void) => void;
    updateTrayIcon: (count: number) => void;
    Backbone: typeof Backbone;
    CI?: CI;

    Accessibility: {
      reducedMotionSetting: boolean;
    };
    Signal: {
      Backbone: any;
      Crypto: typeof Crypto;
      Curve: typeof Curve;
      Data: typeof Data;
      Groups: typeof Groups;
      RemoteConfig: typeof RemoteConfig;
      Services: {
        calling: CallingClass;
        enableStorageService: () => boolean;
        eraseAllStorageServiceState: (options?: {
          keepUnknownFields?: boolean;
        }) => Promise<void>;
        initializeGroupCredentialFetcher: () => void;
        initializeNetworkObserver: (network: ReduxActions['network']) => void;
        initializeUpdateListener: (updates: ReduxActions['updates']) => void;
        retryPlaceholders?: Util.RetryPlaceholders;
        lightSessionResetQueue?: PQueue;
        runStorageServiceSyncJob: () => Promise<void>;
        storageServiceUploadJob: () => void;
      };
      Migrations: {
        readTempData: (path: string) => Promise<Uint8Array>;
        deleteAttachmentData: (path: string) => Promise<void>;
        doesAttachmentExist: (path: string) => Promise<boolean>;
        writeNewAttachmentData: (data: Uint8Array) => Promise<string>;
        deleteExternalMessageFiles: (attributes: unknown) => Promise<void>;
        getAbsoluteAttachmentPath: (path: string) => string;
        loadAttachmentData: <T extends { path?: string }>(
          attachment: T
        ) => Promise<
          T & {
            data: Uint8Array;
            size: number;
          }
        >;
        loadQuoteData: (quote: unknown) => WhatIsThis;
        loadContactData: (
          contact?: Array<EmbeddedContactType>
        ) => Promise<Array<ContactWithHydratedAvatar> | undefined>;
        loadPreviewData: (preview: unknown) => WhatIsThis;
        loadStickerData: (sticker: unknown) => WhatIsThis;
        readStickerData: (path: string) => Promise<Uint8Array>;
        deleteSticker: (path: string) => Promise<void>;
        getAbsoluteStickerPath: (path: string) => string;
        processNewEphemeralSticker: (stickerData: Uint8Array) => {
          path: string;
          width: number;
          height: number;
        };
        processNewSticker: (stickerData: Uint8Array) => {
          path: string;
          width: number;
          height: number;
        };
        copyIntoAttachmentsDirectory: (
          path: string
        ) => Promise<{ path: string; size: number }>;
        upgradeMessageSchema: (attributes: unknown) => WhatIsThis;
        processNewAttachment: (
          attachment: DownloadedAttachmentType
        ) => Promise<DownloadedAttachmentType>;

        copyIntoTempDirectory: (
          path: string
        ) => Promise<{ path: string; size: number }>;
        deleteDraftFile: (path: string) => Promise<void>;
        deleteTempFile: (path: string) => Promise<void>;
        getAbsoluteDraftPath: any;
        getAbsoluteTempPath: any;
        openFileInFolder: any;
        readAttachmentData: (path: string) => Promise<Uint8Array>;
        readDraftData: (path: string) => Promise<Uint8Array>;
        saveAttachmentToDisk: (options: {
          data: Uint8Array;
          name: string;
        }) => Promise<null | { fullPath: string; name: string }>;
        writeNewDraftData: (data: Uint8Array) => Promise<string>;
        deleteAvatar: (path: string) => Promise<void>;
        getAbsoluteAvatarPath: (src: string) => string;
        writeNewAvatarData: (data: Uint8Array) => Promise<string>;
        getAbsoluteBadgeImageFilePath: (path: string) => string;
        writeNewBadgeImageFileData: (data: Uint8Array) => Promise<string>;
      };
      Types: {
        Message: {
          CURRENT_SCHEMA_VERSION: number;
          VERSION_NEEDED_FOR_DISPLAY: number;
          GROUP: 'group';
          PRIVATE: 'private';

          initializeSchemaVersion: (version: {
            message: unknown;
            logger: unknown;
          }) => unknown & {
            schemaVersion: number;
          };
          hasExpiration: (json: string) => boolean;
        };
        Sticker: {
          emoji: string;
          packId: string;
          packKey: string;
          stickerId: number;
          data: {
            pending: boolean;
            path: string;
          };
          width: number;
          height: number;
          path: string;
        };
        UUID: typeof UUID;
        Address: typeof Address;
        QualifiedAddress: typeof QualifiedAddress;
      };
      Util: typeof Util;
      Components: {
        AttachmentList: typeof AttachmentList;
        ChatColorPicker: typeof ChatColorPicker;
        ConfirmationDialog: typeof ConfirmationDialog;
        ContactDetail: typeof ContactDetail;
        ContactModal: typeof ContactModal;
        DisappearingTimeDialog: typeof DisappearingTimeDialog;
        ErrorModal: typeof ErrorModal;
        Lightbox: typeof Lightbox;
        MediaGallery: typeof MediaGallery;
        MessageDetail: typeof MessageDetail;
        ProgressModal: typeof ProgressModal;
        Quote: typeof Quote;
        StagedLinkPreview: typeof StagedLinkPreview;
        WhatsNewLink: typeof WhatsNewLink;
      };
      OS: typeof OS;
      Workflow: {
        MessageDataMigrator: WhatIsThis;
      };
      IndexedDB: {
        removeDatabase: WhatIsThis;
        doesDatabaseExist: WhatIsThis;
      };
      Views: WhatIsThis;
      State: {
        createStore: typeof createStore;
        Roots: {
          createApp: typeof createApp;
          createChatColorPicker: typeof createChatColorPicker;
          createConversationDetails: typeof createConversationDetails;
          createForwardMessageModal: typeof createForwardMessageModal;
          createGroupLinkManagement: typeof createGroupLinkManagement;
          createGroupV1MigrationModal: typeof createGroupV1MigrationModal;
          createGroupV2JoinModal: typeof createGroupV2JoinModal;
          createGroupV2Permissions: typeof createGroupV2Permissions;
          createLeftPane: typeof createLeftPane;
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
      conversationControllerStart: WhatIsThis;
      Emojis: {
        getInitialState: () => WhatIsThis;
        load: () => void;
      };
      challengeHandler: ChallengeHandler;
    };

    ConversationController: ConversationController;
    Events: IPCEventsType;
    MessageController: MessageController;
    SignalProtocolStore: typeof SignalProtocolStore;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;

    getServerTrustRoot: () => WhatIsThis;
    readyForUpdates: () => void;
    logAppLoadedEvent?: (options: { processedCount?: number }) => void;
    logAuthenticatedConnect?: () => void;

    // Runtime Flags
    isShowingModal?: boolean;

    // Feature Flags
    GV2_ENABLE_SINGLE_CHANGE_PROCESSING: boolean;
    GV2_ENABLE_CHANGE_PROCESSING: boolean;
    GV2_ENABLE_STATE_PROCESSING: boolean;
    GV2_MIGRATION_DISABLE_ADD: boolean;
    GV2_MIGRATION_DISABLE_INVITE: boolean;

    RETRY_DELAY: boolean;

    // Context Isolation
    SignalContext: SignalContextType;
  }

  // We want to extend `Error`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Error {
    originalError?: Event;
    reason?: any;
    stackForLog?: string;
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

export class AnyViewClass extends window.Backbone.View<any> {
  public headerTitle?: string;
  static show(view: typeof AnyViewClass, element: Element): void;

  constructor(options?: any);
}

export class BasicReactWrapperViewClass extends AnyViewClass {
  public update(options: any): void;
}

export type WhisperType = {
  Conversation: typeof ConversationModel;
  ConversationCollection: typeof ConversationModelCollectionType;
  Message: typeof MessageModel;
  MessageCollection: typeof MessageModelCollectionType;

  GroupMemberConversation: WhatIsThis;
  WallClockListener: WhatIsThis;

  deliveryReceiptQueue: PQueue;
  deliveryReceiptBatcher: BatcherType<Receipt>;
  events: Backbone.Events;
  activeConfirmationView: WhatIsThis;

  Database: {
    open: () => Promise<IDBDatabase>;
    handleDOMException: (
      context: string,
      error: DOMException | null,
      reject: Function
    ) => void;
  };

  ExpiringMessagesListener: {
    init: (events: Backbone.Events) => void;
    update: () => void;
  };
  TapToViewMessagesListener: {
    nextCheck: null | number;
    init: (events: Backbone.Events) => void;
    update: () => void;
  };

  // Backbone views

  // Modernized
  ConversationView: typeof ConversationView;

  // Note: we can no longer use 'View.extend' once we've moved to Typescript's preferred
  //   'extend View' syntax. Thus, we'll need to typescriptify most of it at once.

  ClearDataView: typeof AnyViewClass;
  ConversationLoadingScreen: typeof AnyViewClass;
  GroupMemberList: typeof AnyViewClass;
  InboxView: typeof AnyViewClass;
  KeyVerificationPanelView: typeof AnyViewClass;
  ReactWrapperView: typeof BasicReactWrapperViewClass;
  SafetyNumberChangeDialogView: typeof AnyViewClass;
  View: typeof AnyViewClass;
};
