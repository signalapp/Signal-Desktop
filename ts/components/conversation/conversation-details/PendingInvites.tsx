// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import _ from 'lodash';

import { ConversationType } from '../../../state/ducks/conversations';
import { LocalizerType } from '../../../types/Util';
import { Avatar } from '../../Avatar';
import { ConfirmationModal } from '../../ConfirmationModal';
import { PanelSection } from './PanelSection';
import { PanelRow } from './PanelRow';
import { ConversationDetailsIcon } from './ConversationDetailsIcon';
import {
  GroupV2PendingAdminApprovalType,
  GroupV2PendingMemberType,
} from '../../../model-types.d';

export type PropsType = {
  conversation?: ConversationType;
  readonly i18n: LocalizerType;
  ourConversationId?: string;
  readonly approvePendingMembership: (conversationId: string) => void;
  readonly revokePendingMemberships: (conversationIds: Array<string>) => void;
};

export type GroupV2PendingMembership = {
  metadata: GroupV2PendingMemberType;
  member: ConversationType;
};

export type GroupV2RequestingMembership = {
  metadata: GroupV2PendingAdminApprovalType;
  member: ConversationType;
};

enum Tab {
  Requests = 'Requests',
  Pending = 'Pending',
}

enum StageType {
  APPROVE_REQUEST = 'APPROVE_REQUEST',
  DENY_REQUEST = 'DENY_REQUEST',
  REVOKE_INVITE = 'REVOKE_INVITE',
}

type StagedMembershipType = {
  type: StageType;
  membership: GroupV2PendingMembership | GroupV2RequestingMembership;
};

export const PendingInvites: React.ComponentType<PropsType> = ({
  approvePendingMembership,
  conversation,
  i18n,
  ourConversationId,
  revokePendingMemberships,
}) => {
  if (!conversation || !ourConversationId) {
    throw new Error(
      'PendingInvites rendered without a conversation or ourConversationId'
    );
  }

  const [selectedTab, setSelectedTab] = React.useState(Tab.Requests);
  const [stagedMemberships, setStagedMemberships] = React.useState<Array<
    StagedMembershipType
  > | null>(null);

  const allPendingMemberships = conversation.pendingMemberships || [];
  const allRequestingMemberships =
    conversation.pendingApprovalMemberships || [];

  return (
    <div className="conversation-details-panel">
      <div className="module-conversation-details__tabs">
        <div
          className={classNames({
            'module-conversation-details__tab': true,
            'module-conversation-details__tab--selected':
              selectedTab === Tab.Requests,
          })}
          onClick={() => {
            setSelectedTab(Tab.Requests);
          }}
          onKeyUp={(e: React.KeyboardEvent) => {
            if (e.target === e.currentTarget && e.keyCode === 13) {
              setSelectedTab(Tab.Requests);
            }
          }}
          role="tab"
          tabIndex={0}
        >
          {i18n('PendingInvites--tab-requests', {
            count: String(allRequestingMemberships.length),
          })}
        </div>

        <div
          className={classNames({
            'module-conversation-details__tab': true,
            'module-conversation-details__tab--selected':
              selectedTab === Tab.Pending,
          })}
          onClick={() => {
            setSelectedTab(Tab.Pending);
          }}
          onKeyUp={(e: React.KeyboardEvent) => {
            if (e.target === e.currentTarget && e.keyCode === 13) {
              setSelectedTab(Tab.Pending);
            }
          }}
          role="tab"
          tabIndex={0}
        >
          {i18n('PendingInvites--tab-invites', {
            count: String(allPendingMemberships.length),
          })}
        </div>
      </div>

      {selectedTab === Tab.Requests ? (
        <MembersPendingAdminApproval
          conversation={conversation}
          i18n={i18n}
          memberships={allRequestingMemberships}
          setStagedMemberships={setStagedMemberships}
        />
      ) : null}
      {selectedTab === Tab.Pending ? (
        <MembersPendingProfileKey
          conversation={conversation}
          i18n={i18n}
          members={conversation.sortedGroupMembers || []}
          memberships={allPendingMemberships}
          ourConversationId={ourConversationId}
          setStagedMemberships={setStagedMemberships}
        />
      ) : null}

      {stagedMemberships && stagedMemberships.length && (
        <MembershipActionConfirmation
          approvePendingMembership={approvePendingMembership}
          i18n={i18n}
          members={conversation.sortedGroupMembers || []}
          onClose={() => setStagedMemberships(null)}
          ourConversationId={ourConversationId}
          revokePendingMemberships={revokePendingMemberships}
          stagedMemberships={stagedMemberships}
        />
      )}
    </div>
  );
};

function MembershipActionConfirmation({
  approvePendingMembership,
  i18n,
  members,
  onClose,
  ourConversationId,
  revokePendingMemberships,
  stagedMemberships,
}: {
  approvePendingMembership: (conversationId: string) => void;
  i18n: LocalizerType;
  members: Array<ConversationType>;
  onClose: () => void;
  ourConversationId: string;
  revokePendingMemberships: (conversationIds: Array<string>) => void;
  stagedMemberships: Array<StagedMembershipType>;
}) {
  const revokeStagedMemberships = () => {
    if (!stagedMemberships) {
      return;
    }
    revokePendingMemberships(
      stagedMemberships.map(({ membership }) => membership.member.id)
    );
  };

  const approveStagedMembership = () => {
    if (!stagedMemberships) {
      return;
    }
    approvePendingMembership(stagedMemberships[0].membership.member.id);
  };

  const membershipType = stagedMemberships[0].type;

  const modalAction =
    membershipType === StageType.APPROVE_REQUEST
      ? approveStagedMembership
      : revokeStagedMemberships;

  let modalActionText = i18n('PendingInvites--revoke');

  if (membershipType === StageType.APPROVE_REQUEST) {
    modalActionText = i18n('PendingRequests--approve');
  } else if (membershipType === StageType.DENY_REQUEST) {
    modalActionText = i18n('PendingRequests--deny');
  } else if (membershipType === StageType.REVOKE_INVITE) {
    modalActionText = i18n('PendingInvites--revoke');
  }

  return (
    <ConfirmationModal
      actions={[
        {
          action: modalAction,
          style: 'affirmative',
          text: modalActionText,
        },
      ]}
      i18n={i18n}
      onClose={onClose}
    >
      {getConfirmationMessage({
        i18n,
        members,
        ourConversationId,
        stagedMemberships,
      })}
    </ConfirmationModal>
  );
}

function getConfirmationMessage({
  i18n,
  members,
  ourConversationId,
  stagedMemberships,
}: {
  i18n: LocalizerType;
  members: Array<ConversationType>;
  ourConversationId: string;
  stagedMemberships: Array<StagedMembershipType>;
}): string {
  if (!stagedMemberships || !stagedMemberships.length) {
    return '';
  }

  const membershipType = stagedMemberships[0].type;
  const firstMembership = stagedMemberships[0].membership;

  // Requesting a membership since they weren't added by anyone
  if (membershipType === StageType.DENY_REQUEST) {
    return i18n('PendingRequests--deny-for', {
      name: firstMembership.member.title,
    });
  }

  if (membershipType === StageType.APPROVE_REQUEST) {
    return i18n('PendingRequests--approve-for', {
      name: firstMembership.member.title,
    });
  }

  if (membershipType !== StageType.REVOKE_INVITE) {
    throw new Error('getConfirmationMessage: Invalid staging type');
  }

  const firstPendingMembership = firstMembership as GroupV2PendingMembership;

  // Pending invite
  const invitedByUs =
    firstPendingMembership.metadata.addedByUserId === ourConversationId;

  if (invitedByUs) {
    return i18n('PendingInvites--revoke-for', {
      name: firstPendingMembership.member.title,
    });
  }

  const inviter = members.find(
    ({ id }) => id === firstPendingMembership.metadata.addedByUserId
  );

  if (inviter === undefined) {
    return '';
  }

  const name = inviter.title;

  if (stagedMemberships.length === 1) {
    return i18n('PendingInvites--revoke-from-singular', { name });
  }

  return i18n('PendingInvites--revoke-from-plural', {
    number: stagedMemberships.length.toString(),
    name,
  });
}

function MembersPendingAdminApproval({
  conversation,
  i18n,
  memberships,
  setStagedMemberships,
}: {
  conversation: ConversationType;
  i18n: LocalizerType;
  memberships: Array<GroupV2RequestingMembership>;
  setStagedMemberships: (stagedMembership: Array<StagedMembershipType>) => void;
}) {
  return (
    <PanelSection>
      {memberships.map(membership => (
        <PanelRow
          alwaysShowActions
          key={membership.member.id}
          icon={
            <Avatar
              conversationType="direct"
              size={32}
              i18n={i18n}
              {...membership.member}
            />
          }
          label={membership.member.title}
          actions={
            conversation.areWeAdmin ? (
              <>
                <button
                  type="button"
                  className="module-button__small module-conversation-details__action-button"
                  onClick={() => {
                    setStagedMemberships([
                      {
                        type: StageType.DENY_REQUEST,
                        membership,
                      },
                    ]);
                  }}
                >
                  {i18n('delete')}
                </button>
                <button
                  type="button"
                  className="module-button__small module-conversation-details__action-button"
                  onClick={() => {
                    setStagedMemberships([
                      {
                        type: StageType.APPROVE_REQUEST,
                        membership,
                      },
                    ]);
                  }}
                >
                  {i18n('accept')}
                </button>
              </>
            ) : null
          }
        />
      ))}
      <div className="module-conversation-details__pending--info">
        {i18n('PendingRequests--info', [conversation.title])}
      </div>
    </PanelSection>
  );
}

function MembersPendingProfileKey({
  conversation,
  i18n,
  members,
  memberships,
  ourConversationId,
  setStagedMemberships,
}: {
  conversation: ConversationType;
  i18n: LocalizerType;
  members: Array<ConversationType>;
  memberships: Array<GroupV2PendingMembership>;
  ourConversationId: string;
  setStagedMemberships: (stagedMembership: Array<StagedMembershipType>) => void;
}) {
  const groupedPendingMemberships = _.groupBy(
    memberships,
    membership => membership.metadata.addedByUserId
  );

  const {
    [ourConversationId]: ourPendingMemberships,
    ...otherPendingMembershipGroups
  } = groupedPendingMemberships;

  const otherPendingMemberships = Object.keys(otherPendingMembershipGroups)
    .map(id => members.find(member => member.id === id))
    .filter((member): member is ConversationType => member !== undefined)
    .map(member => ({
      member,
      pendingMemberships: otherPendingMembershipGroups[member.id],
    }));

  return (
    <PanelSection>
      {ourPendingMemberships && (
        <PanelSection title={i18n('PendingInvites--invited-by-you')}>
          {ourPendingMemberships.map(membership => (
            <PanelRow
              key={membership.member.id}
              icon={
                <Avatar
                  conversationType="direct"
                  size={32}
                  i18n={i18n}
                  {...membership.member}
                />
              }
              label={membership.member.title}
              actions={
                conversation.areWeAdmin ? (
                  <ConversationDetailsIcon
                    ariaLabel={i18n('PendingInvites--revoke-for-label')}
                    icon="trash"
                    onClick={() => {
                      setStagedMemberships([
                        {
                          type: StageType.REVOKE_INVITE,
                          membership,
                        },
                      ]);
                    }}
                  />
                ) : null
              }
            />
          ))}
        </PanelSection>
      )}
      {otherPendingMemberships.length > 0 && (
        <PanelSection title={i18n('PendingInvites--invited-by-others')}>
          {otherPendingMemberships.map(({ member, pendingMemberships }) => (
            <PanelRow
              key={member.id}
              icon={
                <Avatar
                  conversationType="direct"
                  size={32}
                  i18n={i18n}
                  {...member}
                />
              }
              label={member.title}
              right={i18n('PendingInvites--invited-count', [
                pendingMemberships.length.toString(),
              ])}
              actions={
                conversation.areWeAdmin ? (
                  <ConversationDetailsIcon
                    ariaLabel={i18n('PendingInvites--revoke-for-label')}
                    icon="trash"
                    onClick={() => {
                      setStagedMemberships(
                        pendingMemberships.map(membership => ({
                          type: StageType.REVOKE_INVITE,
                          membership,
                        }))
                      );
                    }}
                  />
                ) : null
              }
            />
          ))}
        </PanelSection>
      )}
      <div className="module-conversation-details__pending--info">
        {i18n('PendingInvites--info')}
      </div>
    </PanelSection>
  );
}
