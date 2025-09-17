// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmptyState as accountsEmptyState } from './ducks/accounts.js';
import { getEmptyState as appEmptyState } from './ducks/app.js';
import { getEmptyState as audioPlayerEmptyState } from './ducks/audioPlayer.js';
import { getEmptyState as audioRecorderEmptyState } from './ducks/audioRecorder.js';
import { getEmptyState as badgesEmptyState } from './ducks/badges.js';
import { getEmptyState as callHistoryEmptyState } from './ducks/callHistory.js';
import { getEmptyState as callingEmptyState } from './ducks/calling.js';
import { getEmptyState as chatFoldersEmptyState } from './ducks/chatFolders.js';
import { getEmptyState as composerEmptyState } from './ducks/composer.js';
import { getEmptyState as conversationsEmptyState } from './ducks/conversations.js';
import { getEmptyState as crashReportsEmptyState } from './ducks/crashReports.js';
import { getEmptyState as donationsEmptyState } from './ducks/donations.js';
import { getEmptyState as emojiEmptyState } from './ducks/emojis.js';
import { getEmptyState as expirationEmptyState } from './ducks/expiration.js';
import { getEmptyState as gifsEmptyState } from './ducks/gifs.js';
import { getEmptyState as globalModalsEmptyState } from './ducks/globalModals.js';
import { getEmptyState as inboxEmptyState } from './ducks/inbox.js';
import { getEmptyState as installerEmptyState } from './ducks/installer.js';
import { getEmptyState as itemsEmptyState } from './ducks/items.js';
import { getEmptyState as lightboxEmptyState } from './ducks/lightbox.js';
import { getEmptyState as linkPreviewsEmptyState } from './ducks/linkPreviews.js';
import { getEmptyState as mediaGalleryEmptyState } from './ducks/mediaGallery.js';
import { getEmptyState as navEmptyState } from './ducks/nav.js';
import { getEmptyState as networkEmptyState } from './ducks/network.js';
import { getEmptyState as notificationProfilesEmptyState } from './ducks/notificationProfiles.js';
import { getEmptyState as preferredReactionsEmptyState } from './ducks/preferredReactions.js';
import { getEmptyState as safetyNumberEmptyState } from './ducks/safetyNumber.js';
import { getEmptyState as searchEmptyState } from './ducks/search.js';
import { getEmptyState as stickersEmptyState } from './ducks/stickers.js';
import { getEmptyState as storiesEmptyState } from './ducks/stories.js';
import { getEmptyState as storyDistributionListsEmptyState } from './ducks/storyDistributionLists.js';
import { getEmptyState as toastEmptyState } from './ducks/toast.js';
import { getEmptyState as updatesEmptyState } from './ducks/updates.js';
import { getEmptyState as userEmptyState } from './ducks/user.js';
import { getEmptyState as usernameEmptyState } from './ducks/username.js';

import OS from '../util/os/osMain.js';
import { getInteractionMode } from '../services/InteractionMode.js';
import { makeLookup } from '../util/makeLookup.js';

import type { StateType } from './reducer.js';
import type { MainWindowStatsType } from '../windows/context.js';
import type { ConversationsStateType } from './ducks/conversations.js';
import type { MenuOptionsType } from '../types/menu.js';
import type {
  StoryDistributionListDataType,
  StoryDistributionListStateType,
} from './ducks/storyDistributionLists.js';
import type { ThemeType } from '../types/Util.js';
import type { UserStateType } from './ducks/user.js';
import type { ReduxInitData } from './initializeRedux.js';

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
    chatFolders: {
      ...chatFoldersEmptyState(),
      currentChatFolders: chatFolders,
    },
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
