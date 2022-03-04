// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEmptyState as accounts } from './ducks/accounts';
import { getEmptyState as app } from './ducks/app';
import { getEmptyState as audioPlayer } from './ducks/audioPlayer';
import { getEmptyState as audioRecorder } from './ducks/audioRecorder';
import { getEmptyState as calling } from './ducks/calling';
import { getEmptyState as composer } from './ducks/composer';
import { getEmptyState as conversations } from './ducks/conversations';
import { getEmptyState as crashReports } from './ducks/crashReports';
import { getEmptyState as expiration } from './ducks/expiration';
import { getEmptyState as globalModals } from './ducks/globalModals';
import { getEmptyState as linkPreviews } from './ducks/linkPreviews';
import { getEmptyState as network } from './ducks/network';
import { getEmptyState as preferredReactions } from './ducks/preferredReactions';
import { getEmptyState as safetyNumber } from './ducks/safetyNumber';
import { getEmptyState as search } from './ducks/search';
import { getEmptyState as getStoriesEmptyState } from './ducks/stories';
import { getEmptyState as updates } from './ducks/updates';
import { getEmptyState as user } from './ducks/user';

import type { StateType } from './reducer';

import type { BadgesStateType } from './ducks/badges';
import type { StoryDataType } from './ducks/stories';
import { getInitialState as stickers } from '../types/Stickers';
import { getEmojiReducerState as emojis } from '../util/loadRecentEmojis';

export function getInitialState({
  badges,
  stories,
}: {
  badges: BadgesStateType;
  stories: Array<StoryDataType>;
}): StateType {
  const items = window.storage.getItemsState();

  const convoCollection = window.getConversations();
  const formattedConversations = convoCollection.map(conversation =>
    conversation.format()
  );
  const ourNumber = window.textsecure.storage.user.getNumber();
  const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
  const ourConversationId =
    window.ConversationController.getOurConversationId();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();

  const themeSetting = window.Events.getThemeSetting();
  const theme = themeSetting === 'system' ? window.systemTheme : themeSetting;

  return {
    accounts: accounts(),
    app: app(),
    audioPlayer: audioPlayer(),
    audioRecorder: audioRecorder(),
    badges,
    calling: calling(),
    composer: composer(),
    conversations: {
      ...conversations(),
      conversationLookup: window.Signal.Util.makeLookup(
        formattedConversations,
        'id'
      ),
      conversationsByE164: window.Signal.Util.makeLookup(
        formattedConversations,
        'e164'
      ),
      conversationsByUuid: window.Signal.Util.makeLookup(
        formattedConversations,
        'uuid'
      ),
      conversationsByGroupId: window.Signal.Util.makeLookup(
        formattedConversations,
        'groupId'
      ),
      conversationsByUsername: window.Signal.Util.makeLookup(
        formattedConversations,
        'username'
      ),
    },
    crashReports: crashReports(),
    emojis: emojis(),
    expiration: expiration(),
    globalModals: globalModals(),
    items,
    linkPreviews: linkPreviews(),
    network: network(),
    preferredReactions: preferredReactions(),
    safetyNumber: safetyNumber(),
    search: search(),
    stickers: stickers(),
    stories: {
      ...getStoriesEmptyState(),
      stories,
    },
    updates: updates(),
    user: {
      ...user(),
      attachmentsPath: window.baseAttachmentsPath,
      stickersPath: window.baseStickersPath,
      tempPath: window.baseTempPath,
      regionCode: window.storage.get('regionCode'),
      ourConversationId,
      ourDeviceId,
      ourNumber,
      ourUuid,
      platform: window.platform,
      i18n: window.i18n,
      interactionMode: window.getInteractionMode(),
      theme,
      version: window.getVersion(),
    },
  };
}
