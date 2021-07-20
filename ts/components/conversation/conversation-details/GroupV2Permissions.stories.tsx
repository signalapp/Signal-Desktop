// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { GroupV2Permissions, PropsType } from './GroupV2Permissions';
import { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/GroupV2Permissions',
  module
);

const conversation: ConversationType = getDefaultConversation({
  id: '',
  lastUpdated: 0,
  memberships: Array(32).fill({ member: getDefaultConversation({}) }),
  pendingMemberships: Array(16).fill({ member: getDefaultConversation({}) }),
  title: 'Some Conversation',
  type: 'group',
  sharedGroupNames: [],
  announcementsOnlyReady: true,
  areWeAdmin: true,
});

const createProps = (): PropsType => ({
  conversation,
  i18n,
  setAccessControlAttributesSetting: action(
    'setAccessControlAttributesSetting'
  ),
  setAccessControlMembersSetting: action('setAccessControlMembersSetting'),
  setAnnouncementsOnly: action('setAnnouncementsOnly'),
});

story.add('Basic', () => {
  const props = createProps();

  return <GroupV2Permissions {...props} />;
});
