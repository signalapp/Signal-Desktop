import {} from 'styled-components/cssprop';

import { LocalizerType } from '../types/Util';
import { LibsignalProtocol } from '../../libtextsecure/libsignal-protocol';
import { SignalInterface } from '../../js/modules/signal';

import { LibTextsecure } from '../libtextsecure';

import { Store } from 'redux';

import { ConversationCollection, ConversationModel } from './models/conversation';
import { ConversationType } from './state/ducks/conversations';

/*
We declare window stuff here instead of global.d.ts because we are importing other declarations.
If you import anything in global.d.ts, the type system won't work correctly.
*/

declare global {
  interface Window {
    CONSTANTS: any;
    Events: any;
    Lodash: any;
    LokiSnodeAPI: any;
    Session: any;
    Signal: SignalInterface;
    StubAppDotNetApi: any;
    StringView: any;
    StubMessageAPI: any;
    Whisper: any;
    clearLocalData: any;
    clipboard: any;
    dcodeIO: any;
    displayNameRegex: any;
    friends: any;
    getConversations: any;
    getFriendsFromContacts: any;
    getSettingValue: (id: string) => any;
    setSettingValue: (id: string, value: any) => void;

    i18n: LocalizerType;
    libsignal: LibsignalProtocol;
    log: any;
    lokiFeatureFlags: {
      useOnionRequests: boolean;
      useFileOnionRequests: boolean;
      useFileOnionRequestsV2: boolean;
      padOutgoingAttachments: boolean;
      enablePinConversations: boolean;
      useUnsendRequests: boolean;
      useCallMessage: boolean;
    };
    lokiSnodeAPI: LokiSnodeAPI;
    onLogin: any;
    persistStore?: Persistor;
    restart: any;
    getSeedNodeList: () => Array<any> | undefined;
    setPassword: any;
    storage: any;
    textsecure: LibTextsecure;
    toggleMediaPermissions: () => Promise<void>;
    toggleCallMediaPermissionsTo: (enabled: boolean) => Promise<void>;
    getCallMediaPermissions: () => boolean;
    updateZoomFactor: () => boolean;
    toggleMenuBar: () => void;
    toggleSpellCheck: any;
    setTheme: (newTheme: string) => any;
    isDev?: () => boolean;
    userConfig: any;
    versionInfo: any;
    getConversations: () => ConversationCollection;
    profileImages: any;
    MediaRecorder: any;
    dataURLToBlobSync: any;
    autoOrientImage: (fileOrBlobOrURL: string | File | Blob, options: any = {}) => Promise<string>;
    contextMenuShown: boolean;
    inboxStore?: Store;
    openConversationWithMessages: (args: {
      conversationKey: string;
      messageId?: string | undefined;
    }) => Promise<void>;
    LokiPushNotificationServer: any;
    getGlobalOnlineStatus: () => boolean;
    confirmationDialog: any;
    callWorker: (fnName: string, ...args: any) => Promise<any>;
    setStartInTray: (val: boolean) => Promise<void>;
    getStartInTray: () => Promise<boolean>;
    libsession: any;
  }
}
