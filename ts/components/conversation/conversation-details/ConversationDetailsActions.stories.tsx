// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { Props } from './ConversationDetailsActions';
import { ConversationDetailsActions } from './ConversationDetailsActions';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationDetailsActions',
  module
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  cannotLeaveBecauseYouAreLastAdmin: isBoolean(
    overrideProps.cannotLeaveBecauseYouAreLastAdmin
  )
    ? overrideProps.cannotLeaveBecauseYouAreLastAdmin
    : false,
  conversationTitle: overrideProps.conversationTitle || '',
  left: isBoolean(overrideProps.left) ? overrideProps.left : false,
  onBlock: action('onBlock'),
  onLeave: action('onLeave'),
  onUnblock: action('onUnblock'),
  i18n,
  isBlocked: false,
  isGroup: true,
});

story.add('Basic', () => {
  const props = createProps();

  return <ConversationDetailsActions {...props} />;
});

story.add('Left the group', () => {
  const props = createProps({ left: true });

  return <ConversationDetailsActions {...props} />;
});

story.add('Cannot leave because you are the last admin', () => {
  const props = createProps({ cannotLeaveBecauseYouAreLastAdmin: true });

  return <ConversationDetailsActions {...props} />;
});

story.add('1:1', () => (
  <ConversationDetailsActions {...createProps()} isGroup={false} />
));

story.add('1:1 Blocked', () => (
  <ConversationDetailsActions {...createProps()} isGroup={false} isBlocked />
));
