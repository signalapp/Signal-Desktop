// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { times } from 'lodash';

import type { Meta } from '@storybook/react';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { Props } from './ConversationDetails';
import { ConversationDetails } from './ConversationDetails';
import { ChooseGroupMembersModal } from './AddGroupMembersModal/ChooseGroupMembersModal';
import { ConfirmAdditionsModal } from './AddGroupMembersModal/ConfirmAdditionsModal';
import type { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { makeFakeLookupConversationWithoutServiceId } from '../../../test-both/helpers/fakeLookupConversationWithoutServiceId';
import { ThemeType } from '../../../types/Util';
import { DurationInSeconds } from '../../../util/durations';
import { NavTab } from '../../../state/ducks/nav';
import { getFakeCallHistoryGroup } from '../../../test-both/helpers/getFakeCallHistoryGroup';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ConversationDetails/ConversationDetails',
} satisfies Meta<Props>;

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

const createProps = (
  hasGroupLink = false,
  expireTimer?: DurationInSeconds
): Props => ({
  acceptConversation: action('acceptConversation'),
  addMembersToGroup: async () => {
    action('addMembersToGroup');
  },
  areWeASubscriber: false,
  blockConversation: action('blockConversation'),
  canEditGroupInfo: false,
  canAddNewMembers: false,
  conversation: expireTimer
    ? {
        ...conversation,
        expireTimer,
      }
    : conversation,
  hasActiveCall: false,
  hasGroupLink,
  getPreferredBadge: () => undefined,
  getProfilesForConversation: action('getProfilesForConversation'),
  groupsInCommon: [],
  i18n,
  isAdmin: false,
  isGroup: true,
  isSignalConversation: false,
  leaveGroup: action('leaveGroup'),
  loadRecentMediaItems: action('loadRecentMediaItems'),
  memberships: times(32, i => ({
    isAdmin: i === 1,
    member: getDefaultConversation({
      isMe: i === 2,
    }),
  })),
  maxGroupSize: 1001,
  maxRecommendedGroupSize: 151,
  pendingApprovalMemberships: times(8, () => ({
    member: getDefaultConversation(),
  })),
  pendingMemberships: times(5, () => ({
    metadata: {},
    member: getDefaultConversation(),
  })),
  selectedNavTab: NavTab.Chats,
  setDisappearingMessages: action('setDisappearingMessages'),
  showContactModal: action('showContactModal'),
  pushPanelForConversation: action('pushPanelForConversation'),
  showConversation: action('showConversation'),
  showLightbox: action('showLightbox'),
  updateGroupAttributes: async () => {
    action('updateGroupAttributes')();
  },
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  setMuteExpiration: action('setMuteExpiration'),
  userAvatarData: [],
  toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
  toggleAboutContactModal: action('toggleAboutContactModal'),
  toggleAddUserToAnotherGroupModal: action('toggleAddUserToAnotherGroup'),
  onDeleteNicknameAndNote: action('onDeleteNicknameAndNote'),
  onOpenEditNicknameAndNoteModal: action('onOpenEditNicknameAndNoteModal'),
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
        theme={ThemeType.light}
        i18n={i18n}
        lookupConversationWithoutServiceId={makeFakeLookupConversationWithoutServiceId()}
        ourE164={undefined}
        ourUsername={undefined}
        showUserNotFoundModal={action('showUserNotFoundModal')}
        username={undefined}
      />
    );
  },
  renderConfirmAdditionsModal: props => {
    return (
      <ConfirmAdditionsModal {...props} selectedContacts={[]} i18n={i18n} />
    );
  },
});

export function Basic(): JSX.Element {
  const props = createProps();

  return <ConversationDetails {...props} />;
}

export function SystemContact(): JSX.Element {
  const props = createProps();
  const contact = getDefaultConversation();

  return (
    <ConversationDetails
      {...props}
      isGroup={false}
      conversation={{
        ...contact,
        systemGivenName: contact.title,
      }}
    />
  );
}

export function AsAdmin(): JSX.Element {
  const props = createProps();

  return <ConversationDetails {...props} isAdmin />;
}

export function AsLastAdmin(): JSX.Element {
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
}

export function AsOnlyAdmin(): JSX.Element {
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
}

export function GroupEditable(): JSX.Element {
  const props = createProps();

  return <ConversationDetails {...props} canEditGroupInfo />;
}

export function GroupEditableWithCustomDisappearingTimeout(): JSX.Element {
  const props = createProps(false, DurationInSeconds.fromDays(3));

  return <ConversationDetails {...props} canEditGroupInfo />;
}

export function GroupLinksOn(): JSX.Element {
  const props = createProps(true);

  return <ConversationDetails {...props} isAdmin />;
}

export const _11 = (): JSX.Element => (
  <ConversationDetails {...createProps()} isGroup={false} />
);

export function WithCallHistoryGroup(): JSX.Element {
  const props = createProps();

  return (
    <ConversationDetails
      {...props}
      callHistoryGroup={getFakeCallHistoryGroup({
        peerId: props.conversation?.serviceId,
      })}
      selectedNavTab={NavTab.Calls}
    />
  );
}

export function InAnotherCallGroup(): JSX.Element {
  const props = createProps();

  return <ConversationDetails {...props} hasActiveCall />;
}

export function InAnotherCallIndividual(): JSX.Element {
  const props = createProps();

  return <ConversationDetails {...props} hasActiveCall isGroup={false} />;
}

export function SignalConversation(): JSX.Element {
  const props = createProps();

  return (
    <ConversationDetails {...props} isSignalConversation isGroup={false} />
  );
}
