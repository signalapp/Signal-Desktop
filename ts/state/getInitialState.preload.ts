// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmptyState as accountsEmptyState } from './ducks/accounts.preload.js';
import { getEmptyState as appEmptyState } from './ducks/app.preload.js';
import { getEmptyState as audioPlayerEmptyState } from './ducks/audioPlayer.preload.js';
import { getEmptyState as audioRecorderEmptyState } from './ducks/audioRecorder.preload.js';
import { getEmptyState as badgesEmptyState } from './ducks/badges.preload.js';
import { getEmptyState as callHistoryEmptyState } from './ducks/callHistory.preload.js';
import { getEmptyState as callingEmptyState } from './ducks/calling.preload.js';
import {
  getEmptyState as chatFoldersEmptyState,
  getInitialChatFoldersState,
} from './ducks/chatFolders.preload.js';
import { getEmptyState as composerEmptyState } from './ducks/composer.preload.js';
import { getEmptyState as conversationsEmptyState } from './ducks/conversations.preload.js';
import { getEmptyState as crashReportsEmptyState } from './ducks/crashReports.preload.js';
import { getEmptyState as donationsEmptyState } from './ducks/donations.preload.js';
import { getEmptyState as emojiEmptyState } from './ducks/emojis.preload.js';
import { getEmptyState as expirationEmptyState } from './ducks/expiration.std.js';
import { getEmptyState as gifsEmptyState } from './ducks/gifs.preload.js';
import { getEmptyState as globalModalsEmptyState } from './ducks/globalModals.preload.js';
import { getEmptyState as inboxEmptyState } from './ducks/inbox.std.js';
import { getEmptyState as installerEmptyState } from './ducks/installer.preload.js';
import { getEmptyState as itemsEmptyState } from './ducks/items.preload.js';
import { getEmptyState as lightboxEmptyState } from './ducks/lightbox.preload.js';
import { getEmptyState as linkPreviewsEmptyState } from './ducks/linkPreviews.preload.js';
import { getEmptyState as mediaGalleryEmptyState } from './ducks/mediaGallery.preload.js';
import { getEmptyState as navEmptyState } from './ducks/nav.std.js';
import { getEmptyState as networkEmptyState } from './ducks/network.dom.js';
import { getEmptyState as notificationProfilesEmptyState } from './ducks/notificationProfiles.preload.js';
import { getEmptyState as preferredReactionsEmptyState } from './ducks/preferredReactions.preload.js';
import { getEmptyState as safetyNumberEmptyState } from './ducks/safetyNumber.preload.js';
import { getEmptyState as searchEmptyState } from './ducks/search.preload.js';
import { getEmptyState as stickersEmptyState } from './ducks/stickers.preload.js';
import { getEmptyState as storiesEmptyState } from './ducks/stories.preload.js';
import { getEmptyState as storyDistributionListsEmptyState } from './ducks/storyDistributionLists.preload.js';
import { getEmptyState as toastEmptyState } from './ducks/toast.preload.js';
import { getEmptyState as updatesEmptyState } from './ducks/updates.preload.js';
import { getEmptyState as userEmptyState } from './ducks/user.preload.js';
import { getEmptyState as usernameEmptyState } from './ducks/username.preload.js';

import OS from '../util/os/osMain.node.js';
import { getInteractionMode } from '../services/InteractionMode.dom.js';
import { makeLookup } from '../util/makeLookup.std.js';
import {
  ATTACHMENTS_PATH,
  STICKERS_PATH,
  TEMP_PATH,
} from '../util/basePaths.preload.js';

import type { StateType } from './reducer.preload.js';
import type { MainWindowStatsType } from '../windows/context.preload.js';
import type { ConversationsStateType } from './ducks/conversations.preload.js';
import type { MenuOptionsType } from '../types/menu.std.js';
import type {
  StoryDistributionListDataType,
  StoryDistributionListStateType,
} from './ducks/storyDistributionLists.preload.js';
import type { ThemeType } from '../types/Util.std.js';
import type { UserStateType } from './ducks/user.preload.js';
import type { ReduxInitData } from './initializeRedux.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export function getInitialState(
  {
    badgesState,
    callLinks,
    callHistory: calls,
    callHistoryUnreadCount,
    chatFolders,
    donations,
    gifs,
    mainWindowStats,
    menuOptions,
    notificationProfiles,
    recentEmoji,
    stickers,
    stories,
    storyDistributionLists,
    theme,
  }: ReduxInitData,
  existingState?: StateType
): StateType {
  const items = itemStorage.getItemsState();

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
    chatFolders: getInitialChatFoldersState(chatFolders),
    donations,
    emojis: recentEmoji,
    gifs,
    items,
    notificationProfiles: {
      ...notificationProfilesEmptyState(),
      override: items.notificationProfileOverride,
      profiles: notificationProfiles,
    },
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
  const convoCollection = window.ConversationController.getAll();
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
    chatFolders: chatFoldersEmptyState(),
    composer: composerEmptyState(),
    conversations: generateConversationsState(),
    crashReports: crashReportsEmptyState(),
    donations: donationsEmptyState(),
    emojis: emojiEmptyState(),
    gifs: gifsEmptyState(),
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
    notificationProfiles: notificationProfilesEmptyState(),
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
  const ourNumber = itemStorage.user.getNumber();
  const ourAci = itemStorage.user.getAci();
  const ourPni = itemStorage.user.getPni();
  const ourConversationId =
    window.ConversationController.getOurConversationId();
  const ourDeviceId = itemStorage.user.getDeviceId();

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
    attachmentsPath: ATTACHMENTS_PATH,
    i18n: window.SignalContext.i18n,
    interactionMode: getInteractionMode(),
    isMainWindowFullScreen: mainWindowStats.isFullScreen,
    isMainWindowMaximized: mainWindowStats.isMaximized,
    localeMessages: window.SignalContext.i18n.getLocaleMessages(),
    menuOptions,
    osName,
    ourAci,
    ourConversationId,
    ourDeviceId,
    ourNumber,
    ourPni,
    platform: window.platform,
    regionCode: itemStorage.get('regionCode'),
    stickersPath: STICKERS_PATH,
    tempPath: TEMP_PATH,
    theme,
    version: window.getVersion(),
  };
}
