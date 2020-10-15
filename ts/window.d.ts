// Captures the globals put in place by preload.js, background.js and others

import * as Backbone from 'backbone';
import * as Underscore from 'underscore';
import { Ref } from 'react';
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
import { CallingClass } from './services/calling';
import * as Groups from './groups';
import * as Crypto from './Crypto';
import * as RemoteConfig from './RemoteConfig';
import * as zkgroup from './util/zkgroup';
import { LocalizerType, BodyRangesType } from './types/Util';
import { CallHistoryDetailsType } from './types/Calling';
import { ColorType } from './types/Colors';
import { ConversationController } from './ConversationController';
import { ReduxActions } from './state/types';
import { SendOptionsType } from './textsecure/SendMessage';
import AccountManager from './textsecure/AccountManager';
import Data from './sql/Client';
import { UserMessage } from './types/Message';
import PQueue from 'p-queue/dist';
import { PhoneNumberFormat } from 'google-libphonenumber';
import { MessageModel } from './models/messages';
import { ConversationModel } from './models/conversations';
import { combineNames } from './util';
import { BatcherType } from './util/batcher';
import { ErrorModal } from './components/ErrorModal';
import { ProgressModal } from './components/ProgressModal';

export { Long } from 'long';

type TaskResultType = any;

type WhatIsThis = any;

declare global {
  interface Window {
    _: typeof Underscore;
    $: typeof jQuery;

    moment: any;
    imageToBlurHash: any;
    autoOrientImage: any;
    dataURLToBlobSync: any;
    loadImage: any;
    isBehindProxy: any;

    PQueue: typeof PQueue;
    PQueueType: PQueue;

    WhatIsThis: WhatIsThis;

    baseAttachmentsPath: string;
    baseStickersPath: string;
    baseTempPath: string;
    dcodeIO: DCodeIOType;
    enterKeyboardMode: () => void;
    enterMouseMode: () => void;
    getAccountManager: () => AccountManager | undefined;
    getAlwaysRelayCalls: () => Promise<boolean>;
    getBuiltInImages: () => Promise<Array<WhatIsThis>>;
    getCallRingtoneNotification: () => Promise<boolean>;
    getCallSystemNotification: () => Promise<boolean>;
    getConversations: () => ConversationModelCollectionType;
    getCountMutedConversations: () => Promise<boolean>;
    getEnvironment: () => string;
    getExpiration: () => string;
    getGuid: () => string;
    getInboxCollection: () => ConversationModelCollectionType;
    getIncomingCallNotification: () => Promise<boolean>;
    getInteractionMode: () => string;
    getMediaCameraPermissions: () => Promise<boolean>;
    getMediaPermissions: () => Promise<boolean>;
    getServerPublicParams: () => string;
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
      info: LoggerType;
      warn: LoggerType;
      error: LoggerType;
    };
    nodeSetImmediate: typeof setImmediate;
    normalizeUuids: (obj: any, paths: Array<string>, context: string) => any;
    owsDesktopApp: WhatIsThis;
    platform: string;
    preloadedImages: Array<WhatIsThis>;
    reduxActions: ReduxActions;
    reduxStore: WhatIsThis;
    registerForActive: (handler: WhatIsThis) => void;
    resetActiveTimer: () => void;
    restart: () => void;
    setImmediate: typeof setImmediate;
    showWindow: () => void;
    showSettings: () => void;
    shutdown: () => void;
    setAutoHideMenuBar: (value: WhatIsThis) => void;
    setBadgeCount: (count: number) => void;
    setMenuBarVisibility: (value: WhatIsThis) => void;
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
      getItemsState: () => WhatIsThis;
      isBlocked: (number: string) => boolean;
      isGroupBlocked: (group: unknown) => boolean;
      isUuidBlocked: (uuid: string) => boolean;
      onready: WhatIsThis;
      put: (key: string, value: any) => Promise<void>;
      remove: (key: string) => Promise<void>;
      removeBlockedGroup: (group: string) => void;
      removeBlockedNumber: (number: string) => void;
      removeBlockedUuid: (uuid: string) => void;
    };
    systemTheme: WhatIsThis;
    textsecure: TextSecureType;
    unregisterForActive: (handler: WhatIsThis) => void;
    updateTrayIcon: (count: number) => void;

    Backbone: typeof Backbone;
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
          contentType: string;
          error: unknown;

          migrateDataToFileSystem: (
            attachment: WhatIsThis,
            options: unknown
          ) => WhatIsThis;

          isVoiceMessage: (attachments: unknown) => boolean;
          isImage: (attachments: unknown) => boolean;
          isVideo: (attachments: unknown) => boolean;
          isAudio: (attachments: unknown) => boolean;
        };
        MIME: {
          IMAGE_GIF: unknown;
          isImage: any;
          isJPEG: any;
        };
        Contact: {
          avatar?: { avatar?: unknown };
          number: Array<{ value: string }>;
          signalAccount: unknown;

          contactSelector: (
            contact: typeof window.Signal.Types.Contact,
            options: unknown
          ) => typeof window.Signal.Types.Contact;
          getName: (contact: typeof window.Signal.Types.Contact) => string;
        };
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
        Errors: {
          toLogFormat(error: Error): void;
        };
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
      Util: {
        isFileDangerous: any;
        GoogleChrome: {
          isImageTypeSupported: (contentType: string) => unknown;
          isVideoTypeSupported: (contentType: string) => unknown;
        };
        downloadAttachment: (attachment: WhatIsThis) => WhatIsThis;
        getStringForProfileChange: (
          change: unknown,
          changedContact: unknown,
          i18n: unknown
        ) => string;
        getTextWithMentions: (
          bodyRanges: BodyRangesType,
          text: string
        ) => string;
        deleteForEveryone: (
          message: unknown,
          del: unknown,
          bool: boolean
        ) => void;
        zkgroup: typeof zkgroup;
        combineNames: typeof combineNames;
        migrateColor: (color: string) => ColorType;
        createBatcher: (options: WhatIsThis) => WhatIsThis;
        Registration: {
          everDone: () => boolean;
          markDone: () => void;
          markEverDone: () => void;
          remove: () => void;
        };
        hasExpired: () => boolean;
        makeLookup: (conversations: WhatIsThis, key: string) => void;
        parseRemoteClientExpiration: (value: WhatIsThis) => WhatIsThis;
      };
      LinkPreviews: {
        isMediaLinkInWhitelist: any;
        getTitleMetaTag: any;
        getImageMetaTag: any;
        assembleChunks: any;
        getChunkPattern: any;
        isLinkInWhitelist: any;
        isStickerPack: (url: string) => boolean;
        isLinkSafeToPreview: (url: string) => boolean;
        findLinks: (body: string, unknown?: any) => Array<string>;
        getDomain: (url: string) => string;
      };
      GroupChange: {
        renderChange: (change: unknown, things: unknown) => Array<string>;
      };
      Components: {
        AttachmentList: any;
        CaptionEditor: any;
        ContactDetail: any;
        ConversationHeader: any;
        ErrorModal: typeof ErrorModal;
        Lightbox: any;
        LightboxGallery: any;
        MediaGallery: any;
        MessageDetail: any;
        ProgressModal: typeof ProgressModal;
        Quote: any;
        StagedLinkPreview: any;

        getCallingNotificationText: (
          callHistoryDetails: unknown,
          i18n: unknown
        ) => string;
      };
      OS: {
        isLinux: () => boolean;
      };
      Workflow: {
        IdleDetector: WhatIsThis;
        MessageDataMigrator: WhatIsThis;
      };
      IndexedDB: {
        removeDatabase: WhatIsThis;
        doesDatabaseExist: WhatIsThis;
      };
      Views: WhatIsThis;
      State: WhatIsThis;
      Logs: WhatIsThis;
      conversationControllerStart: WhatIsThis;
      Emojis: {
        getInitialState: () => WhatIsThis;
        load: () => void;
      };
      RefreshSenderCertificate: WhatIsThis;
    };

    ConversationController: ConversationController;
    Events: WhatIsThis;
    MessageController: MessageControllerType;
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
  }

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
    fromBits: (low: number, high: number, unsigned: boolean) => number;
    fromString: (str: string | null) => Long;
  };
};

type MessageControllerType = {
  register: (id: string, model: MessageModel) => MessageModel;
  unregister: (id: string) => void;
};

export class CertificateValidatorType {
  validate: (cerficate: any, certificateTime: number) => Promise<void>;
}

export class SecretSessionCipherClass {
  constructor(storage: StorageType);
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

export type LoggerType = (...args: Array<any>) => void;

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
  ConfirmationDialogView: WhatIsThis;
  ClearDataView: WhatIsThis;
  ReactWrapperView: WhatIsThis;
  activeConfirmationView: WhatIsThis;
  ToastView: typeof Whisper.View & {
    show: (view: Backbone.View, el: Element) => void;
  };
  ConversationArchivedToast: WhatIsThis;
  ConversationUnarchivedToast: WhatIsThis;
  AppView: WhatIsThis;
  WallClockListener: WhatIsThis;
  MessageRequests: WhatIsThis;
  BannerView: any;
  RecorderView: any;
  GroupMemberList: any;
  KeyVerificationPanelView: any;
  SafetyNumberChangeDialogView: any;

  ExpirationTimerOptions: {
    map: any;
    getName: (number: number) => string;
    getAbbreviated: (number: number) => string;
  };

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
    add: (reciept: WhatIsThis) => void;
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

  ExpiredToast: typeof Whisper.ToastView;
  BlockedToast: typeof Whisper.ToastView;
  BlockedGroupToast: typeof Whisper.ToastView;
  LeftGroupToast: typeof Whisper.ToastView;
  OriginalNotFoundToast: typeof Whisper.ToastView;
  OriginalNoLongerAvailableToast: typeof Whisper.ToastView;
  FoundButNotLoadedToast: typeof Whisper.ToastView;
  VoiceNoteLimit: typeof Whisper.ToastView;
  VoiceNoteMustBeOnlyAttachmentToast: typeof Whisper.ToastView;
  TapToViewExpiredIncomingToast: typeof Whisper.ToastView;
  TapToViewExpiredOutgoingToast: typeof Whisper.ToastView;
  FileSavedToast: typeof Whisper.ToastView;
  ReactionFailedToast: typeof Whisper.ToastView;
  MessageBodyTooLongToast: typeof Whisper.ToastView;
  FileSizeToast: any;
  UnableToLoadToast: typeof Whisper.ToastView;
  DangerousFileTypeToast: typeof Whisper.ToastView;
  OneNonImageAtATimeToast: typeof Whisper.ToastView;
  CannotMixImageAndNonImageAttachmentsToast: typeof Whisper.ToastView;
  MaxAttachmentsToast: typeof Whisper.ToastView;
  TimerConflictToast: typeof Whisper.ToastView;
  PinnedConversationsFullToast: typeof Whisper.ToastView;
  ConversationLoadingScreen: typeof Whisper.View;
  ConversationView: typeof Whisper.View;
  View: typeof Backbone.View;
};
