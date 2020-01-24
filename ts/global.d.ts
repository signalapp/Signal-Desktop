interface Window {
  versionInfo: any;

  Events: any;
  deleteAllData: any;
  getAccountManager: any;
  mnemonic: any;
  clipboard: any;

  passwordUtil: any;
  userConfig: any;

  dcodeIO: any;
  libsignal: any;
  libloki: any;
  displayNameRegex: any;

  Signal: any;
  Whisper: any;
  ConversationController: any;

  // Following function needs to be written in background.js
  // getMemberList: any;

  setPassword: any;
  textsecure: any;
  Session: any;
  log: any;
  i18n: any;
  friends: any;
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
}

interface Promise<T> {
  ignore(): void;
}
