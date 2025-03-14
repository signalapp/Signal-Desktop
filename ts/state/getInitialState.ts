// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmptyState as accountsEmptyState } from './ducks/accounts';
import { getEmptyState as appEmptyState } from './ducks/app';
import { getEmptyState as audioPlayerEmptyState } from './ducks/audioPlayer';
import { getEmptyState as audioRecorderEmptyState } from './ducks/audioRecorder';
import { getEmptyState as badgesEmptyState } from './ducks/badges';
import { getEmptyState as callHistoryEmptyState } from './ducks/callHistory';
import { getEmptyState as callingEmptyState } from './ducks/calling';
import { getEmptyState as composerEmptyState } from './ducks/composer';
import { getEmptyState as conversationsEmptyState } from './ducks/conversations';
import { getEmptyState as crashReportsEmptyState } from './ducks/crashReports';
import { getEmptyState as emojiEmptyState } from './ducks/emojis';
import { getEmptyState as expirationEmptyState } from './ducks/expiration';
import { getEmptyState as globalModalsEmptyState } from './ducks/globalModals';
import { getEmptyState as inboxEmptyState } from './ducks/inbox';
import { getEmptyState as installerEmptyState } from './ducks/installer';
import { getEmptyState as itemsEmptyState } from './ducks/items';
import { getEmptyState as lightboxEmptyState } from './ducks/lightbox';
import { getEmptyState as linkPreviewsEmptyState } from './ducks/linkPreviews';
import { getEmptyState as mediaGalleryEmptyState } from './ducks/mediaGallery';
import { getEmptyState as navEmptyState } from './ducks/nav';
import { getEmptyState as networkEmptyState } from './ducks/network';
import { getEmptyState as preferredReactionsEmptyState } from './ducks/preferredReactions';
import { getEmptyState as safetyNumberEmptyState } from './ducks/safetyNumber';
import { getEmptyState as searchEmptyState } from './ducks/search';
import { getEmptyState as stickersEmptyState } from './ducks/stickers';
import { getEmptyState as storiesEmptyState } from './ducks/stories';
import { getEmptyState as storyDistributionListsEmptyState } from './ducks/storyDistributionLists';
import { getEmptyState as toastEmptyState } from './ducks/toast';
import { getEmptyState as updatesEmptyState } from './ducks/updates';
import { getEmptyState as userEmptyState } from './ducks/user';
import { getEmptyState as usernameEmptyState } from './ducks/username';

import OS from '../util/os/osMain';
import { getInteractionMode } from '../services/InteractionMode';
import { makeLookup } from '../util/makeLookup';

import type { StateType } from './reducer';
import type { MainWindowStatsType } from '../windows/context';
import type { ConversationsStateType } from './ducks/conversations';
import type { MenuOptionsType } from '../types/menu';
import type {
  StoryDistributionListDataType,
  StoryDistributionListStateType,
} from './ducks/storyDistributionLists';
import type { ThemeType } from '../types/Util';
import type { UserStateType } from './ducks/user';
import type { ReduxInitData } from './initializeRedux';

export function getInitialState(
  {
    badgesState,
    callLinks,
    callHistory: calls,
    callHistoryUnreadCount,
    mainWindowStats,
    menuOptions,
    recentEmoji,
    stickers,
    stories,
    storyDistributionLists,
    theme,
  }: ReduxInitData,
  existingState?: StateType
): StateType {
  const items = window.storage.getItemsState();

  const baseState: StateType = existingState ?? getEmptyState();

  return {
    ...baseState,
    badges: badgesState,
    callHistory: {
      ...callHistoryEmptyState(),
      callHistoryByCallId: makeLookup(calls, 'callId'),
      unreadCount: callHistoryUnreadCount,
    },
    calling: {
      ...callingEmptyState(),
      callLinks: makeLookup(callLinks, 'roomId'),
    },
    emojis: recentEmoji,
    items,
    stickers,
    stories: {
      ...storiesEmptyState(),
      stories,
    },
    storyDistributionLists: generateStoryDistributionListState(
      storyDistributionLists
    ),
    user: generateUserState({
      mainWindowStats,
      menuOptions,
      theme,
    }),
  };
}

export function generateConversationsState(): ConversationsStateType {
  const convoCollection = window.getConversations();
  const formattedConversations = convoCollection.map(conversation =>
    conversation.format()
  );

  return {
    ...conversationsEmptyState(),
    conversationLookup: makeLookup(formattedConversations, 'id'),
    conversationsByE164: makeLookup(formattedConversations, 'e164'),
    conversationsByServiceId: {
      ...makeLookup(formattedConversations, 'serviceId'),
      ...makeLookup(formattedConversations, 'pni'),
    },
    conversationsByGroupId: makeLookup(formattedConversations, 'groupId'),
    conversationsByUsername: makeLookup(formattedConversations, 'username'),
  };
}

function getEmptyState(): StateType {
  return {
    accounts: accountsEmptyState(),
    app: appEmptyState(),
    audioPlayer: audioPlayerEmptyState(),
    audioRecorder: audioRecorderEmptyState(),
    badges: badgesEmptyState(),
    callHistory: callHistoryEmptyState(),
    calling: callingEmptyState(),
    composer: composerEmptyState(),
    conversations: generateConversationsState(),
    crashReports: crashReportsEmptyState(),
    emojis: emojiEmptyState(),
    expiration: expirationEmptyState(),
    globalModals: globalModalsEmptyState(),
    inbox: inboxEmptyState(),
    installer: installerEmptyState(),
    items: itemsEmptyState(),
    lightbox: lightboxEmptyState(),
    linkPreviews: linkPreviewsEmptyState(),
    mediaGallery: mediaGalleryEmptyState(),
    nav: navEmptyState(),
    network: networkEmptyState(),
    preferredReactions: preferredReactionsEmptyState(),
    safetyNumber: safetyNumberEmptyState(),
    search: searchEmptyState(),
    stickers: stickersEmptyState(),
    stories: storiesEmptyState(),
    storyDistributionLists: storyDistributionListsEmptyState(),
    toast: toastEmptyState(),
    updates: updatesEmptyState(),
    user: userEmptyState(),
    username: usernameEmptyState(),
  };
}

export function generateStoryDistributionListState(
  storyDistributionLists: ReadonlyArray<StoryDistributionListDataType>
): StoryDistributionListStateType {
  return {
    ...storyDistributionListsEmptyState(),
    distributionLists: storyDistributionLists || [],
  };
}

export function generateUserState({
  mainWindowStats,
  menuOptions,
  theme,
}: {
  mainWindowStats: MainWindowStatsType;
  menuOptions: MenuOptionsType;
  theme: ThemeType;
}): UserStateType {
  const ourNumber = window.textsecure.storage.user.getNumber();
  const ourAci = window.textsecure.storage.user.getAci();
  const ourPni = window.textsecure.storage.user.getPni();
  const ourConversationId =
    window.ConversationController.getOurConversationId();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();

  let osName: 'windows' | 'macos' | 'linux' | undefined;

  if (OS.isWindows()) {
    osName = 'windows';
  } else if (OS.isMacOS()) {
    osName = 'macos';
  } else if (OS.isLinux()) {
    osName = 'linux';
  }

  return {
    ...userEmptyState(),
    attachmentsPath: window.BasePaths.attachments,
    i18n: window.i18n,
    interactionMode: getInteractionMode(),
    isMainWindowFullScreen: mainWindowStats.isFullScreen,
    isMainWindowMaximized: mainWindowStats.isMaximized,
    localeMessages: window.i18n.getLocaleMessages(),
    menuOptions,
    osName,
    ourAci,
    ourConversationId,
    ourDeviceId,
    ourNumber,
    ourPni,
    platform: window.platform,
    regionCode: window.storage.get('regionCode'),
    stickersPath: window.BasePaths.stickers,
    tempPath: window.BasePaths.temp,
    theme,
    version: window.getVersion(),
  };
}
