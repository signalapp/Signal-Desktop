// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { times } from 'lodash';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { Props } from './ConversationDetails';
import { ConversationDetails } from './ConversationDetails';
import { ChooseGroupMembersModal } from './AddGroupMembersModal/ChooseGroupMembersModal';
import { ConfirmAdditionsModal } from './AddGroupMembersModal/ConfirmAdditionsModal';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { makeFakeLookupConversationWithoutUuid } from '../../../test-both/helpers/fakeLookupConversationWithoutUuid';
import { ThemeType } from '../../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ConversationDetails/ConversationDetails',
};

const conversation: ConversationType = getDefaultConversation({
  id: '',
  lastUpdated: 0,
  title: 'Some Conversation',
  groupDescription: 'Hello World!',
  type: 'group',
  sharedGroupNames: [],
  conversationColor: 'ultramarine' as const,
});

const allCandidateContacts = times(10, () => getDefaultConversation());

const createProps = (hasGroupLink = false, expireTimer?: number): Props => ({
  addMembers: async () => {
    action('addMembers');
  },
  areWeASubscriber: false,
  canEditGroupInfo: false,
  conversation: expireTimer
    ? {
        ...conversation,
        expireTimer,
      }
    : conversation,
  hasActiveCall: false,
  hasGroupLink,
  getPreferredBadge: () => undefined,
  i18n,
  isAdmin: false,
  isGroup: true,
  loadRecentMediaItems: action('loadRecentMediaItems'),
  memberships: times(32, i => ({
    isAdmin: i === 1,
    member: getDefaultConversation({
      isMe: i === 2,
    }),
  })),
  pendingApprovalMemberships: times(8, () => ({
    member: getDefaultConversation(),
  })),
  pendingMemberships: times(5, () => ({
    metadata: {},
    member: getDefaultConversation(),
  })),
  setDisappearingMessages: action('setDisappearingMessages'),
  showAllMedia: action('showAllMedia'),
  showContactModal: action('showContactModal'),
  showChatColorEditor: action('showChatColorEditor'),
  showGroupLinkManagement: action('showGroupLinkManagement'),
  showGroupV2Permissions: action('showGroupV2Permissions'),
  showConversationNotificationsSettings: action(
    'showConversationNotificationsSettings'
  ),
  showPendingInvites: action('showPendingInvites'),
  showLightboxForMedia: action('showLightboxForMedia'),
  updateGroupAttributes: async () => {
    action('updateGroupAttributes')();
  },
  onBlock: action('onBlock'),
  onLeave: action('onLeave'),
  onUnblock: action('onUnblock'),
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  setMuteExpiration: action('setMuteExpiration'),
  userAvatarData: [],
  toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
  onOutgoingAudioCallInConversation: action(
    'onOutgoingAudioCallInConversation'
  ),
  onOutgoingVideoCallInConversation: action(
    'onOutgoingVideoCallInConversation'
  ),
  searchInConversation: action('searchInConversation'),
  theme: ThemeType.light,
  renderChooseGroupMembersModal: props => {
    return (
      <ChooseGroupMembersModal
        {...props}
        candidateContacts={allCandidateContacts}
        selectedContacts={[]}
        regionCode="US"
        getPreferredBadge={() => undefined}
        theme={ThemeType.light}
        i18n={i18n}
        lookupConversationWithoutUuid={makeFakeLookupConversationWithoutUuid()}
        showUserNotFoundModal={action('showUserNotFoundModal')}
        isUsernamesEnabled
      />
    );
  },
  renderConfirmAdditionsModal: props => {
    return (
      <ConfirmAdditionsModal {...props} selectedContacts={[]} i18n={i18n} />
    );
  },
});

export const Basic = (): JSX.Element => {
  const props = createProps();

  return <ConversationDetails {...props} />;
};

export const AsAdmin = (): JSX.Element => {
  const props = createProps();

  return <ConversationDetails {...props} isAdmin />;
};

AsAdmin.story = {
  name: 'as Admin',
};

export const AsLastAdmin = (): JSX.Element => {
  const props = createProps();

  return (
    <ConversationDetails
      {...props}
      isAdmin
      memberships={times(32, i => ({
        isAdmin: i === 2,
        member: getDefaultConversation({
          isMe: i === 2,
        }),
      }))}
    />
  );
};

AsLastAdmin.story = {
  name: 'as last admin',
};

export const AsOnlyAdmin = (): JSX.Element => {
  const props = createProps();

  return (
    <ConversationDetails
      {...props}
      isAdmin
      memberships={[
        {
          isAdmin: true,
          member: getDefaultConversation({
            isMe: true,
          }),
        },
      ]}
    />
  );
};

AsOnlyAdmin.story = {
  name: 'as only admin',
};

export const GroupEditable = (): JSX.Element => {
  const props = createProps();

  return <ConversationDetails {...props} canEditGroupInfo />;
};

export const GroupEditableWithCustomDisappearingTimeout = (): JSX.Element => {
  const props = createProps(false, 3 * 24 * 60 * 60);

  return <ConversationDetails {...props} canEditGroupInfo />;
};

GroupEditableWithCustomDisappearingTimeout.story = {
  name: 'Group Editable with custom disappearing timeout',
};

export const GroupLinksOn = (): JSX.Element => {
  const props = createProps(true);

  return <ConversationDetails {...props} isAdmin />;
};

export const _11 = (): JSX.Element => (
  <ConversationDetails {...createProps()} isGroup={false} />
);

_11.story = {
  name: '1:1',
};
