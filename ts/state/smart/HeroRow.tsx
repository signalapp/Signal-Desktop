// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { ConversationHero } from '../../components/conversation/ConversationHero';

import type { StateType } from '../reducer';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getTheme } from '../selectors/user';
import { getHasStoriesSelector } from '../selectors/stories';

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = state.conversations.conversationLookup[id];

  if (!conversation) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }

  return {
    i18n: getIntl(state),
    ...conversation,
    conversationType: conversation.type,
    hasStories: getHasStoriesSelector(state)(id),
    badge: getPreferredBadgeSelector(state)(conversation.badges),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartHeroRow = smart(ConversationHero);
