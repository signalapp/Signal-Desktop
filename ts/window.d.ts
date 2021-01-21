import { LocalizerType } from '../types/Util';
import { LokiMessageAPIInterface } from '../../js/modules/loki_message_api';
import { LibsignalProtocol } from '../../libtextsecure/libsignal-protocol';
import { SignalInterface } from '../../js/modules/signal';
import { Libloki } from '../libloki';
import { LokiPublicChatFactoryInterface } from '../js/modules/loki_public_chat_api';
import { LokiAppDotNetServerInterface } from '../js/modules/loki_app_dot_net_api';
import { LokiMessageInterface } from '../js/modules/loki_message_api';
import { SwarmPolling } from './session/snode_api/swarmPolling';

import { LibTextsecure } from '../libtextsecure';
import { ConversationType } from '../js/modules/data';
import { RecoveryPhraseUtil } from '../libloki/modules/mnemonic';
import { ConfirmationDialogParams } from '../background';
import {} from 'styled-components/cssprop';

import { ConversationControllerType } from '../js/ConversationController';
import { any } from 'underscore';
import { Store } from 'redux';
import { MessageController } from './session/messages/MessageController';
import { DefaultTheme } from 'styled-components';

/*
We declare window stuff here instead of global.d.ts because we are importing other declarations.
If you import anything in global.d.ts, the type system won't work correctly.
*/

declare global {
  interface Window {
    CONSTANTS: any;
    Events: any;
    Lodash: any;
    LokiAppDotNetServerAPI: any;
    LokiFileServerAPI: any;
    LokiPublicChatAPI: any;
    LokiSnodeAPI: any;
    getMessageController: () => MessageController;
    Session: any;
    Signal: SignalInterface;
    StringView: any;
    StubAppDotNetApi: any;
    StubMessageAPI: any;
    Whisper: any;
    attemptConnection: ConversationType;
    clearLocalData: any;
    clipboard: any;
    confirmationDialog: (params: ConfirmationDialogParams) => any;
    dcodeIO: any;
    deleteAccount: any;
    displayNameRegex: any;
    friends: any;
    getAccountManager: any;
    getConversations: any;
    getFriendsFromContacts: any;
    getSettingValue: any;
    i18n: LocalizerType;
    libloki: Libloki;
    libsignal: LibsignalProtocol;
    log: any;
    lokiFeatureFlags: {
      multiDeviceUnpairing: boolean;
      privateGroupChats: boolean;
      useOnionRequests: boolean;
      useOnionRequestsV2: boolean;
      useFileOnionRequests: boolean;
      useFileOnionRequestsV2: boolean;
      onionRequestHops: number;
    };
    lokiFileServerAPI: LokiFileServerInstance;
    lokiMessageAPI: LokiMessageInterface;
    lokiPublicChatAPI: LokiPublicChatFactoryInterface;
    lokiSnodeAPI: LokiSnodeAPI;
    mnemonic: RecoveryPhraseUtil;
    onLogin: any;
    passwordUtil: any;
    resetDatabase: any;
    restart: any;
    seedNodeList: any;
    setPassword: any;
    setSettingValue: any;
    showEditProfileDialog: any;
    showResetSessionIdDialog: any;
    storage: any;
    textsecure: LibTextsecure;
    toggleLinkPreview: any;
    toggleMediaPermissions: any;
    toggleMenuBar: any;
    toggleSpellCheck: any;
    setTheme: (newTheme: string) => any;
    tokenlessFileServerAdnAPI: LokiAppDotNetServerInterface;
    userConfig: any;
    versionInfo: any;
    getStoragePubKey: any;
    getConversations: () => ConversationCollection;
    getGuid: any;
    ContactBuffer: any;
    GroupBuffer: any;
    SwarmPolling: SwarmPolling;
    SnodePool: {
      getSnodesFor: (string) => any;
    };
    profileImages: any;
    MediaRecorder: any;
    dataURLToBlobSync: any;
    autoOrientImage: any;
    contextMenuShown: boolean;
    sessionGenerateKeyPair: (
      seed: ArrayBuffer
    ) => Promise<{ pubKey: ArrayBufferLike; privKey: ArrayBufferLike }>;
    setClockParams: any;
    clientClockSynced: number | undefined;
    inboxStore: Store;
    actionsCreators: any;
    extension: {
      expired: (boolean) => void;
      expiredStatus: () => boolean;
    };
    openUrl: (string) => void;
    lightTheme: DefaultTheme;
    darkTheme: DefaultTheme;
  }
}
