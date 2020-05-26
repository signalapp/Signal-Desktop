declare global {
  interface Window {
    seedNodeList: any;

    WebAPI: any;
    LokiSnodeAPI: any;
    SenderKeyAPI: any;
    LokiMessageAPI: any;
    StubMessageAPI: any;
    StubAppDotNetApi: any;
    LokiPublicChatAPI: any;
    LokiAppDotNetServerAPI: any;
    LokiFileServerAPI: any;
    LokiRssAPI: any;
  }
}

// window.WebAPI = initializeWebAPI();
// const LokiSnodeAPI = require('./js/modules/loki_snode_api');
// window.SenderKeyAPI = require('./js/modules/loki_sender_key_api');
// window.lokiSnodeAPI
// window.LokiMessageAPI = require('./js/modules/loki_message_api');
// window.StubMessageAPI = require('./integration_test/stubs/stub_message_api');
// window.StubAppDotNetApi = require('./integration_test/stubs/stub_app_dot_net_api');
// window.LokiPublicChatAPI = require('./js/modules/loki_public_chat_api');
// window.LokiAppDotNetServerAPI = require('./js/modules/loki_app_dot_net_api');
// window.LokiFileServerAPI = require('./js/modules/loki_file_server_api');
// window.LokiRssAPI = require('./js/modules/loki_rss_api');

export const exporttts = {
  // APIs
  WebAPI: window.WebAPI,

  // Utilities
  Events: () => window.Events,
  Signal: () => window.Signal,
  Whisper: () => window.Whisper,
  ConversationController: () => window.ConversationController,
  passwordUtil: () => window.passwordUtil,

  // Values
  CONSTANTS: () => window.CONSTANTS,
  versionInfo: () => window.versionInfo,
  mnemonic: () => window.mnemonic,
  lokiFeatureFlags: () => window.lokiFeatureFlags,

  // Getters
  getAccountManager: () => window.getAccountManager,
  getConversations: () => window.getConversations,
  getFriendsFromContacts: () => window.getFriendsFromContacts,
  getSettingValue: () => window.getSettingValue,

  // Setters
  setPassword: () => window.setPassword,
  setSettingValue: () => window.setSettingValue,

  // UI Events
  pushToast: () => window.pushToast,
  confirmationDialog: () => window.confirmationDialog,

  showQRDialog: () => window.showQRDialog,
  showSeedDialog: () => window.showSeedDialog,
  showPasswordDialog: () => window.showPasswordDialog,
  showEditProfileDialog: () => window.showEditProfileDialog,

  toggleTheme: () => window.toggleTheme,
  toggleMenuBar: () => window.toggleMenuBar,
  toggleSpellCheck: () => window.toggleSpellCheck,
  toggleLinkPreview: () => window.toggleLinkPreview,
  toggleMediaPermissions: () => window.toggleMediaPermissions,

  // Actions
  clearLocalData: () => window.clearLocalData,
  deleteAccount: () => window.deleteAccount,
  resetDatabase: () => window.resetDatabase,
  attemptConnection: () => window.attemptConnection,
};
