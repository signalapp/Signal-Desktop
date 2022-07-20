// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { isInteger } from 'lodash';

import { ITEM_NAME as UNIVERSAL_EXPIRE_TIMER_ITEM } from '../../util/universalExpireTimer';
import type { ConfigKeyType, ConfigMapType } from '../../RemoteConfig';

import type { StateType } from '../reducer';
import type { ItemsStateType } from '../ducks/items';
import type {
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { DEFAULT_CONVERSATION_COLOR } from '../../types/Colors';
import { getPreferredReactionEmoji as getPreferredReactionEmojiFromStoredValue } from '../../reactions/preferredReactionEmoji';

const DEFAULT_PREFERRED_LEFT_PANE_WIDTH = 320;

export const getItems = (state: StateType): ItemsStateType => state.items;

export const getHasAllStoriesMuted = createSelector(
  getItems,
  ({ hasAllStoriesMuted }): boolean => Boolean(hasAllStoriesMuted)
);

export const getAreWeASubscriber = createSelector(
  getItems,
  ({ areWeASubscriber }: Readonly<ItemsStateType>): boolean =>
    Boolean(areWeASubscriber)
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
  (state: ItemsStateType): number => state[UNIVERSAL_EXPIRE_TIMER_ITEM] || 0
);

const isRemoteConfigFlagEnabled = (
  config: Readonly<ConfigMapType>,
  key: ConfigKeyType
): boolean => Boolean(config[key]?.enabled);

const getRemoteConfig = createSelector(
  getItems,
  (state: ItemsStateType): ConfigMapType => state.remoteConfig || {}
);

export const getUsernamesEnabled = createSelector(
  getRemoteConfig,
  (remoteConfig: ConfigMapType): boolean =>
    isRemoteConfigFlagEnabled(remoteConfig, 'desktop.usernames')
);

export const getStoriesEnabled = createSelector(
  getItems,
  getRemoteConfig,
  (state: ItemsStateType, remoteConfig: ConfigMapType): boolean =>
    state.hasStoriesEnabled !== false &&
    (isRemoteConfigFlagEnabled(remoteConfig, 'desktop.internalUser') ||
      isRemoteConfigFlagEnabled(remoteConfig, 'desktop.stories'))
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

export const getEmojiSkinTone = createSelector(
  getItems,
  ({ skinTone }: Readonly<ItemsStateType>): number =>
    typeof skinTone === 'number' &&
    isInteger(skinTone) &&
    skinTone >= 0 &&
    skinTone <= 5
      ? skinTone
      : 0
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
  getEmojiSkinTone,
  (state: Readonly<ItemsStateType>, skinTone: number): Array<string> =>
    getPreferredReactionEmojiFromStoredValue(
      state.preferredReactionEmoji,
      skinTone
    )
);

export const getHideMenuBar = createSelector(
  getItems,
  (state: ItemsStateType): boolean => Boolean(state['hide-menu-bar'])
);
