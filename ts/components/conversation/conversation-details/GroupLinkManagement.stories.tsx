// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { PropsType } from './GroupLinkManagement';
import { GroupLinkManagement } from './GroupLinkManagement';
import { SignalService as Proto } from '../../../protobuf';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/GroupLinkManagement',
  module
);

const AccessControlEnum = Proto.AccessControl.AccessRequired;

function getConversation(
  groupLink?: string,
  accessControlAddFromInviteLink?: number
): ConversationType {
  return getDefaultConversation({
    id: '',
    lastUpdated: 0,
    memberships: Array(32).fill({ member: getDefaultConversation({}) }),
    pendingMemberships: Array(16).fill({ member: getDefaultConversation({}) }),
    title: 'Some Conversation',
    type: 'group',
    sharedGroupNames: [],
    groupLink,
    accessControlAddFromInviteLink:
      accessControlAddFromInviteLink !== undefined
        ? accessControlAddFromInviteLink
        : AccessControlEnum.UNSATISFIABLE,
  });
}

const createProps = (
  conversation?: ConversationType,
  isAdmin = false
): PropsType => ({
  changeHasGroupLink: action('changeHasGroupLink'),
  conversation: conversation || getConversation(),
  copyGroupLink: action('copyGroupLink'),
  generateNewGroupLink: action('generateNewGroupLink'),
  i18n,
  isAdmin,
  setAccessControlAddFromInviteLinkSetting: action(
    'setAccessControlAddFromInviteLinkSetting'
  ),
});

story.add('Off (Admin)', () => {
  const props = createProps(undefined, true);

  return <GroupLinkManagement {...props} />;
});

story.add('On (Admin)', () => {
  const props = createProps(
    getConversation('https://signal.group/1', AccessControlEnum.ANY),
    true
  );

  return <GroupLinkManagement {...props} />;
});

story.add('On (Admin + Admin Approval Needed)', () => {
  const props = createProps(
    getConversation('https://signal.group/1', AccessControlEnum.ADMINISTRATOR),
    true
  );

  return <GroupLinkManagement {...props} />;
});

story.add('On (Non-admin)', () => {
  const props = createProps(
    getConversation('https://signal.group/1', AccessControlEnum.ANY)
  );

  return <GroupLinkManagement {...props} />;
});

story.add('Off (Non-admin) - user cannot get here', () => {
  const props = createProps(undefined, false);

  return <GroupLinkManagement {...props} />;
});
