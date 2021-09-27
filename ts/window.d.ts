// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import { DeepPartial, Store } from 'redux';
import * as Backbone from 'backbone';
import * as Underscore from 'underscore';
import moment from 'moment';
import PQueue from 'p-queue/dist';
import { Attributes, ComponentClass, FunctionComponent, Ref } from 'react';
import { imageToBlurHash } from './util/imageToBlurHash';
import * as Util from './util';
import {
  ConversationModelCollectionType,
  MessageModelCollectionType,
  MessageAttributesType,
  ReactionAttributesType,
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
import * as zkgroup from './util/zkgroup';
import { LocalizerType, BodyRangesType, BodyRangeType } from './types/Util';
import * as Attachment from './types/Attachment';
import * as MIME from './types/MIME';
import * as EmbeddedContact from './types/EmbeddedContact';
import * as Errors from './types/errors';
import { ConversationController } from './ConversationController';
import { ReduxActions } from './state/types';
import { createStore } from './state/createStore';
import { createApp } from './state/roots/createApp';
import { createChatColorPicker } from './state/roots/createChatColorPicker';
import { createCompositionArea } from './state/roots/createCompositionArea';
import { createConversationDetails } from './state/roots/createConversationDetails';
import { createConversationHeader } from './state/roots/createConversationHeader';
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
import { createTimeline } from './state/roots/createTimeline';
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
import { SendOptionsType } from './textsecure/SendMessage';
import Data from './sql/Client';
import { UserMessage } from './types/Message';
import { PhoneNumberFormat } from 'google-libphonenumber';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { combineNames } from './util';
import { BatcherType } from './util/batcher';
import { AttachmentList } from './components/conversation/AttachmentList';
import { CaptionEditor } from './components/CaptionEditor';
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
import { WhatsNew } from './components/WhatsNew';
import { MIMEType } from './types/MIME';
import { DownloadedAttachmentType } from './types/Attachment';
import { ElectronLocaleType } from './util/mapToSupportLocale';
import { SignalProtocolStore } from './SignalProtocolStore';
import { Context as SignalContext } from './context';
import { StartupQueue } from './util/StartupQueue';
import * as synchronousCrypto from './util/synchronousCrypto';
import { SocketStatus } from './types/SocketStatus';
import SyncRequest from './textsecure/SyncRequest';
import { ConversationColorType, CustomColorType } from './types/Colors';
import { MessageController } from './util/MessageController';
import { isValidGuid } from './util/isValidGuid';
import { StateType } from './state/reducer';
import { SystemTraySetting } from './types/SystemTraySetting';
import { UUID } from './types/UUID';
import { Address } from './types/Address';
import { QualifiedAddress } from './types/QualifiedAddress';
import { CI } from './CI';
import { IPCEventsType, IPCEventsValuesType } from './util/createIPCEvents';
import { ConversationView } from './views/conversation_view';
import { DebugLogView } from './views/debug_log_view';
import { LoggerType } from './types/Logging';
import { SettingType } from './util/preload';

export { Long } from 'long';

type TaskResultType = any;

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

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    startApp: () => void;

    QRCode: any;
    WebAudioRecorder: any;
    closeDebugLog: () => unknown;
    removeSetupMenuItems: () => unknown;
    showPermissionsPopup: () => unknown;

    FontFace: typeof FontFace;
    _: typeof Underscore;
    $: typeof jQuery;

    moment: typeof moment;
    imageToBlurHash: typeof imageToBlurHash;
    loadImage: any;
    isBehindProxy: () => boolean;
    getAutoLaunch: () => boolean;
    setAutoLaunch: (value: boolean) => void;

    PQueue: typeof PQueue;
    PQueueType: PQueue;
    Mustache: {
      render: (template: string, data: any, partials?: any) => string;
      parse: (template: string) => void;
    };

    WhatIsThis: WhatIsThis;

    addSetupMenuItems: () => void;
    attachmentDownloadQueue: Array<MessageModel> | undefined;
    startupProcessingQueue: StartupQueue | undefined;
    baseAttachmentsPath: string;
    baseStickersPath: string;
    baseTempPath: string;
    drawAttention: () => void;
    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAccountManager: () => AccountManager;
    getBuiltInImages: () => Promise<Array<string>>;
    getConversations: () => ConversationModelCollectionType;
    getBuildCreation: () => number;
    getEnvironment: typeof getEnvironment;
    getExpiration: () => string;
    getGuid: () => string;
    getHostName: () => string;
    getInboxCollection: () => ConversationModelCollectionType;
    getInteractionMode: () => 'mouse' | 'keyboard';
    getLocale: () => ElectronLocaleType;
    getMediaCameraPermissions: () => Promise<boolean>;
    getMediaPermissions: () => Promise<boolean>;
    getNodeVersion: () => string;
    getServerPublicParams: () => string;
    getSfuUrl: () => string;
    getSocketStatus: () => SocketStatus;
    getSyncRequest: (timeoutMillis?: number) => SyncRequest;
    getTitle: () => string;
    waitForEmptyEventQueue: () => Promise<void>;
    getVersion: () => string;
    showCallingPermissionsPopup: (forCamera: boolean) => Promise<void>;
    i18n: LocalizerType;
    isActive: () => boolean;
    isAfterVersion: (version: string, anotherVersion: string) => boolean;
    isBeforeVersion: (version: string, anotherVersion: string) => boolean;
    isFullScreen: () => boolean;
    isValidGuid: typeof isValidGuid;
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
    synchronousCrypto: typeof synchronousCrypto;
    titleBarDoubleClick: () => void;
    unregisterForActive: (handler: () => void) => void;
    updateTrayIcon: (count: number) => void;
    sqlInitializer: {
      initialize: () => Promise<void>;
      goBackToMainProcess: () => Promise<void>;
    };

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
        eraseAllStorageServiceState: () => Promise<void>;
        initializeGroupCredentialFetcher: () => void;
        initializeNetworkObserver: (network: ReduxActions['network']) => void;
        initializeUpdateListener: (updates: ReduxActions['updates']) => void;
        onTimeout: (timestamp: number, cb: () => void, id?: string) => string;
        removeTimeout: (uuid: string) => void;
        retryPlaceholders?: Util.RetryPlaceholders;
        lightSessionResetQueue?: PQueue;
        runStorageServiceSyncJob: () => Promise<void>;
        storageServiceUploadJob: () => void;
      };
      Migrations: {
        readTempData: any;
        deleteAttachmentData: (path: string) => Promise<void>;
        doesAttachmentExist: () => unknown;
        writeNewAttachmentData: (data: ArrayBuffer) => Promise<string>;
        deleteExternalMessageFiles: (attributes: unknown) => Promise<void>;
        getAbsoluteAttachmentPath: (path: string) => string;
        loadAttachmentData: (attachment: WhatIsThis) => WhatIsThis;
        loadQuoteData: (quote: unknown) => WhatIsThis;
        loadPreviewData: (preview: unknown) => WhatIsThis;
        loadStickerData: (sticker: unknown) => WhatIsThis;
        readStickerData: (path: string) => Promise<ArrayBuffer>;
        deleteSticker: (path: string) => Promise<void>;
        getAbsoluteStickerPath: (path: string) => string;
        processNewEphemeralSticker: (
          stickerData: ArrayBuffer
        ) => {
          path: string;
          width: number;
          height: number;
        };
        processNewSticker: (
          stickerData: ArrayBuffer
        ) => {
          path: string;
          width: number;
          height: number;
        };
        copyIntoAttachmentsDirectory: (path: string) => Promise<string>;
        upgradeMessageSchema: (attributes: unknown) => WhatIsThis;
        processNewAttachment: (
          attachment: DownloadedAttachmentType
        ) => Promise<DownloadedAttachmentType>;

        copyIntoTempDirectory: any;
        deleteDraftFile: (path: string) => Promise<void>;
        deleteTempFile: (path: string) => Promise<void>;
        getAbsoluteDraftPath: any;
        getAbsoluteTempPath: any;
        openFileInFolder: any;
        readAttachmentData: any;
        readDraftData: any;
        saveAttachmentToDisk: any;
        writeNewDraftData: any;
        deleteAvatar: (path: string) => Promise<void>;
        getAbsoluteAvatarPath: (src: string) => string;
        writeNewAvatarData: (data: ArrayBuffer) => Promise<string>;
      };
      Types: {
        Attachment: typeof Attachment;
        MIME: typeof MIME;
        EmbeddedContact: typeof EmbeddedContact;
        Conversation: {
          computeHash: (data: string) => Promise<string>;
          deleteExternalFiles: (
            attributes: unknown,
            options: unknown
          ) => Promise<void>;
          maybeUpdateProfileAvatar: (
            attributes: unknown,
            decrypted: unknown,
            options: unknown
          ) => Promise<Record<string, unknown>>;
          maybeUpdateAvatar: (
            attributes: unknown,
            data: unknown,
            options: unknown
          ) => Promise<WhatIsThis>;
        };
        Errors: typeof Errors;
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
        VisualAttachment: any;
        UUID: typeof UUID;
        Address: typeof Address;
        QualifiedAddress: typeof QualifiedAddress;
      };
      Util: typeof Util;
      GroupChange: {
        renderChange: (change: unknown, things: unknown) => Array<string>;
      };
      Components: {
        AttachmentList: typeof AttachmentList;
        CaptionEditor: typeof CaptionEditor;
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
        WhatsNew: typeof WhatsNew;
      };
      OS: typeof OS;
      Workflow: {
        IdleDetector: WhatIsThis;
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
          createCompositionArea: typeof createCompositionArea;
          createConversationDetails: typeof createConversationDetails;
          createConversationHeader: typeof createConversationHeader;
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
          createTimeline: typeof createTimeline;
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
    SignalContext: SignalContext;

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
    SignalWindow: {
      Settings: {
        themeSetting: SettingType<IPCEventsValuesType['themeSetting']>;
      };
      config: string;
      context: SignalContext;
      getAppInstance: () => string | undefined;
      getEnvironment: () => string;
      getVersion: () => string;
      i18n: LocalizerType;
      log: LoggerType;
      renderWindow: () => void;
    };
  }

  // We want to extend `Error`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Error {
    originalError?: Event;
    reason?: any;
    stackForLog?: string;
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

export type DeliveryReceiptBatcherItemType = {
  messageId: string;
  source?: string;
  sourceUuid?: string;
  timestamp: number;
};

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
  DebugLogView: typeof DebugLogView;
  Message: typeof MessageModel;
  MessageCollection: typeof MessageModelCollectionType;

  GroupMemberConversation: WhatIsThis;
  RotateSignedPreKeyListener: WhatIsThis;
  WallClockListener: WhatIsThis;

  deliveryReceiptQueue: PQueue;
  deliveryReceiptBatcher: BatcherType<DeliveryReceiptBatcherItemType>;
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

  // Toast
  AlreadyGroupMemberToast: typeof AnyViewClass;
  AlreadyRequestedToJoinToast: typeof AnyViewClass;
  BlockedGroupToast: typeof AnyViewClass;
  BlockedToast: typeof AnyViewClass;
  CannotMixImageAndNonImageAttachmentsToast: typeof AnyViewClass;
  CaptchaSolvedToast: typeof AnyViewClass;
  CaptchaFailedToast: typeof AnyViewClass;
  CannotStartGroupCallToast: typeof AnyViewClass;
  ConversationArchivedToast: typeof AnyViewClass;
  ConversationUnarchivedToast: typeof AnyViewClass;
  ConversationMarkedUnreadToast: typeof AnyViewClass;
  DangerousFileTypeToast: typeof AnyViewClass;
  DecryptionErrorToast: typeof AnyViewClass;
  ExpiredToast: typeof AnyViewClass;
  FileSavedToast: typeof AnyViewClass;
  FileSizeToast: typeof AnyViewClass;
  FoundButNotLoadedToast: typeof AnyViewClass;
  GroupLinkCopiedToast: typeof AnyViewClass;
  InvalidConversationToast: typeof AnyViewClass;
  LeftGroupToast: typeof AnyViewClass;
  MaxAttachmentsToast: typeof AnyViewClass;
  MessageBodyTooLongToast: typeof AnyViewClass;
  OneNonImageAtATimeToast: typeof AnyViewClass;
  OriginalNoLongerAvailableToast: typeof AnyViewClass;
  OriginalNotFoundToast: typeof AnyViewClass;
  PinnedConversationsFullToast: typeof AnyViewClass;
  ReactionFailedToast: typeof AnyViewClass;
  DeleteForEveryoneFailedToast: typeof AnyViewClass;
  TapToViewExpiredIncomingToast: typeof AnyViewClass;
  TapToViewExpiredOutgoingToast: typeof AnyViewClass;
  TimerConflictToast: typeof AnyViewClass;
  UnableToLoadToast: typeof AnyViewClass;
  VoiceNoteLimit: typeof AnyViewClass;
  VoiceNoteMustBeOnlyAttachmentToast: typeof AnyViewClass;

  ClearDataView: typeof AnyViewClass;
  ConversationLoadingScreen: typeof AnyViewClass;
  GroupMemberList: typeof AnyViewClass;
  InboxView: typeof AnyViewClass;
  InstallView: typeof AnyViewClass;
  KeyVerificationPanelView: typeof AnyViewClass;
  ReactWrapperView: typeof BasicReactWrapperViewClass;
  RecorderView: typeof AnyViewClass;
  SafetyNumberChangeDialogView: typeof AnyViewClass;
  StandaloneRegistrationView: typeof AnyViewClass;
  ToastView: typeof AnyViewClass;
  View: typeof AnyViewClass;
};
