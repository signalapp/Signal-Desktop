import {} from 'styled-components/cssprop';

import { LocalizerType } from '../ts/types/Util';

import { Store } from 'redux';

import { ConversationCollection, ConversationModel } from './models/conversation';
import { ConversationType } from './state/ducks/conversations';

export interface LibTextsecure {
  messaging: boolean;
}

/*
We declare window stuff here instead of global.d.ts because we are importing other declarations.
If you import anything in global.d.ts, the type system won't work correctly.
*/

declare global {
  interface Window {
    CONSTANTS: any;
    Events: any;
    Lodash: any;
    SessionSnodeAPI: any;
    Session: any;
    StubAppDotNetApi: any;
    StringView: any;
    StubMessageAPI: any;
    Whisper: any;
    clearLocalData: any;
    clipboard: any;
    dcodeIO: any;
    getSettingValue: (id: string, comparisonValue?: any) => any;
    setSettingValue: (id: string, value: any) => void;

    i18n: LocalizerType;
    log: any;
    sessionFeatureFlags: {
      useOnionRequests: boolean;
      useTestNet: boolean;
    };
    SessionSnodeAPI: SessionSnodeAPI;
    onLogin: any;
    persistStore?: Persistor;
    restart: any;
    getSeedNodeList: () => Array<string> | undefined;
    setPassword: any;
    storage: any;
    isOnline: boolean;
    toggleMediaPermissions: () => Promise<void>;
    toggleCallMediaPermissionsTo: (enabled: boolean) => Promise<void>;
    getCallMediaPermissions: () => boolean;
    toggleMenuBar: () => void;
    toggleSpellCheck: any;
    setTheme: (newTheme: string) => any;
    isDev?: () => boolean;
    userConfig: any;
    versionInfo: any;
    getConversations: () => ConversationCollection;
    readyForUpdates: () => void;
    drawAttention: () => void;
    MediaRecorder: any;

    platform: string;
    openFromNotification: (convoId: string) => void;
    getEnvironment: () => string;
    getNodeVersion: () => string;

    showWindow: () => void;
    setCallMediaPermissions: (val: boolean) => void;
    setMediaPermissions: (val: boolean) => void;
    askForMediaAccess: () => void;
    getMediaPermissions: () => boolean;
    nodeSetImmediate: any;
    globalOnlineStatus: boolean;

    getTitle: () => string;
    getAppInstance: () => string;
    getCommitHash: () => string | undefined;
    getVersion: () => string;
    setAutoHideMenuBar: (val: boolean) => void;
    setMenuBarVisibility: (val: boolean) => void;
    contextMenuShown: boolean;
    inboxStore?: Store;
    openConversationWithMessages: (args: {
      conversationKey: string;
      messageId: string | null;
    }) => Promise<void>;
    LokiPushNotificationServer: any;
    getGlobalOnlineStatus: () => boolean;
    confirmationDialog: any;
    setStartInTray: (val: boolean) => Promise<void>;
    getStartInTray: () => Promise<boolean>;
    getOpengroupPruning: () => Promise<boolean>;
    setOpengroupPruning: (val: boolean) => Promise<void>;
    closeAbout: () => void;
    getAutoUpdateEnabled: () => boolean;
    setAutoUpdateEnabled: (enabled: boolean) => void;
    setZoomFactor: (newZoom: number) => void;
    updateZoomFactor: () => void;

    Signal: any;
  }
}
