// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Captures the globals put in place by preload.js, background.js and others

import * as Backbone from 'backbone';
import * as Underscore from 'underscore';
import moment from 'moment';
import PQueue from 'p-queue/dist';
import { Ref } from 'react';
import { bindActionCreators } from 'redux';
import { imageToBlurHash } from './util/imageToBlurHash';
import * as LinkPreviews from '../js/modules/link_previews.d';
import * as Util from './util';
import {
  ConversationModelCollectionType,
  MessageModelCollectionType,
  MessageAttributesType,
} from './model-types.d';
import {
  LibSignalType,
  SignalProtocolAddressClass,
  StorageType,
} from './libsignal.d';
import { ContactRecordIdentityState, TextSecureType } from './textsecure.d';
import { WebAPIConnectType } from './textsecure/WebAPI';
import { uploadDebugLogs } from './logging/debuglogs';
import { CallingClass } from './services/calling';
import * as Groups from './groups';
import * as Crypto from './Crypto';
import * as RemoteConfig from './RemoteConfig';
import * as OS from './OS';
import { getEnvironment } from './environment';
import * as zkgroup from './util/zkgroup';
import { LocalizerType, BodyRangesType, BodyRangeType } from './types/Util';
import * as Attachment from './types/Attachment';
import { ColorType } from './types/Colors';
import * as MIME from './types/MIME';
import * as Contact from './types/Contact';
import * as Errors from '../js/modules/types/errors';
import { ConversationController } from './ConversationController';
import { ReduxActions } from './state/types';
import { createStore } from './state/createStore';
import { createCallManager } from './state/roots/createCallManager';
import { createCompositionArea } from './state/roots/createCompositionArea';
import { createContactModal } from './state/roots/createContactModal';
import { createConversationDetails } from './state/roots/createConversationDetails';
import { createConversationHeader } from './state/roots/createConversationHeader';
import { createGroupLinkManagement } from './state/roots/createGroupLinkManagement';
import { createGroupV1MigrationModal } from './state/roots/createGroupV1MigrationModal';
import { createGroupV2JoinModal } from './state/roots/createGroupV2JoinModal';
import { createGroupV2Permissions } from './state/roots/createGroupV2Permissions';
import { createLeftPane } from './state/roots/createLeftPane';
import { createMessageDetail } from './state/roots/createMessageDetail';
import { createPendingInvites } from './state/roots/createPendingInvites';
import { createSafetyNumberViewer } from './state/roots/createSafetyNumberViewer';
import { createShortcutGuideModal } from './state/roots/createShortcutGuideModal';
import { createStickerManager } from './state/roots/createStickerManager';
import { createStickerPreviewModal } from './state/roots/createStickerPreviewModal';
import { createTimeline } from './state/roots/createTimeline';
import * as callingDuck from './state/ducks/calling';
import * as conversationsDuck from './state/ducks/conversations';
import * as emojisDuck from './state/ducks/emojis';
import * as expirationDuck from './state/ducks/expiration';
import * as itemsDuck from './state/ducks/items';
import * as networkDuck from './state/ducks/network';
import * as updatesDuck from './state/ducks/updates';
import * as userDuck from './state/ducks/user';
import * as searchDuck from './state/ducks/search';
import * as stickersDuck from './state/ducks/stickers';
import * as conversationsSelectors from './state/selectors/conversations';
import * as searchSelectors from './state/selectors/search';
import { SendOptionsType } from './textsecure/SendMessage';
import AccountManager from './textsecure/AccountManager';
import Data from './sql/Client';
import { UserMessage } from './types/Message';
import { PhoneNumberFormat } from 'google-libphonenumber';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { combineNames } from './util';
import { BatcherType } from './util/batcher';
import { AttachmentList } from './components/conversation/AttachmentList';
import { CaptionEditor } from './components/CaptionEditor';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ContactDetail } from './components/conversation/ContactDetail';
import { ContactModal } from './components/conversation/ContactModal';
import { ErrorModal } from './components/ErrorModal';
import { Lightbox } from './components/Lightbox';
import { LightboxGallery } from './components/LightboxGallery';
import { MediaGallery } from './components/conversation/media-gallery/MediaGallery';
import { MessageDetail } from './components/conversation/MessageDetail';
import { ProgressModal } from './components/ProgressModal';
import { Quote } from './components/conversation/Quote';
import { StagedLinkPreview } from './components/conversation/StagedLinkPreview';
import { MIMEType } from './types/MIME';
import { ElectronLocaleType } from './util/mapToSupportLocale';
import { SignalProtocolStore } from './LibSignalStore';
import { StartupQueue } from './util/StartupQueue';
import * as synchronousCrypto from './util/synchronousCrypto';

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

    _: typeof Underscore;
    $: typeof jQuery;

    moment: typeof moment;
    imageToBlurHash: typeof imageToBlurHash;
    autoOrientImage: any;
    dataURLToBlobSync: any;
    loadImage: any;
    isBehindProxy: () => boolean;

    PQueue: typeof PQueue;
    PQueueType: PQueue;
    Mustache: {
      render: (template: string, data: any, partials?: any) => string;
      parse: (template: string) => void;
    };

    WhatIsThis: WhatIsThis;

    attachmentDownloadQueue: Array<MessageModel> | undefined;
    startupProcessingQueue: StartupQueue | undefined;
    baseAttachmentsPath: string;
    baseStickersPath: string;
    baseTempPath: string;
    dcodeIO: DCodeIOType;
    receivedAtCounter: number;
    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAccountManager: () => AccountManager | undefined;
    getAlwaysRelayCalls: () => Promise<boolean>;
    getBuiltInImages: () => Promise<Array<WhatIsThis>>;
    getCallRingtoneNotification: () => Promise<boolean>;
    getCallSystemNotification: () => Promise<boolean>;
    getConversations: () => ConversationModelCollectionType;
    getCountMutedConversations: () => Promise<boolean>;
    getEnvironment: typeof getEnvironment;
    getExpiration: () => string;
    getGuid: () => string;
    getInboxCollection: () => ConversationModelCollectionType;
    getIncomingCallNotification: () => Promise<boolean>;
    getInteractionMode: () => 'mouse' | 'keyboard';
    getLocale: () => ElectronLocaleType;
    getMediaCameraPermissions: () => Promise<boolean>;
    getMediaPermissions: () => Promise<boolean>;
    getNodeVersion: () => string;
    getServerPublicParams: () => string;
    getSfuUrl: () => string;
    getSocketStatus: () => number;
    getSyncRequest: () => WhatIsThis;
    getTitle: () => string;
    waitForEmptyEventQueue: () => Promise<void>;
    getVersion: () => string;
    showCallingPermissionsPopup: (forCamera: boolean) => Promise<void>;
    i18n: LocalizerType;
    isActive: () => boolean;
    isAfterVersion: (version: WhatIsThis, anotherVersion: string) => boolean;
    isBeforeVersion: (version: WhatIsThis, anotherVersion: string) => boolean;
    isFullScreen: () => boolean;
    isValidGuid: (maybeGuid: string | null) => boolean;
    isValidE164: (maybeE164: unknown) => boolean;
    libphonenumber: {
      util: {
        getRegionCodeForNumber: (number: string) => string;
        parseNumber: (
          e164: string,
          regionCode: string
        ) => typeof window.Signal.Types.PhoneNumber;
      };
      parse: (number: string) => string;
      getRegionCodeForNumber: (number: string) => string;
      format: (number: string, format: PhoneNumberFormat) => string;
    };
    libsignal: LibSignalType;
    log: {
      fatal: LoggerType;
      info: LoggerType;
      warn: LoggerType;
      error: LoggerType;
      debug: LoggerType;
      trace: LoggerType;
      fetch: () => Promise<string>;
      publish: typeof uploadDebugLogs;
    };
    nodeSetImmediate: typeof setImmediate;
    normalizeUuids: (obj: any, paths: Array<string>, context: string) => void;
    onFullScreenChange: (fullScreen: boolean) => void;
    owsDesktopApp: WhatIsThis;
    platform: string;
    preloadedImages: Array<WhatIsThis>;
    reduxActions: ReduxActions;
    reduxStore: WhatIsThis;
    registerForActive: (handler: () => void) => void;
    restart: () => void;
    setImmediate: typeof setImmediate;
    showWindow: () => void;
    showSettings: () => void;
    shutdown: () => void;
    setAutoHideMenuBar: (value: WhatIsThis) => void;
    setBadgeCount: (count: number) => void;
    setMenuBarVisibility: (value: WhatIsThis) => void;
    showConfirmationDialog: (options: ConfirmationDialogViewProps) => void;
    showKeyboardShortcuts: () => void;
    storage: {
      addBlockedGroup: (group: string) => void;
      addBlockedNumber: (number: string) => void;
      addBlockedUuid: (uuid: string) => void;
      fetch: () => void;
      get: {
        <T = any>(key: string): T | undefined;
        <T>(key: string, defaultValue: T): T;
      };
      getBlockedGroups: () => Array<string>;
      getBlockedNumbers: () => Array<string>;
      getBlockedUuids: () => Array<string>;
      getItemsState: () => WhatIsThis;
      isBlocked: (number: string) => boolean;
      isGroupBlocked: (group: unknown) => boolean;
      isUuidBlocked: (uuid: string) => boolean;
      onready: (callback: () => unknown) => void;
      put: (key: string, value: any) => Promise<void>;
      remove: (key: string) => Promise<void>;
      removeBlockedGroup: (group: string) => void;
      removeBlockedNumber: (number: string) => void;
      removeBlockedUuid: (uuid: string) => void;
      reset: () => void;
    };
    systemTheme: WhatIsThis;
    textsecure: TextSecureType;
    synchronousCrypto: typeof synchronousCrypto;
    titleBarDoubleClick: () => void;
    unregisterForActive: (handler: () => void) => void;
    updateTrayIcon: (count: number) => void;
    sqlInitializer: {
      initialize: () => Promise<void>;
      goBackToMainProcess: () => void;
    };

    Backbone: typeof Backbone;
    CI:
      | {
          setProvisioningURL: (url: string) => void;
          deviceName: string;
        }
      | undefined;
    Signal: {
      Backbone: any;
      AttachmentDownloads: {
        addJob: <T = unknown>(
          attachment: unknown,
          options: unknown
        ) => Promise<T>;
        start: (options: WhatIsThis) => void;
        stop: () => void;
      };
      Crypto: typeof Crypto;
      Data: typeof Data;
      Groups: typeof Groups;
      Metadata: {
        SecretSessionCipher: typeof SecretSessionCipherClass;
        createCertificateValidator: (
          trustRoot: ArrayBuffer
        ) => CertificateValidatorType;
      };
      RemoteConfig: typeof RemoteConfig;
      Services: {
        calling: CallingClass;
        enableStorageService: () => boolean;
        eraseAllStorageServiceState: () => Promise<void>;
        initializeGroupCredentialFetcher: () => void;
        initializeNetworkObserver: (network: WhatIsThis) => void;
        initializeUpdateListener: (
          updates: WhatIsThis,
          events: WhatIsThis
        ) => void;
        onTimeout: (timestamp: number, cb: () => void, id?: string) => string;
        removeTimeout: (uuid: string) => void;
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
        upgradeMessageSchema: (attributes: unknown) => WhatIsThis;

        copyIntoTempDirectory: any;
        deleteDraftFile: any;
        deleteTempFile: any;
        getAbsoluteDraftPath: any;
        getAbsoluteTempPath: any;
        openFileInFolder: any;
        readAttachmentData: any;
        readDraftData: any;
        saveAttachmentToDisk: any;
        writeNewDraftData: any;
      };
      Stickers: {
        getDataFromLink: any;
        copyStickerToAttachments: (
          packId: string,
          stickerId: number
        ) => Promise<typeof window.Signal.Types.Sticker>;
        deletePackReference: (id: string, packId: string) => Promise<void>;
        downloadEphemeralPack: (
          packId: string,
          key: WhatIsThis
        ) => Promise<void>;
        downloadQueuedPacks: () => void;
        downloadStickerPack: (
          id: string,
          key: string,
          options: WhatIsThis
        ) => void;
        getInitialState: () => WhatIsThis;
        load: () => void;
        removeEphemeralPack: (packId: string) => Promise<void>;
        savePackMetadata: (
          packId: string,
          packKey: string,
          metadata: unknown
        ) => void;
        getStickerPackStatus: (packId: string) => 'downloaded' | 'installed';
        getSticker: (
          packId: string,
          stickerId: number
        ) => typeof window.Signal.Types.Sticker;
        getStickerPack: (packId: string) => WhatIsThis;
        getInstalledStickerPacks: () => WhatIsThis;
      };
      Types: {
        Attachment: {
          save: any;
          path: string;
          pending: boolean;
          flags: number;
          size: number;
          screenshot: {
            path: string;
          };
          thumbnail: {
            path: string;
            objectUrl: string;
          };
          contentType: MIMEType;
          error: unknown;
          caption: string;

          migrateDataToFileSystem: (
            attachment: WhatIsThis,
            options: unknown
          ) => WhatIsThis;

          isVoiceMessage: (attachments: unknown) => boolean;
          isImage: typeof Attachment.isImage;
          isVideo: typeof Attachment.isVideo;
          isAudio: typeof Attachment.isAudio;

          getUploadSizeLimitKb: typeof Attachment.getUploadSizeLimitKb;
        };
        MIME: typeof MIME;
        Contact: typeof Contact;
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
        PhoneNumber: {
          format: (
            identifier: string,
            options: Record<string, unknown>
          ) => string;
          isValidNumber(
            phoneNumber: string,
            options?: {
              regionCode?: string;
            }
          ): boolean;
          e164: string;
          error: string;
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
      };
      Util: typeof Util;
      LinkPreviews: typeof LinkPreviews;
      GroupChange: {
        renderChange: (change: unknown, things: unknown) => Array<string>;
      };
      Components: {
        AttachmentList: typeof AttachmentList;
        CaptionEditor: typeof CaptionEditor;
        ConfirmationModal: typeof ConfirmationModal;
        ContactDetail: typeof ContactDetail;
        ContactModal: typeof ContactModal;
        ErrorModal: typeof ErrorModal;
        Lightbox: typeof Lightbox;
        LightboxGallery: typeof LightboxGallery;
        MediaGallery: typeof MediaGallery;
        MessageDetail: typeof MessageDetail;
        ProgressModal: typeof ProgressModal;
        Quote: typeof Quote;
        StagedLinkPreview: typeof StagedLinkPreview;
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
        bindActionCreators: typeof bindActionCreators;
        createStore: typeof createStore;
        Roots: {
          createCallManager: typeof createCallManager;
          createCompositionArea: typeof createCompositionArea;
          createContactModal: typeof createContactModal;
          createConversationDetails: typeof createConversationDetails;
          createConversationHeader: typeof createConversationHeader;
          createGroupLinkManagement: typeof createGroupLinkManagement;
          createGroupV1MigrationModal: typeof createGroupV1MigrationModal;
          createGroupV2JoinModal: typeof createGroupV2JoinModal;
          createGroupV2Permissions: typeof createGroupV2Permissions;
          createLeftPane: typeof createLeftPane;
          createMessageDetail: typeof createMessageDetail;
          createPendingInvites: typeof createPendingInvites;
          createSafetyNumberViewer: typeof createSafetyNumberViewer;
          createShortcutGuideModal: typeof createShortcutGuideModal;
          createStickerManager: typeof createStickerManager;
          createStickerPreviewModal: typeof createStickerPreviewModal;
          createTimeline: typeof createTimeline;
        };
        Ducks: {
          calling: typeof callingDuck;
          conversations: typeof conversationsDuck;
          emojis: typeof emojisDuck;
          expiration: typeof expirationDuck;
          items: typeof itemsDuck;
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
      Logs: WhatIsThis;
      conversationControllerStart: WhatIsThis;
      Emojis: {
        getInitialState: () => WhatIsThis;
        load: () => void;
      };
    };

    ConversationController: ConversationController;
    Events: WhatIsThis;
    MessageController: MessageControllerType;
    SignalProtocolStore: typeof SignalProtocolStore;
    WebAPI: WebAPIConnectType;
    Whisper: WhisperType;

    AccountCache: Record<string, boolean>;
    AccountJobs: Record<string, Promise<void>>;

    doesAccountCheckJobExist: (number: string) => boolean;
    checkForSignalAccount: (number: string) => Promise<void>;
    isSignalAccountCheckComplete: (number: string) => boolean;
    hasSignalAccount: (number: string) => boolean;
    getServerTrustRoot: () => WhatIsThis;
    readyForUpdates: () => void;
    logAppLoadedEvent: () => void;

    // Runtime Flags
    isShowingModal?: boolean;

    // Feature Flags
    isGroupCallingEnabled: () => boolean;
    GV2_ENABLE_SINGLE_CHANGE_PROCESSING: boolean;
    GV2_ENABLE_CHANGE_PROCESSING: boolean;
    GV2_ENABLE_STATE_PROCESSING: boolean;
    GV2_MIGRATION_DISABLE_ADD: boolean;
    GV2_MIGRATION_DISABLE_INVITE: boolean;
  }

  // We want to extend `Error`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Error {
    cause?: Event;
  }
}

export type DCodeIOType = {
  ByteBuffer: typeof ByteBufferClass & {
    BIG_ENDIAN: number;
    LITTLE_ENDIAN: number;
    Long: DCodeIOType['Long'];
  };
  Long: Long & {
    equals: (other: Long | number | string) => boolean;
    fromBits: (low: number, high: number, unsigned: boolean) => number;
    fromNumber: (value: number, unsigned?: boolean) => Long;
    fromString: (str: string | null) => Long;
    isLong: (obj: unknown) => obj is Long;
  };
};

type MessageControllerType = {
  findBySender: (sender: string) => MessageModel | null;
  findBySentAt: (sentAt: number) => MessageModel | null;
  register: (id: string, model: MessageModel) => MessageModel;
  unregister: (id: string) => void;
};

export class CertificateValidatorType {
  validate: (cerficate: any, certificateTime: number) => Promise<void>;
}

export class SecretSessionCipherClass {
  constructor(
    storage: StorageType,
    options?: { messageKeysLimit?: number | boolean }
  );
  decrypt: (
    validator: CertificateValidatorType,
    ciphertext: ArrayBuffer,
    serverTimestamp: number,
    me: any
  ) => Promise<{
    isMe: boolean;
    sender: SignalProtocolAddressClass;
    senderUuid: SignalProtocolAddressClass;
    content: ArrayBuffer;
  }>;
  getRemoteRegistrationId: (
    address: SignalProtocolAddressClass
  ) => Promise<number>;
  closeOpenSessionForDevice: (
    address: SignalProtocolAddressClass
  ) => Promise<void>;
  encrypt: (
    address: SignalProtocolAddressClass,
    senderCertificate: any,
    plaintext: ArrayBuffer | Uint8Array
  ) => Promise<ArrayBuffer>;
}

export class ByteBufferClass {
  constructor(value?: any, littleEndian?: number);
  static wrap: (
    value: any,
    encoding?: string,
    littleEndian?: number
  ) => ByteBufferClass;
  buffer: ArrayBuffer;
  toString: (type: string) => string;
  toArrayBuffer: () => ArrayBuffer;
  toBinary: () => string;
  slice: (start: number, end?: number) => ByteBufferClass;
  append: (data: ArrayBuffer) => void;
  limit: number;
  offset: 0;
  readInt: (offset: number) => number;
  readLong: (offset: number) => Long;
  readShort: (offset: number) => number;
  readVarint32: () => number;
  writeLong: (l: Long) => void;
  skip: (length: number) => void;
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

export type LoggerType = (...args: Array<unknown>) => void;

export type WhisperType = {
  events: {
    on: (name: string, callback: (param1: any, param2?: any) => void) => void;
    trigger: (name: string, param1?: any, param2?: any) => void;
  };
  Database: {
    open: () => Promise<IDBDatabase>;
    handleDOMException: (
      context: string,
      error: DOMException | null,
      reject: Function
    ) => void;
  };
  GroupConversationCollection: typeof ConversationModelCollectionType;
  ConversationCollection: typeof ConversationModelCollectionType;
  ConversationCollectionType: ConversationModelCollectionType;
  Conversation: typeof ConversationModel;
  ConversationType: ConversationModel;
  MessageCollection: typeof MessageModelCollectionType;
  MessageCollectionType: MessageModelCollectionType;
  MessageAttributesType: MessageAttributesType;
  Message: typeof MessageModel;
  MessageType: MessageModel;
  GroupMemberConversation: WhatIsThis;
  KeyChangeListener: WhatIsThis;
  ClearDataView: WhatIsThis;
  ReactWrapperView: WhatIsThis;
  activeConfirmationView: WhatIsThis;
  ToastView: typeof window.Whisper.View & {
    show: (view: typeof Backbone.View, el: Element) => void;
  };
  ConversationArchivedToast: WhatIsThis;
  ConversationUnarchivedToast: WhatIsThis;
  ConversationMarkedUnreadToast: WhatIsThis;
  AppView: WhatIsThis;
  WallClockListener: WhatIsThis;
  MessageRequests: WhatIsThis;
  BannerView: any;
  RecorderView: any;
  GroupMemberList: any;
  GroupLinkCopiedToast: typeof Backbone.View;
  KeyVerificationPanelView: any;
  SafetyNumberChangeDialogView: any;
  BodyRangesType: BodyRangesType;
  BodyRangeType: BodyRangeType;

  Notifications: {
    removeBy: (filter: Partial<unknown>) => void;
    add: (notification: unknown) => void;
    clear: () => void;
    disable: () => void;
    enable: () => void;
    fastClear: () => void;
    on: (
      event: string,
      callback: (id: string, messageId: string) => void
    ) => void;
  };

  DeliveryReceipts: {
    add: (receipt: WhatIsThis) => void;
    forMessage: (conversation: unknown, message: unknown) => Array<WhatIsThis>;
    onReceipt: (receipt: WhatIsThis) => void;
  };

  ReadReceipts: {
    add: (receipt: WhatIsThis) => WhatIsThis;
    forMessage: (conversation: unknown, message: unknown) => Array<WhatIsThis>;
    onReceipt: (receipt: WhatIsThis) => void;
  };

  ReadSyncs: {
    add: (sync: WhatIsThis) => WhatIsThis;
    forMessage: (message: unknown) => WhatIsThis;
    onReceipt: (receipt: WhatIsThis) => WhatIsThis;
  };

  ViewSyncs: {
    add: (sync: WhatIsThis) => WhatIsThis;
    forMessage: (message: unknown) => Array<WhatIsThis>;
    onSync: (sync: WhatIsThis) => WhatIsThis;
  };

  Reactions: {
    forMessage: (message: unknown) => Array<WhatIsThis>;
    add: (reaction: unknown) => WhatIsThis;
    onReaction: (reactionModel: unknown) => unknown;
  };

  Deletes: {
    add: (model: WhatIsThis) => WhatIsThis;
    forMessage: (message: unknown) => Array<WhatIsThis>;
    onDelete: (model: WhatIsThis) => void;
  };

  IdenticonSVGView: WhatIsThis;

  ExpiringMessagesListener: WhatIsThis;
  TapToViewMessagesListener: WhatIsThis;

  deliveryReceiptQueue: PQueue<WhatIsThis>;
  deliveryReceiptBatcher: BatcherType<WhatIsThis>;
  RotateSignedPreKeyListener: WhatIsThis;

  AlreadyGroupMemberToast: typeof window.Whisper.ToastView;
  AlreadyRequestedToJoinToast: typeof window.Whisper.ToastView;
  BlockedGroupToast: typeof window.Whisper.ToastView;
  BlockedToast: typeof window.Whisper.ToastView;
  CannotMixImageAndNonImageAttachmentsToast: typeof window.Whisper.ToastView;
  DangerousFileTypeToast: typeof window.Whisper.ToastView;
  ExpiredToast: typeof window.Whisper.ToastView;
  FileSavedToast: typeof window.Whisper.ToastView;
  FileSizeToast: any;
  FoundButNotLoadedToast: typeof window.Whisper.ToastView;
  InvalidConversationToast: typeof window.Whisper.ToastView;
  LeftGroupToast: typeof window.Whisper.ToastView;
  MaxAttachmentsToast: typeof window.Whisper.ToastView;
  MessageBodyTooLongToast: typeof window.Whisper.ToastView;
  OneNonImageAtATimeToast: typeof window.Whisper.ToastView;
  OriginalNoLongerAvailableToast: typeof window.Whisper.ToastView;
  OriginalNotFoundToast: typeof window.Whisper.ToastView;
  PinnedConversationsFullToast: typeof window.Whisper.ToastView;
  ReactionFailedToast: typeof window.Whisper.ToastView;
  TapToViewExpiredIncomingToast: typeof window.Whisper.ToastView;
  TapToViewExpiredOutgoingToast: typeof window.Whisper.ToastView;
  TimerConflictToast: typeof window.Whisper.ToastView;
  UnableToLoadToast: typeof window.Whisper.ToastView;
  VoiceNoteLimit: typeof window.Whisper.ToastView;
  VoiceNoteMustBeOnlyAttachmentToast: typeof window.Whisper.ToastView;

  ConversationLoadingScreen: typeof window.Whisper.View;
  ConversationView: typeof window.Whisper.View;
  View: typeof Backbone.View & {
    Templates: Record<string, string>;
  };
};
