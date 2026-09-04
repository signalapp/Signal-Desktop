// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type ReactNode, useState, type JSX } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.ts';
import type { AciString } from '../../../types/ServiceId.std.ts';
import { Avatar, AvatarSize } from '../../Avatar.dom.tsx';
import { isAccessControlEnabled } from '../../../groups/util.std.ts';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoTabs } from '../../../axo/AxoTabs.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoContainer } from '../../../axo/AxoContainer.dom.tsx';

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

  const [tab, setTab] = useState<string>(Tab.Requests);

  const [stagedMemberships, setStagedMemberships] =
    useState<Array<StagedMembershipType> | null>(null);

  return (
    <AxoContainer.Root>
      <AxoTabs.Root value={tab} onValueChange={setTab}>
        <AxoTabs.List>
          <AxoTabs.Trigger value={Tab.Requests}>
            {i18n('icu:PendingInvites--tab-requests', {
              count: pendingApprovalMemberships.length,
            })}
          </AxoTabs.Trigger>
          <AxoTabs.Trigger value={Tab.Pending}>
            {i18n('icu:PendingInvites--tab-invites', {
              count: pendingMemberships.length,
            })}
          </AxoTabs.Trigger>
        </AxoTabs.List>
        <AxoTabs.Content value={Tab.Requests}>
          <div className={tw('pt-3.5')}>
            <MembersPendingAdminApproval
              conversation={conversation}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              memberships={pendingApprovalMemberships}
              setStagedMemberships={setStagedMemberships}
              theme={theme}
            />
          </div>
        </AxoTabs.Content>
        <AxoTabs.Content value={Tab.Pending}>
          <div className={tw('pt-1.5')}>
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
          </div>
        </AxoTabs.Content>
      </AxoTabs.Root>
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
    </AxoContainer.Root>
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
      // oxlint-disable-next-line typescript/no-non-null-assertion
      stagedMemberships[0]!.membership.member.id
    );
  };

  // oxlint-disable-next-line typescript/no-non-null-assertion
  const membershipType = stagedMemberships[0]!.type;

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
    <AxoConfirmDialog.Root
      open
      onOpenChange={onClose}
      // @ts-expect-error ConfirmationDialog migration: Needs title
      title={null}
      description={getConfirmationMessage({
        conversation,
        i18n,
        members,
        ourAci,
        stagedMemberships,
      })}
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action variant="strong-primary" onClick={modalAction}>
        {modalActionText}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
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
  const [stagedMembership] = stagedMemberships;
  if (stagedMembership == null) {
    return '';
  }

  const membershipType = stagedMembership.type;
  const firstMembership = stagedMembership.membership;

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
    <AxoList.Group>
      {memberships.length > 0 && (
        <List
          footerDescription={i18n('icu:PendingRequests--info', {
            name: conversation.title,
          })}
        >
          {memberships.map(membership => {
            return (
              <AxoItem.Root key={membership.member.id}>
                <AxoItem.Leading>
                  <Avatar
                    badge={getPreferredBadge(membership.member.badges)}
                    conversationType="direct"
                    size={AvatarSize.THIRTY_TWO}
                    i18n={i18n}
                    theme={theme}
                    {...membership.member}
                  />
                </AxoItem.Leading>
                <AxoItem.Content>
                  <AxoItem.Body>
                    <AxoItem.Label>{membership.member.title}</AxoItem.Label>
                  </AxoItem.Body>
                  <AxoItem.Trailing>
                    <AxoItem.IconAction
                      symbol="x"
                      variant="subtle-destructive"
                      label={i18n('icu:delete')}
                      onClick={() => {
                        setStagedMemberships([
                          {
                            type: StageType.DENY_REQUEST,
                            membership,
                          },
                        ]);
                      }}
                    />
                    <AxoItem.IconAction
                      symbol="check"
                      variant="subtle-affirmative"
                      label={i18n('icu:accept')}
                      onClick={() => {
                        setStagedMemberships([
                          {
                            type: StageType.APPROVE_REQUEST,
                            membership,
                          },
                        ]);
                      }}
                    />
                  </AxoItem.Trailing>
                </AxoItem.Content>
              </AxoItem.Root>
            );
          })}
        </List>
      )}
    </AxoList.Group>
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
  const invitedByUs: Array<GroupV2PendingMembership> = [];
  const invitedByOthers = new Map<
    ConversationType,
    Array<GroupV2PendingMembership>
  >();

  for (const membership of memberships) {
    const inviterAci = membership.metadata.addedByUserId;
    if (inviterAci == null) {
      continue;
    }

    if (inviterAci === ourAci) {
      invitedByUs.push(membership);
      continue;
    }

    const inviterMember = members.find(m => m.serviceId === inviterAci);
    if (inviterMember == null) {
      continue;
    }

    // Group pending invited members by who invited them
    invitedByOthers.getOrInsert(inviterMember, []).push(membership);
  }

  return (
    <AxoList.Group>
      {invitedByUs.length > 0 && (
        <List label={i18n('icu:PendingInvites--invited-by-you')}>
          {invitedByUs.map(membership => {
            return (
              <AxoItem.Root key={membership.member.id}>
                <AxoItem.Leading>
                  <Avatar
                    badge={getPreferredBadge(membership.member.badges)}
                    conversationType="direct"
                    size={AvatarSize.THIRTY_TWO}
                    i18n={i18n}
                    theme={theme}
                    {...membership.member}
                  />
                </AxoItem.Leading>
                <AxoItem.Content>
                  <AxoItem.Body>
                    <AxoItem.Label>{membership.member.title}</AxoItem.Label>
                  </AxoItem.Body>
                  {conversation.areWeAdmin && (
                    <AxoItem.Trailing>
                      <AxoItem.IconAction
                        symbol="trash"
                        variant="subtle-destructive"
                        label={i18n('icu:PendingInvites--revoke-for-label')}
                        onClick={() => {
                          setStagedMemberships([
                            {
                              type: StageType.REVOKE_INVITE,
                              membership,
                            },
                          ]);
                        }}
                      />
                    </AxoItem.Trailing>
                  )}
                </AxoItem.Content>
              </AxoItem.Root>
            );
          })}
        </List>
      )}
      {invitedByOthers.size > 0 && (
        <List
          label={i18n('icu:PendingInvites--invited-by-others')}
          footerDescription={i18n('icu:PendingInvites--info')}
        >
          {invitedByOthers.entries().map(([member, otherMemberships]) => {
            return (
              <AxoItem.Root key={member.id}>
                <AxoItem.Leading>
                  <Avatar
                    badge={getPreferredBadge(member.badges)}
                    conversationType="direct"
                    size={AvatarSize.THIRTY_TWO}
                    i18n={i18n}
                    theme={theme}
                    {...member}
                  />
                </AxoItem.Leading>
                <AxoItem.Content>
                  <AxoItem.Body>
                    <AxoItem.Label>{member.title}</AxoItem.Label>
                    <AxoItem.Value>
                      {i18n('icu:PendingInvites--invited-count', {
                        number: otherMemberships.length,
                      })}
                    </AxoItem.Value>
                  </AxoItem.Body>
                  {conversation.areWeAdmin && (
                    <AxoItem.Trailing>
                      <AxoItem.IconAction
                        symbol="trash"
                        variant="subtle-destructive"
                        label={i18n('icu:PendingInvites--revoke-for-label')}
                        onClick={() => {
                          setStagedMemberships(
                            otherMemberships.map(membership => {
                              return {
                                type: StageType.REVOKE_INVITE,
                                membership,
                              };
                            })
                          );
                        }}
                      />
                    </AxoItem.Trailing>
                  )}
                </AxoItem.Content>
              </AxoItem.Root>
            );
          })}
        </List>
      )}
    </AxoList.Group>
  );
}

type ListProps = Readonly<{
  label?: string;
  footerDescription?: string;
  children: ReactNode;
}>;

function List(props: ListProps): ReactNode {
  return (
    <AxoList.Root>
      {props.label != null && (
        <AxoList.Header>
          <AxoList.Label>{props.label}</AxoList.Label>
        </AxoList.Header>
      )}
      <AxoList.Body>
        <AxoItem.Group>{props.children}</AxoItem.Group>
      </AxoList.Body>
      {props.footerDescription != null && (
        <AxoList.Footer>
          <AxoList.FooterDescription>
            {props.footerDescription}
          </AxoList.FooterDescription>
        </AxoList.Footer>
      )}
    </AxoList.Root>
  );
}
