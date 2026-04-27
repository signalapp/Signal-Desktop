// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmptyState as accountsEmptyState } from './ducks/accounts.preload.ts';
import { getEmptyState as appEmptyState } from './ducks/app.preload.ts';
import { getEmptyState as audioPlayerEmptyState } from './ducks/audioPlayer.preload.ts';
import { getEmptyState as audioRecorderEmptyState } from './ducks/audioRecorder.preload.ts';
import { getEmptyState as backupsEmptyState } from './ducks/backups.preload.ts';
import { getEmptyState as badgesEmptyState } from './ducks/badges.preload.ts';
import { getEmptyState as callHistoryEmptyState } from './ducks/callHistory.preload.ts';
import { getEmptyState as callingEmptyState } from './ducks/calling.preload.ts';
import {
  getEmptyState as chatFoldersEmptyState,
  getInitialChatFoldersState,
} from './ducks/chatFolders.preload.ts';
import { getEmptyState as composerEmptyState } from './ducks/composer.preload.ts';
import { getEmptyState as conversationsEmptyState } from './ducks/conversations.preload.ts';
import { getEmptyState as crashReportsEmptyState } from './ducks/crashReports.preload.ts';
import { getEmptyState as donationsEmptyState } from './ducks/donations.preload.ts';
import { getEmptyState as emojiEmptyState } from './ducks/emojis.preload.ts';
import { getEmptyState as expirationEmptyState } from './ducks/expiration.std.ts';
import { getEmptyState as gifsEmptyState } from './ducks/gifs.preload.ts';
import { getEmptyState as globalModalsEmptyState } from './ducks/globalModals.preload.ts';
import { getEmptyState as inboxEmptyState } from './ducks/inbox.std.ts';
import { getEmptyState as installerEmptyState } from './ducks/installer.preload.ts';
import { getEmptyState as itemsEmptyState } from './ducks/items.preload.ts';
import { getEmptyState as lightboxEmptyState } from './ducks/lightbox.preload.ts';
import { getEmptyState as linkPreviewsEmptyState } from './ducks/linkPreviews.preload.ts';
import { getEmptyState as mediaGalleryEmptyState } from './ducks/mediaGallery.preload.ts';
import { getEmptyState as megaphonesEmptyState } from './ducks/megaphones.preload.ts';
import { getEmptyState as navEmptyState } from './ducks/nav.std.ts';
import { getEmptyState as networkEmptyState } from './ducks/network.dom.ts';
import { getEmptyState as notificationProfilesEmptyState } from './ducks/notificationProfiles.preload.ts';
import { getEmptyState as preferredReactionsEmptyState } from './ducks/preferredReactions.preload.ts';
import { getEmptyState as safetyNumberEmptyState } from './ducks/safetyNumber.preload.ts';
import { getEmptyState as searchEmptyState } from './ducks/search.preload.ts';
import { getEmptyState as stickersEmptyState } from './ducks/stickers.preload.ts';
import { getEmptyState as storiesEmptyState } from './ducks/stories.preload.ts';
import { getEmptyState as storyDistributionListsEmptyState } from './ducks/storyDistributionLists.preload.ts';
import { getEmptyState as toastEmptyState } from './ducks/toast.preload.ts';
import { getEmptyState as updatesEmptyState } from './ducks/updates.preload.ts';
import { getEmptyState as userEmptyState } from './ducks/user.preload.ts';
import { getEmptyState as usernameEmptyState } from './ducks/username.preload.ts';

import OS from '../util/os/osMain.node.ts';
import { getInteractionMode } from '../services/InteractionMode.dom.ts';
import { makeLookup } from '../util/makeLookup.std.ts';
import {
  ATTACHMENTS_PATH,
  STICKERS_PATH,
  TEMP_PATH,
} from '../util/basePaths.preload.ts';

import type { StateType } from './reducer.preload.ts';
import type { MainWindowStatsType } from '../windows/context.preload.ts';
import type { ConversationsStateType } from './ducks/conversations.preload.ts';
import type { MenuOptionsType } from '../types/menu.std.ts';
import type {
  StoryDistributionListDataType,
  StoryDistributionListStateType,
} from './ducks/storyDistributionLists.preload.ts';
import type { ThemeType } from '../types/Util.std.ts';
import type { UserStateType } from './ducks/user.preload.ts';
import type { ReduxInitData } from './initializeRedux.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

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
    megaphones: megaphonesEmptyState(),
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

function generateConversationsState(): ConversationsStateType {
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
    backups: backupsEmptyState(),
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
    megaphones: megaphonesEmptyState(),
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

function generateStoryDistributionListState(
  storyDistributionLists: ReadonlyArray<StoryDistributionListDataType>
): StoryDistributionListStateType {
  return {
    ...storyDistributionListsEmptyState(),
    distributionLists: storyDistributionLists || [],
  };
}

function generateUserState({
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
