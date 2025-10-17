// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { innerIsBucketValueEnabled } from '../../RemoteConfig.dom.js';
import type { ConfigKeyType, ConfigMapType } from '../../RemoteConfig.dom.js';
import type { StateType } from '../reducer.preload.js';
import type { ItemsStateType } from '../ducks/items.preload.js';
import type {
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors.std.js';
import type { AciString } from '../../types/ServiceId.std.js';
import { DEFAULT_CONVERSATION_COLOR } from '../../types/Colors.std.js';
import { getPreferredReactionEmoji as getPreferredReactionEmojiFromStoredValue } from '../../reactions/preferredReactionEmoji.std.js';
import { DurationInSeconds } from '../../util/durations/index.std.js';
import * as Bytes from '../../Bytes.std.js';
import { contactByEncryptedUsernameRoute } from '../../util/signalRoutes.std.js';
import { isNotUpdatable } from '../../util/version.std.js';
import {
  EmojiSkinTone,
  isValidEmojiSkinTone,
} from '../../components/fun/data/emojis.std.js';
import { BackupLevel } from '../../services/backups/types.std.js';

const DEFAULT_PREFERRED_LEFT_PANE_WIDTH = 320;

export const getItems = (state: StateType): ItemsStateType => state.items;

export const getAreWeASubscriber = createSelector(
  getItems,
  ({ areWeASubscriber }: Readonly<ItemsStateType>): boolean =>
    Boolean(areWeASubscriber)
);

export const getProfileMovedModalNeeded = createSelector(
  getItems,
  ({ needProfileMovedModal }: Readonly<ItemsStateType>): boolean =>
    Boolean(needProfileMovedModal)
);

export const getUserAgent = createSelector(
  getItems,
  (state: ItemsStateType): string => state.userAgent as string
);

export const getPinnedConversationIds = createSelector(
  getItems,
  (state: ItemsStateType): Array<string> =>
    (state.pinnedConversationIds || []) as Array<string>
);

export const getUniversalExpireTimer = createSelector(
  getItems,
  (state: ItemsStateType): DurationInSeconds =>
    DurationInSeconds.fromSeconds(state.universalExpireTimer || 0)
);

export const isRemoteConfigFlagEnabled = (
  config: Readonly<ConfigMapType>,
  key: ConfigKeyType
): boolean => Boolean(config[key]?.enabled);

// See isBucketValueEnabled in RemoteConfig.ts
export const isRemoteConfigBucketEnabled = (
  config: Readonly<ConfigMapType>,
  name: ConfigKeyType,
  e164: string | undefined,
  aci: AciString | undefined
): boolean => {
  const flagValue = config[name]?.value;
  return innerIsBucketValueEnabled(name, flagValue, e164, aci);
};

export const getRemoteConfig = createSelector(
  getItems,
  (state: ItemsStateType): ConfigMapType => state.remoteConfig || {}
);

export const getServerTimeSkew = createSelector(
  getItems,
  (state: ItemsStateType): number => state.serverTimeSkew || 0
);

export const getHasCompletedUsernameOnboarding = createSelector(
  getItems,
  (state: ItemsStateType): boolean =>
    Boolean(state.hasCompletedUsernameOnboarding)
);

export const getHasCompletedUsernameLinkOnboarding = createSelector(
  getItems,
  (state: ItemsStateType): boolean =>
    Boolean(state.hasCompletedUsernameLinkOnboarding)
);

export const getUsernameCorrupted = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state.usernameCorrupted)
);

export const getUsernameLinkCorrupted = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state.usernameLinkCorrupted)
);

export const getUsernameLinkColor = createSelector(
  getItems,
  (state: ItemsStateType): number | undefined => state.usernameLinkColor
);

export const getUsernameLink = createSelector(
  getItems,
  ({ usernameLink }: ItemsStateType): string | undefined => {
    if (!usernameLink) {
      return undefined;
    }
    const { entropy, serverId } = usernameLink;

    if (!entropy.length || !serverId.length) {
      return undefined;
    }

    const content = Bytes.concatenate([entropy, serverId]);

    return contactByEncryptedUsernameRoute
      .toWebUrl({ encryptedUsername: Bytes.toBase64url(content) })
      .toString();
  }
);

export const isInternalUser = createSelector(
  getRemoteConfig,
  (remoteConfig: ConfigMapType): boolean => {
    return isRemoteConfigFlagEnabled(remoteConfig, 'desktop.internalUser');
  }
);

// Note: ts/util/stories is the other place this check is done
export const getStoriesEnabled = createSelector(
  getItems,
  (state: ItemsStateType): boolean => !state.hasStoriesDisabled
);

export const getDefaultConversationColor = createSelector(
  getItems,
  (
    state: ItemsStateType
  ): {
    color: ConversationColorType;
    customColorData?: {
      id: string;
      value: CustomColorType;
    };
  } => state.defaultConversationColor ?? DEFAULT_CONVERSATION_COLOR
);

export const getCustomColors = createSelector(
  getItems,
  (state: ItemsStateType): Record<string, CustomColorType> | undefined =>
    state.customColors?.colors
);

export const getEmojiSkinToneDefault = createSelector(
  getItems,
  ({ emojiSkinToneDefault }: Readonly<ItemsStateType>): EmojiSkinTone | null =>
    isValidEmojiSkinTone(emojiSkinToneDefault) ? emojiSkinToneDefault : null
);

export const getPreferredLeftPaneWidth = createSelector(
  getItems,
  ({ preferredLeftPaneWidth }: Readonly<ItemsStateType>): number =>
    typeof preferredLeftPaneWidth === 'number' &&
    Number.isInteger(preferredLeftPaneWidth)
      ? preferredLeftPaneWidth
      : DEFAULT_PREFERRED_LEFT_PANE_WIDTH
);

export const getPreferredReactionEmoji = createSelector(
  getItems,
  getEmojiSkinToneDefault,
  (
    state: Readonly<ItemsStateType>,
    emojiSkinToneDefault: EmojiSkinTone | null
  ): Array<string> =>
    getPreferredReactionEmojiFromStoredValue(
      state.preferredReactionEmoji,
      emojiSkinToneDefault ?? EmojiSkinTone.None
    )
);

export const getHideMenuBar = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state['hide-menu-bar'])
);

export const getHasSetMyStoriesPrivacy = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state.hasSetMyStoriesPrivacy)
);

export const getHasReadReceiptSetting = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state['read-receipt-setting'])
);

export const getHasStoryViewReceiptSetting = createSelector(
  getItems,
  (state: ItemsStateType): boolean =>
    Boolean(
      state.storyViewReceiptsEnabled ?? state['read-receipt-setting'] ?? false
    )
);

export const getNotificationProfileSyncDisabled = createSelector(
  getItems,
  (state: ItemsStateType): boolean =>
    Boolean(state.notificationProfileSyncDisabled)
);

export const getRemoteBuildExpiration = createSelector(
  getItems,
  (state: ItemsStateType): number | undefined =>
    state.remoteBuildExpiration === undefined
      ? undefined
      : Number(state.remoteBuildExpiration)
);

export const getAutoDownloadUpdate = createSelector(
  getItems,
  (state: ItemsStateType): boolean => {
    if (isNotUpdatable(window.getVersion())) {
      return false;
    }

    return Boolean(state['auto-download-update'] ?? true);
  }
);

export const getTextFormattingEnabled = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state.textFormatting ?? true)
);

export const getNavTabsCollapsed = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state.navTabsCollapsed ?? false)
);

export const getShowStickersIntroduction = createSelector(
  getItems,
  (state: ItemsStateType): boolean => {
    return state.showStickersIntroduction ?? false;
  }
);

export const getShowStickerPickerHint = createSelector(
  getItems,
  (state: ItemsStateType): boolean => {
    return state.showStickerPickerHint ?? false;
  }
);

export const getHasUnidentifiedDeliveryIndicators = createSelector(
  getItems,
  (state: ItemsStateType): boolean => {
    return state.unidentifiedDeliveryIndicators ?? false;
  }
);

export const getLocalDeleteWarningShown = createSelector(
  getItems,
  (state: ItemsStateType): boolean =>
    Boolean(state.localDeleteWarningShown ?? false)
);

export const getBackupMediaDownloadProgress = createSelector(
  getItems,
  (
    state: ItemsStateType
  ): {
    isBackupMediaEnabled: boolean;
    totalBytes: number;
    downloadedBytes: number;
    isPaused: boolean;
    downloadBannerDismissed: boolean;
    isIdle: boolean;
  } => ({
    isBackupMediaEnabled: state.backupTier === BackupLevel.Paid,
    totalBytes: state.backupMediaDownloadTotalBytes ?? 0,
    downloadedBytes: state.backupMediaDownloadCompletedBytes ?? 0,
    isPaused: state.backupMediaDownloadPaused ?? false,
    isIdle: state.attachmentDownloadManagerIdled ?? false,
    downloadBannerDismissed: state.backupMediaDownloadBannerDismissed ?? false,
  })
);

export const getServerAlerts = createSelector(
  getItems,
  (state: ItemsStateType) => state.serverAlerts ?? {}
);
