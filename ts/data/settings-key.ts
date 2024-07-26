const settingsReadReceipt = 'read-receipt-setting';
const settingsTypingIndicator = 'typing-indicators-setting';
const settingsAutoUpdate = 'auto-update';
const hasShiftSendEnabled = 'hasShiftSendEnabled';
const settingsMenuBar = 'hide-menu-bar';
const settingsSpellCheck = 'spell-check';
const settingsLinkPreview = 'link-preview-setting';
const hasBlindedMsgRequestsEnabled = 'hasBlindedMsgRequestsEnabled';
const settingsStartInTray = 'start-in-tray-setting';
const settingsOpengroupPruning = 'prune-setting';
const settingsNotification = 'notification-setting';
const settingsAudioNotification = 'audio-notification-setting';
const someDeviceOutdatedSyncing = 'someDeviceOutdatedSyncing';
const hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';
const lastAvatarUploadTimestamp = 'lastAvatarUploadTimestamp';
const hasLinkPreviewPopupBeenDisplayed = 'hasLinkPreviewPopupBeenDisplayed';
const hasFollowSystemThemeEnabled = 'hasFollowSystemThemeEnabled';
const hideRecoveryPassword = 'hideRecoveryPassword';

// user config tracking timestamps (to discard incoming messages which would make a change we reverted in the last config message we merged)
const latestUserProfileEnvelopeTimestamp = 'latestUserProfileEnvelopeTimestamp';
const latestUserGroupEnvelopeTimestamp = 'latestUserGroupEnvelopeTimestamp';
const latestUserContactsEnvelopeTimestamp = 'latestUserContactsEnvelopeTimestamp';

export const SettingsKey = {
  settingsReadReceipt,
  settingsTypingIndicator,
  settingsAutoUpdate,
  hasShiftSendEnabled,
  settingsMenuBar,
  settingsSpellCheck,
  settingsLinkPreview,
  settingsStartInTray,
  settingsOpengroupPruning,
  hasBlindedMsgRequestsEnabled,
  settingsNotification,
  settingsAudioNotification,
  someDeviceOutdatedSyncing,
  hasSyncedInitialConfigurationItem,
  lastAvatarUploadTimestamp,
  hasLinkPreviewPopupBeenDisplayed,
  latestUserProfileEnvelopeTimestamp,
  latestUserGroupEnvelopeTimestamp,
  latestUserContactsEnvelopeTimestamp,
  hasFollowSystemThemeEnabled,
  hideRecoveryPassword,
} as const;

export const KNOWN_BLINDED_KEYS_ITEM = 'KNOWN_BLINDED_KEYS_ITEM';
export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';
