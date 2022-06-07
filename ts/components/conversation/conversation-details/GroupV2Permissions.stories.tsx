// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { PropsType } from './GroupV2Permissions';
import { GroupV2Permissions } from './GroupV2Permissions';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ConversationDetails/GroupV2Permissions',
};

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

export const Basic = (): JSX.Element => {
  const props = createProps();

  return <GroupV2Permissions {...props} />;
};

export const NotAdmin = (): JSX.Element => (
  <GroupV2Permissions
    {...createProps()}
    conversation={getDefaultConversation({
      announcementsOnly: true,
      areWeAdmin: false,
    })}
  />
);

NotAdmin.story = {
  name: 'Not admin',
};

export const AdminButNotAnnouncementReady = (): JSX.Element => (
  <GroupV2Permissions
    {...createProps()}
    conversation={getDefaultConversation({
      announcementsOnlyReady: false,
      areWeAdmin: true,
    })}
  />
);

AdminButNotAnnouncementReady.story = {
  name: 'Admin but not announcement ready',
};

export const AdminNotAnnouncementReadyButItWasOn = (): JSX.Element => (
  <GroupV2Permissions
    {...createProps()}
    conversation={getDefaultConversation({
      announcementsOnly: true,
      announcementsOnlyReady: false,
      areWeAdmin: true,
    })}
  />
);

AdminNotAnnouncementReadyButItWasOn.story = {
  name: 'Admin, not announcement ready, but it was on',
};
