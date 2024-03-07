// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  installCallback,
  installSetting,
  installEphemeralSetting,
} from '../util/preload';

// ChatColorPicker redux hookups
installCallback('getCustomColors');
installCallback('getConversationsWithCustomColor');
installCallback('addCustomColor');
installCallback('editCustomColor');
installCallback('removeCustomColor');
installCallback('removeCustomColorOnConversations');
installCallback('resetAllChatColors');
installCallback('resetDefaultChatColor');
installCallback('setGlobalDefaultConversationColor');
installCallback('getDefaultConversationColor');

// Getters only. These are set by the primary device
installSetting('blockedCount', {
  setter: false,
});
installSetting('linkPreviewSetting', {
  setter: false,
});
installSetting('readReceiptSetting', {
  setter: false,
});
installSetting('typingIndicatorSetting', {
  setter: false,
});

installCallback('deleteAllMyStories');
installCallback('isPrimary');
installCallback('syncRequest');

installSetting('alwaysRelayCalls');
installSetting('audioMessage');
installSetting('audioNotification');
installSetting('autoConvertEmoji');
installSetting('autoDownloadUpdate');
installSetting('autoLaunch');
installSetting('callRingtoneNotification');
installSetting('callSystemNotification');
installSetting('countMutedConversations');
installSetting('deviceName');
installSetting('phoneNumber');
installSetting('hasStoriesDisabled');
installSetting('hideMenuBar');
installSetting('incomingCallNotification');
installSetting('lastSyncTime');
installSetting('notificationDrawAttention');
installSetting('notificationSetting');
installSetting('sentMediaQualitySetting');
installSetting('textFormatting');
installSetting('universalExpireTimer');
installSetting('zoomFactor');
installSetting('phoneNumberDiscoverabilitySetting');
installSetting('phoneNumberSharingSetting');

// Media Settings
installCallback('getAvailableIODevices');
installSetting('preferredAudioInputDevice');
installSetting('preferredAudioOutputDevice');
installSetting('preferredVideoInputDevice');

installEphemeralSetting('themeSetting');
installEphemeralSetting('systemTraySetting');
installEphemeralSetting('localeOverride');
installEphemeralSetting('spellCheck');
