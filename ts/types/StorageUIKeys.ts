// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageAccessType } from './Storage.d';

// Configuration keys that only affect UI
export const STORAGE_UI_KEYS: ReadonlyArray<keyof StorageAccessType> = [
  'always-relay-calls',
  'audio-notification',
  'auto-download-update',
  'badge-count-muted-conversations',
  'call-ringtone-notification',
  'call-system-notification',
  'hide-menu-bar',
  'system-tray-setting',
  'incoming-call-notification',
  'notification-draw-attention',
  'notification-setting',
  'spell-check',
  'theme-setting',
  'defaultConversationColor',
  'customColors',
  'showStickerPickerHint',
  'showStickersIntroduction',
  'preferred-video-input-device',
  'preferred-audio-input-device',
  'preferred-audio-output-device',
  'preferredLeftPaneWidth',
  'preferredReactionEmoji',
  'previousAudioDeviceModule',
  'skinTone',
  'zoomFactor',
];
