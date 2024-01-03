// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import _ from 'lodash';

import type { ConversationType } from '../../../state/ducks/conversations';
import type { LocalizerType, ThemeType } from '../../../types/Util';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges';
import type { AciString } from '../../../types/ServiceId';
import { Avatar, AvatarSize } from '../../Avatar';
import { ConfirmationDialog } from '../../ConfirmationDialog';
import { PanelSection } from './PanelSection';
import { PanelRow } from './PanelRow';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import { isAccessControlEnabled } from '../../../groups/util';
import { Tabs } from '../../Tabs';
import { assertDev } from '../../../util/assert';

export type PropsDataType = {
  readonly conversation?: ConversationType;
  readonly getPreferredBadge: PreferredBadgeSelectorType;
  readonly i18n: LocalizerType;
  readonly ourAci: AciString;
  readonly pendingApprovalMemberships: ReadonlyArray<GroupV2RequestingMembership>;
  readonly pendingMemberships: ReadonlyArray<GroupV2PendingMembership>;
  readonly theme: ThemeType;
};

type PropsActionType = {
  readonly approvePendingMembershipFromGroupV2: (
    conversationId: string,
    memberId: string
  ) => void;
  readonly revokePendingMembershipsFromGroupV2: (
    conversationId: string,
    memberIds: ReadonlyArray<string>
  ) => void;
};

export type PropsType = PropsDataType & PropsActionType;

export type GroupV2PendingMembership = {
  metadata: {
    addedByUserId?: AciString;
  };
  member: ConversationType;
};

export type GroupV2RequestingMembership = {
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

export function PendingInvites({
  approvePendingMembershipFromGroupV2,
  conversation,
  getPreferredBadge,
  i18n,
  ourAci,
  pendingMemberships,
  pendingApprovalMemberships,
  revokePendingMembershipsFromGroupV2,
  theme,
}: PropsType): JSX.Element {
  if (!conversation || !ourAci) {
    throw new Error('PendingInvites rendered without a conversation or ourAci');
  }

  const [stagedMemberships, setStagedMemberships] =
    React.useState<Array<StagedMembershipType> | null>(null);

  return (
    <div className="conversation-details-panel">
      <Tabs
        moduleClassName="ConversationDetails__tabs"
        initialSelectedTab={Tab.Requests}
        tabs={[
          {
            id: Tab.Requests,
            label: i18n('icu:PendingInvites--tab-requests', {
              count: pendingApprovalMemberships.length,
            }),
          },
          {
            id: Tab.Pending,
            label: i18n('icu:PendingInvites--tab-invites', {
              count: pendingMemberships.length,
            }),
          },
        ]}
      >
        {({ selectedTab }) => (
          <>
            {selectedTab === Tab.Requests ? (
              <MembersPendingAdminApproval
                conversation={conversation}
                getPreferredBadge={getPreferredBadge}
                i18n={i18n}
                memberships={pendingApprovalMemberships}
                setStagedMemberships={setStagedMemberships}
                theme={theme}
              />
            ) : null}
            {selectedTab === Tab.Pending ? (
              <MembersPendingProfileKey
                conversation={conversation}
                getPreferredBadge={getPreferredBadge}
                i18n={i18n}
                members={conversation.sortedGroupMembers || []}
                memberships={pendingMemberships}
                ourAci={ourAci}
                setStagedMemberships={setStagedMemberships}
                theme={theme}
              />
            ) : null}
          </>
        )}
      </Tabs>

      {stagedMemberships && stagedMemberships.length && (
        <MembershipActionConfirmation
          approvePendingMembershipFromGroupV2={
            approvePendingMembershipFromGroupV2
          }
          conversation={conversation}
          i18n={i18n}
          members={conversation.sortedGroupMembers || []}
          onClose={() => setStagedMemberships(null)}
          ourAci={ourAci}
          revokePendingMembershipsFromGroupV2={
            revokePendingMembershipsFromGroupV2
          }
          stagedMemberships={stagedMemberships}
        />
      )}
    </div>
  );
}

function MembershipActionConfirmation({
  approvePendingMembershipFromGroupV2,
  conversation,
  i18n,
  members,
  onClose,
  ourAci,
  revokePendingMembershipsFromGroupV2,
  stagedMemberships,
}: {
  approvePendingMembershipFromGroupV2: (
    conversationId: string,
    memberId: string
  ) => void;
  conversation: ConversationType;
  i18n: LocalizerType;
  members: ReadonlyArray<ConversationType>;
  onClose: () => void;
  ourAci: AciString;
  revokePendingMembershipsFromGroupV2: (
    conversationId: string,
    memberIds: ReadonlyArray<string>
  ) => void;
  stagedMemberships: ReadonlyArray<StagedMembershipType>;
}) {
  const revokeStagedMemberships = () => {
    if (!stagedMemberships) {
      return;
    }
    revokePendingMembershipsFromGroupV2(
      conversation.id,
      stagedMemberships.map(({ membership }) => membership.member.id)
    );
  };

  const approveStagedMembership = () => {
    if (!stagedMemberships) {
      return;
    }
    approvePendingMembershipFromGroupV2(
      conversation.id,
      stagedMemberships[0].membership.member.id
    );
  };

  const membershipType = stagedMemberships[0].type;

  const modalAction =
    membershipType === StageType.APPROVE_REQUEST
      ? approveStagedMembership
      : revokeStagedMemberships;

  let modalActionText = i18n('icu:PendingInvites--revoke');

  if (membershipType === StageType.APPROVE_REQUEST) {
    modalActionText = i18n('icu:PendingRequests--approve');
  } else if (membershipType === StageType.DENY_REQUEST) {
    modalActionText = i18n('icu:PendingRequests--deny');
  } else if (membershipType === StageType.REVOKE_INVITE) {
    modalActionText = i18n('icu:PendingInvites--revoke');
  }

  return (
    <ConfirmationDialog
      dialogName="PendingInvites.actionConfirmation"
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
        conversation,
        i18n,
        members,
        ourAci,
        stagedMemberships,
      })}
    </ConfirmationDialog>
  );
}

function getConfirmationMessage({
  conversation,
  i18n,
  members,
  ourAci,
  stagedMemberships,
}: Readonly<{
  conversation: ConversationType;
  i18n: LocalizerType;
  members: ReadonlyArray<ConversationType>;
  ourAci: AciString;
  stagedMemberships: ReadonlyArray<StagedMembershipType>;
}>): string {
  if (!stagedMemberships || !stagedMemberships.length) {
    return '';
  }

  const membershipType = stagedMemberships[0].type;
  const firstMembership = stagedMemberships[0].membership;

  // Requesting a membership since they weren't added by anyone
  if (membershipType === StageType.DENY_REQUEST) {
    return isAccessControlEnabled(conversation.accessControlAddFromInviteLink)
      ? i18n('icu:PendingRequests--deny-for--with-link', {
          name: firstMembership.member.title,
        })
      : i18n('icu:PendingRequests--deny-for', {
          name: firstMembership.member.title,
        });
  }

  if (membershipType === StageType.APPROVE_REQUEST) {
    return i18n('icu:PendingRequests--approve-for', {
      name: firstMembership.member.title,
    });
  }

  if (membershipType !== StageType.REVOKE_INVITE) {
    throw new Error('getConfirmationMessage: Invalid staging type');
  }

  const firstPendingMembership = firstMembership as GroupV2PendingMembership;

  // Pending invite
  const invitedByUs = firstPendingMembership.metadata.addedByUserId === ourAci;

  if (invitedByUs) {
    return i18n('icu:PendingInvites--revoke-for', {
      name: firstPendingMembership.member.title,
    });
  }

  const inviter = members.find(
    ({ serviceId }) =>
      serviceId === firstPendingMembership.metadata.addedByUserId
  );

  if (inviter === undefined) {
    return '';
  }

  const name = inviter.title;

  return i18n('icu:PendingInvites--revoke-from', {
    number: stagedMemberships.length,
    name,
  });
}

function MembersPendingAdminApproval({
  conversation,
  getPreferredBadge,
  i18n,
  memberships,
  setStagedMemberships,
  theme,
}: Readonly<{
  conversation: ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  memberships: ReadonlyArray<GroupV2RequestingMembership>;
  setStagedMemberships: (stagedMembership: Array<StagedMembershipType>) => void;
  theme: ThemeType;
}>) {
  return (
    <PanelSection>
      {memberships.map(membership => (
        <PanelRow
          alwaysShowActions
          key={membership.member.id}
          icon={
            <Avatar
              badge={getPreferredBadge(membership.member.badges)}
              conversationType="direct"
              size={AvatarSize.THIRTY_TWO}
              i18n={i18n}
              theme={theme}
              {...membership.member}
            />
          }
          label={
            <span className="ConversationDetails__MemberName">
              {membership.member.title}
            </span>
          }
          actions={
            conversation.areWeAdmin ? (
              <>
                <button
                  type="button"
                  className="module-button__small ConversationDetails__action-button"
                  onClick={() => {
                    setStagedMemberships([
                      {
                        type: StageType.DENY_REQUEST,
                        membership,
                      },
                    ]);
                  }}
                >
                  {i18n('icu:delete')}
                </button>
                <button
                  type="button"
                  className="module-button__small ConversationDetails__action-button"
                  onClick={() => {
                    setStagedMemberships([
                      {
                        type: StageType.APPROVE_REQUEST,
                        membership,
                      },
                    ]);
                  }}
                >
                  {i18n('icu:accept')}
                </button>
              </>
            ) : null
          }
        />
      ))}
      <div className="ConversationDetails__pending--info">
        {i18n('icu:PendingRequests--info', {
          name: conversation.title,
        })}
      </div>
    </PanelSection>
  );
}

function MembersPendingProfileKey({
  conversation,
  i18n,
  members,
  memberships,
  ourAci,
  setStagedMemberships,
  getPreferredBadge,
  theme,
}: Readonly<{
  conversation: ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  members: ReadonlyArray<ConversationType>;
  memberships: ReadonlyArray<GroupV2PendingMembership>;
  ourAci: AciString;
  setStagedMemberships: (stagedMembership: Array<StagedMembershipType>) => void;
  theme: ThemeType;
}>) {
  const groupedPendingMemberships = _.groupBy(
    memberships,
    membership => membership.metadata.addedByUserId
  );

  const { [ourAci]: ourPendingMemberships, ...otherPendingMembershipGroups } =
    groupedPendingMemberships;

  const otherPendingMemberships = Object.keys(otherPendingMembershipGroups)
    .map(id => members.find(member => member.serviceId === id))
    .filter((member): member is ConversationType => member !== undefined)
    .map(member => {
      assertDev(
        member.serviceId,
        'We just verified that member has serviceId above'
      );
      return {
        member,
        pendingMemberships: otherPendingMembershipGroups[member.serviceId],
      };
    });

  return (
    <PanelSection>
      {ourPendingMemberships && (
        <PanelSection title={i18n('icu:PendingInvites--invited-by-you')}>
          {ourPendingMemberships.map(membership => (
            <PanelRow
              key={membership.member.id}
              icon={
                <Avatar
                  badge={getPreferredBadge(membership.member.badges)}
                  conversationType="direct"
                  size={AvatarSize.THIRTY_TWO}
                  i18n={i18n}
                  theme={theme}
                  {...membership.member}
                />
              }
              label={
                <span className="ConversationDetails__MemberName">
                  {membership.member.title}
                </span>
              }
              actions={
                conversation.areWeAdmin ? (
                  <ConversationDetailsIcon
                    ariaLabel={i18n('icu:PendingInvites--revoke-for-label')}
                    icon={IconType.trash}
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
        <PanelSection title={i18n('icu:PendingInvites--invited-by-others')}>
          {otherPendingMemberships.map(({ member, pendingMemberships }) => (
            <PanelRow
              key={member.id}
              icon={
                <Avatar
                  badge={getPreferredBadge(member.badges)}
                  conversationType="direct"
                  size={AvatarSize.THIRTY_TWO}
                  i18n={i18n}
                  theme={theme}
                  {...member}
                />
              }
              label={member.title}
              right={i18n('icu:PendingInvites--invited-count', {
                number: pendingMemberships.length,
              })}
              actions={
                conversation.areWeAdmin ? (
                  <ConversationDetailsIcon
                    ariaLabel={i18n('icu:PendingInvites--revoke-for-label')}
                    icon={IconType.trash}
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
      <div className="ConversationDetails__pending--info">
        {i18n('icu:PendingInvites--info')}
      </div>
    </PanelSection>
  );
}
