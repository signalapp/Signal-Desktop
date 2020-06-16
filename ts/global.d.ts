// TODO: Delete this and depend on window.ts instead
interface Window {
  CONSTANTS: any;
  versionInfo: any;

  Events: any;
  Lodash: any;
  clearLocalData: any;
  getAccountManager: any;
  getConversations: any;
  mnemonic: any;
  clipboard: any;
  attemptConnection: any;

  passwordUtil: any;
  userConfig: any;
  shortenPubkey: any;

  dcodeIO: any;
  libsignal: any;
  libloki: any;
  displayNameRegex: any;

  Signal: any;
  Whisper: any;
  ConversationController: any;
  MessageController: any;

  StringView: any;

  // Following function needs to be written in background.js
  // getMemberList: any;

  onLogin: any;
  setPassword: any;
  textsecure: any;
  Session: any;
  log: any;
  i18n: any;
  generateID: any;
  storage: any;
  pushToast: any;

  confirmationDialog: any;
  showQRDialog: any;
  showSeedDialog: any;
  showPasswordDialog: any;
  showEditProfileDialog: any;

  deleteAccount: any;

  toggleTheme: any;
  toggleMenuBar: any;
  toggleSpellCheck: any;
  toggleLinkPreview: any;
  toggleMediaPermissions: any;

  getSettingValue: any;
  setSettingValue: any;
  lokiFeatureFlags: any;

  resetDatabase: any;
  restart: () => void;

  lokiFileServerAPI: any;
  WebAPI: any;
  SenderKeyAPI: any;
}

interface Promise<T> {
  ignore(): void;
}

// Types also correspond to messages.json keys
enum LnsLookupErrorType {
  lnsTooFewNodes,
  lnsLookupTimeout,
  lnsMappingNotFound,
}
