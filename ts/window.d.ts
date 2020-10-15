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
/*
We declare window stuff here instead of global.d.ts because we are importing other declarations.
If you import anything in global.d.ts, the type system won't work correctly.
*/

declare global {
  interface Window {
    CONSTANTS: any;
    ConversationController: ConversationControllerType;
    Events: any;
    Lodash: any;
    LokiAppDotNetServerAPI: any;
    LokiFileServerAPI: any;
    LokiPublicChatAPI: any;
    LokiSnodeAPI: any;
    MessageController: any;
    Session: any;
    Signal: SignalInterface;
    StringView: any;
    StubAppDotNetApi: any;
    StubMessageAPI: any;
    WebAPI: any;
    Whisper: any;
    attemptConnection: ConversationType;
    clearLocalData: any;
    clipboard: any;
    confirmationDialog: (params: ConfirmationDialogParams) => any;
    dcodeIO: any;
    deleteAccount: any;
    displayNameRegex: any;
    friends: any;
    generateID: any;
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
      useSnodeProxy: boolean;
      useOnionRequests: boolean;
      useFileOnionRequests: boolean;
      enableSenderKeys: boolean;
      onionRequestHops: number;
      debugMessageLogs: boolean;
      useMultiDevice: boolean;
    };
    lokiFileServerAPI: LokiFileServerInstance;
    lokiMessageAPI: LokiMessageInterface;
    lokiPublicChatAPI: LokiPublicChatFactoryInterface;
    lokiSnodeAPI: LokiSnodeAPI;
    lokiPublicChatAPI: LokiPublicChatFactoryAPI;
    mnemonic: RecoveryPhraseUtil;
    onLogin: any;
    passwordUtil: any;
    pushToast: any;
    resetDatabase: any;
    restart: any;
    seedNodeList: any;
    setPassword: any;
    setSettingValue: any;
    shortenPubkey: any;
    showEditProfileDialog: any;
    getOurDisplayName: () => string | undefined;
    showPasswordDialog: any;
    showSeedDialog: any;
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
    getGuid: any;
    ContactBuffer: any;
    GroupBuffer: any;
    SwarmPolling: SwarmPolling;
    MediaRecorder: any;
    owsDesktopApp: any;
  }
}
