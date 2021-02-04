// Copyright 2020 Signal Messenger, LLC
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

const conversation: ConversationType = {
  id: '',
  lastUpdated: 0,
  markedUnread: false,
  memberships: Array(32).fill({ member: getDefaultConversation({}) }),
  pendingMemberships: Array(16).fill({ member: getDefaultConversation({}) }),
  title: 'Some Conversation',
  type: 'group',
};

class AccessEnum {
  static ANY = 0;

  static UNKNOWN = 1;

  static MEMBER = 2;

  static ADMINISTRATOR = 3;

  static UNSATISFIABLE = 4;
}

const createProps = (): PropsType => ({
  accessEnum: AccessEnum,
  conversation,
  i18n,
  setAccessControlAttributesSetting: action(
    'setAccessControlAttributesSetting'
  ),
  setAccessControlMembersSetting: action('setAccessControlMembersSetting'),
});

story.add('Basic', () => {
  const props = createProps();

  return <GroupV2Permissions {...props} />;
});
