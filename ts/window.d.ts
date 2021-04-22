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
import { ConfirmationDialogParams } from '../background';
import {} from 'styled-components/cssprop';

import { ConversationControllerType } from '../js/ConversationController';
import { any } from 'underscore';
import { Store } from 'redux';
import { MessageController } from './session/messages/MessageController';
import { DefaultTheme } from 'styled-components';

import { ConversationCollection } from './models/conversation';
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
    LokiAppDotNetServerAPI: any;
    LokiFileServerAPI: any;
    LokiPublicChatAPI: any;
    LokiSnodeAPI: any;
    Session: any;
    Signal: SignalInterface;
    StubAppDotNetApi: any;
    StringView: any;
    StubMessageAPI: any;
    Whisper: any;
    clearLocalData: any;
    clipboard: any;
    confirmationDialog: (params: ConfirmationDialogParams) => any;
    dcodeIO: any;
    displayNameRegex: any;
    friends: any;
    getConversations: any;
    getFriendsFromContacts: any;
    getSettingValue: any;
    i18n: LocalizerType;
    libloki: Libloki;
    libsignal: LibsignalProtocol;
    log: any;
    lokiFeatureFlags: {
      useOnionRequests: boolean;
      useOnionRequestsV2: boolean;
      useFileOnionRequests: boolean;
      useFileOnionRequestsV2: boolean;
      onionRequestHops: number;
      useRequestEncryptionKeyPair: boolean;
      padOutgoingAttachments: boolean;
    };
    lokiFileServerAPI: LokiFileServerInstance;
    lokiMessageAPI: LokiMessageInterface;
    lokiPublicChatAPI: LokiPublicChatFactoryInterface;
    lokiSnodeAPI: LokiSnodeAPI;
    onLogin: any;
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
    getStoragePubKey: (key: string) => string;
    getConversations: () => ConversationCollection;
    SwarmPolling: SwarmPolling;
    SnodePool: {
      getSnodesFor: (string) => any;
    };
    profileImages: any;
    MediaRecorder: any;
    dataURLToBlobSync: any;
    autoOrientImage: any;
    contextMenuShown: boolean;
    setClockParams: any;
    clientClockSynced: number | undefined;
    inboxStore?: Store;
    actionsCreators: any;
    extension: {
      expired: (boolean) => void;
      expiredStatus: () => boolean;
    };
    openUrl: (string) => void;
    lightTheme: DefaultTheme;
    darkTheme: DefaultTheme;
    LokiPushNotificationServer: any;
    LokiPushNotificationServerApi: any;
  }
}
