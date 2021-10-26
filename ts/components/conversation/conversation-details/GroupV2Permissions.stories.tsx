// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { PropsType } from './GroupV2Permissions';
import { GroupV2Permissions } from './GroupV2Permissions';
import type { ConversationType } from '../../../state/ducks/conversations';
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

story.add('Not admin', () => (
  <GroupV2Permissions
    {...createProps()}
    conversation={getDefaultConversation({
      announcementsOnly: true,
      areWeAdmin: false,
    })}
  />
));

story.add('Admin but not announcement ready', () => (
  <GroupV2Permissions
    {...createProps()}
    conversation={getDefaultConversation({
      announcementsOnlyReady: false,
      areWeAdmin: true,
    })}
  />
));

story.add('Admin, not announcement ready, but it was on', () => (
  <GroupV2Permissions
    {...createProps()}
    conversation={getDefaultConversation({
      announcementsOnly: true,
      announcementsOnlyReady: false,
      areWeAdmin: true,
    })}
  />
));
