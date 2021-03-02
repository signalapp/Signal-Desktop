// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { GroupLinkManagement, PropsType } from './GroupLinkManagement';
import { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/GroupLinkManagement',
  module
);

class AccessEnum {
  static ANY = 0;

  static UNKNOWN = 1;

  static MEMBER = 2;

  static ADMINISTRATOR = 3;

  static UNSATISFIABLE = 4;
}

function getConversation(
  groupLink?: string,
  accessControlAddFromInviteLink?: number
): ConversationType {
  return {
    id: '',
    lastUpdated: 0,
    markedUnread: false,
    memberships: Array(32).fill({ member: getDefaultConversation({}) }),
    pendingMemberships: Array(16).fill({ member: getDefaultConversation({}) }),
    title: 'Some Conversation',
    type: 'group',
    groupLink,
    accessControlAddFromInviteLink:
      accessControlAddFromInviteLink !== undefined
        ? accessControlAddFromInviteLink
        : AccessEnum.UNSATISFIABLE,
  };
}

const createProps = (
  conversation?: ConversationType,
  isAdmin = false
): PropsType => ({
  accessEnum: AccessEnum,
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
    getConversation('https://signal.group/1', AccessEnum.ANY),
    true
  );

  return <GroupLinkManagement {...props} />;
});

story.add('On (Admin + Admin Approval Needed)', () => {
  const props = createProps(
    getConversation('https://signal.group/1', AccessEnum.ADMINISTRATOR),
    true
  );

  return <GroupLinkManagement {...props} />;
});

story.add('On (Non-admin)', () => {
  const props = createProps(
    getConversation('https://signal.group/1', AccessEnum.ANY)
  );

  return <GroupLinkManagement {...props} />;
});
