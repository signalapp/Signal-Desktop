import {} from 'styled-components/cssprop';

import { LocalizerType } from '../types/Util';
import { LibsignalProtocol } from '../../libtextsecure/libsignal-protocol';
import { SignalInterface } from '../../js/modules/signal';
import { Libloki } from '../libloki';

import { LibTextsecure } from '../libtextsecure';
import { ConfirmationDialogParams } from '../background';

import { ConversationControllerType } from '../js/ConversationController';
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
      useFileOnionRequests: boolean;
      useFileOnionRequestsV2: boolean;
      useRequestEncryptionKeyPair: boolean;
      padOutgoingAttachments: boolean;
    };
    lokiSnodeAPI: LokiSnodeAPI;
    onLogin: any;
    resetDatabase: any;
    restart: any;
    getSeedNodeList: () => Array<any> | undefined;
    setPassword: any;
    setSettingValue: any;
    showEditProfileDialog: any;
    showNicknameDialog: (options: { convoId: string }) => void;
    showResetSessionIdDialog: any;
    storage: any;
    textsecure: LibTextsecure;
    toggleLinkPreview: any;
    toggleMediaPermissions: any;
    toggleMenuBar: any;
    toggleSpellCheck: any;
    setTheme: (newTheme: string) => any;
    userConfig: any;
    versionInfo: any;
    getStoragePubKey: (key: string) => string;
    getConversations: () => ConversationCollection;
    profileImages: any;
    MediaRecorder: any;
    dataURLToBlobSync: any;
    autoOrientImage: any;
    contextMenuShown: boolean;
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
    globalOnlineStatus: boolean;
  }
}
