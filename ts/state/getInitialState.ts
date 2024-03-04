// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmptyState as accounts } from './ducks/accounts';
import { getEmptyState as app } from './ducks/app';
import { getEmptyState as audioPlayer } from './ducks/audioPlayer';
import { getEmptyState as audioRecorder } from './ducks/audioRecorder';
import { getEmptyState as callHistory } from './ducks/callHistory';
import { getEmptyState as calling } from './ducks/calling';
import { getEmptyState as composer } from './ducks/composer';
import { getEmptyState as conversations } from './ducks/conversations';
import { getEmptyState as crashReports } from './ducks/crashReports';
import { getEmptyState as expiration } from './ducks/expiration';
import { getEmptyState as globalModals } from './ducks/globalModals';
import { getEmptyState as inbox } from './ducks/inbox';
import { getEmptyState as lightbox } from './ducks/lightbox';
import { getEmptyState as linkPreviews } from './ducks/linkPreviews';
import { getEmptyState as mediaGallery } from './ducks/mediaGallery';
import { getEmptyState as nav } from './ducks/nav';
import { getEmptyState as network } from './ducks/network';
import { getEmptyState as preferredReactions } from './ducks/preferredReactions';
import { getEmptyState as safetyNumber } from './ducks/safetyNumber';
import { getEmptyState as search } from './ducks/search';
import { getEmptyState as getStoriesEmptyState } from './ducks/stories';
import { getEmptyState as getStoryDistributionListsEmptyState } from './ducks/storyDistributionLists';
import { getEmptyState as getToastEmptyState } from './ducks/toast';
import { getEmptyState as updates } from './ducks/updates';
import { getEmptyState as user } from './ducks/user';
import { getEmptyState as username } from './ducks/username';

import type { StateType } from './reducer';
import type { BadgesStateType } from './ducks/badges';
import type { MainWindowStatsType } from '../windows/context';
import type { MenuOptionsType } from '../types/menu';
import type { StoryDataType } from './ducks/stories';
import type { StoryDistributionListDataType } from './ducks/storyDistributionLists';
import OS from '../util/os/osMain';
import { getEmojiReducerState as emojis } from '../util/loadRecentEmojis';
import { getInitialState as stickers } from '../types/Stickers';
import { getThemeType } from '../util/getThemeType';
import { getInteractionMode } from '../services/InteractionMode';
import { makeLookup } from '../util/makeLookup';
import type { CallHistoryDetails } from '../types/CallDisposition';

export function getInitialState({
  badges,
  callsHistory,
  callsHistoryUnreadCount,
  stories,
  storyDistributionLists,
  mainWindowStats,
  menuOptions,
}: {
  badges: BadgesStateType;
  callsHistory: ReadonlyArray<CallHistoryDetails>;
  callsHistoryUnreadCount: number;
  stories: Array<StoryDataType>;
  storyDistributionLists: Array<StoryDistributionListDataType>;
  mainWindowStats: MainWindowStatsType;
  menuOptions: MenuOptionsType;
}): StateType {
  const items = window.storage.getItemsState();

  const convoCollection = window.getConversations();
  const formattedConversations = convoCollection.map(conversation =>
    conversation.format()
  );
  const ourNumber = window.textsecure.storage.user.getNumber();
  const ourAci = window.textsecure.storage.user.getAci();
  const ourPni = window.textsecure.storage.user.getPni();
  const ourConversationId =
    window.ConversationController.getOurConversationId();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();

  const theme = getThemeType();

  let osName: 'windows' | 'macos' | 'linux' | undefined;

  if (OS.isWindows()) {
    osName = 'windows';
  } else if (OS.isMacOS()) {
    osName = 'macos';
  } else if (OS.isLinux()) {
    osName = 'linux';
  }

  return {
    accounts: accounts(),
    app: app(),
    audioPlayer: audioPlayer(),
    audioRecorder: audioRecorder(),
    badges,
    callHistory: {
      ...callHistory(),
      callHistoryByCallId: makeLookup(callsHistory, 'callId'),
      unreadCount: callsHistoryUnreadCount,
    },
    calling: calling(),
    composer: composer(),
    conversations: {
      ...conversations(),
      conversationLookup: makeLookup(formattedConversations, 'id'),
      conversationsByE164: makeLookup(formattedConversations, 'e164'),
      conversationsByServiceId: {
        ...makeLookup(formattedConversations, 'serviceId'),
        ...makeLookup(formattedConversations, 'pni'),
      },
      conversationsByGroupId: makeLookup(formattedConversations, 'groupId'),
      conversationsByUsername: makeLookup(formattedConversations, 'username'),
    },
    crashReports: crashReports(),
    emojis: emojis(),
    expiration: expiration(),
    globalModals: globalModals(),
    inbox: inbox(),
    items,
    lightbox: lightbox(),
    linkPreviews: linkPreviews(),
    mediaGallery: mediaGallery(),
    nav: nav(),
    network: network(),
    preferredReactions: preferredReactions(),
    safetyNumber: safetyNumber(),
    search: search(),
    stickers: stickers(),
    stories: {
      ...getStoriesEmptyState(),
      stories,
    },
    storyDistributionLists: {
      ...getStoryDistributionListsEmptyState(),
      distributionLists: storyDistributionLists || [],
    },
    toast: getToastEmptyState(),
    updates: updates(),
    user: {
      ...user(),
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
    },
    username: username(),
  };
}
