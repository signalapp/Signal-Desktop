// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useState } from 'react';

import { Button, ButtonIconType, ButtonVariant } from '../../Button';
import { Tooltip } from '../../Tooltip';
import type {
  ConversationType,
  PushPanelForConversationActionType,
  ShowConversationType,
} from '../../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges';
import type { SmartChooseGroupMembersModalPropsType } from '../../../state/smart/ChooseGroupMembersModal';
import type { SmartConfirmAdditionsModalPropsType } from '../../../state/smart/ConfirmAdditionsModal';
import { assertDev } from '../../../util/assert';
import { getMutedUntilText } from '../../../util/getMutedUntilText';

import type { LocalizerType, ThemeType } from '../../../types/Util';
import type { BadgeType } from '../../../badges/types';
import { missingCaseError } from '../../../util/missingCaseError';
import { DurationInSeconds } from '../../../util/durations';

import { DisappearingTimerSelect } from '../../DisappearingTimerSelect';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { AddGroupMembersModal } from './AddGroupMembersModal';
import { ConversationDetailsActions } from './ConversationDetailsActions';
import { ConversationDetailsHeader } from './ConversationDetailsHeader';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import type { Props as ConversationDetailsMediaListPropsType } from './ConversationDetailsMediaList';
import { ConversationDetailsMediaList } from './ConversationDetailsMediaList';
import type { GroupV2Membership } from './ConversationDetailsMembershipList';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList';
import type {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from './PendingInvites';
import { EditConversationAttributesModal } from './EditConversationAttributesModal';
import { RequestState } from './util';
import { getCustomColorStyle } from '../../../util/getCustomColorStyle';
import { ConfirmationDialog } from '../../ConfirmationDialog';
import { ConversationNotificationsModal } from './ConversationNotificationsModal';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../../types/Avatar';
import { isConversationMuted } from '../../../util/isConversationMuted';
import { ConversationDetailsGroups } from './ConversationDetailsGroups';
import { PanelType } from '../../../types/Panels';

enum ModalState {
  NothingOpen,
  EditingGroupDescription,
  EditingGroupTitle,
  AddingGroupMembers,
  MuteNotifications,
  UnmuteNotifications,
}

export type StateProps = {
  areWeASubscriber: boolean;
  badges?: ReadonlyArray<BadgeType>;
  canEditGroupInfo: boolean;
  canAddNewMembers: boolean;
  conversation?: ConversationType;
  hasGroupLink: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasActiveCall: boolean;
  i18n: LocalizerType;
  isAdmin: boolean;
  isGroup: boolean;
  groupsInCommon: ReadonlyArray<ConversationType>;
  maxGroupSize: number;
  maxRecommendedGroupSize: number;
  memberships: ReadonlyArray<GroupV2Membership>;
  pendingApprovalMemberships: ReadonlyArray<GroupV2RequestingMembership>;
  pendingMemberships: ReadonlyArray<GroupV2PendingMembership>;
  theme: ThemeType;
  userAvatarData: ReadonlyArray<AvatarDataType>;
  renderChooseGroupMembersModal: (
    props: SmartChooseGroupMembersModalPropsType
  ) => JSX.Element;
  renderConfirmAdditionsModal: (
    props: SmartConfirmAdditionsModalPropsType
  ) => JSX.Element;
};

type ActionProps = {
  acceptConversation: (id: string) => void;
  addMembersToGroup: (
    conversationId: string,
    conversationIds: ReadonlyArray<string>,
    opts: {
      onSuccess?: () => unknown;
      onFailure?: () => unknown;
    }
  ) => unknown;
  blockConversation: (id: string) => void;
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  getProfilesForConversation: (id: string) => unknown;
  leaveGroup: (conversationId: string) => void;
  loadRecentMediaItems: (id: string, limit: number) => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => unknown;
  onOutgoingVideoCallInConversation: (conversationId: string) => unknown;
  pushPanelForConversation: PushPanelForConversationActionType;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  searchInConversation: (id: string) => unknown;
  setDisappearingMessages: (id: string, seconds: DurationInSeconds) => void;
  setMuteExpiration: (id: string, muteExpiresAt: undefined | number) => unknown;
  showContactModal: (contactId: string, conversationId?: string) => void;
  showConversation: ShowConversationType;
  toggleAddUserToAnotherGroupModal: (contactId?: string) => void;
  toggleSafetyNumberModal: (conversationId: string) => unknown;
  updateGroupAttributes: (
    conversationId: string,
    _: Readonly<{
      avatar?: undefined | Uint8Array;
      description?: string;
      title?: string;
    }>,
    opts: {
      onSuccess?: () => unknown;
      onFailure?: () => unknown;
    }
  ) => unknown;
} & Pick<ConversationDetailsMediaListPropsType, 'showLightboxWithMedia'>;

export type Props = StateProps & ActionProps;

export function ConversationDetails({
  acceptConversation,
  addMembersToGroup,
  areWeASubscriber,
  badges,
  blockConversation,
  canEditGroupInfo,
  canAddNewMembers,
  conversation,
  deleteAvatarFromDisk,
  hasGroupLink,
  getPreferredBadge,
  getProfilesForConversation,
  groupsInCommon,
  hasActiveCall,
  i18n,
  isAdmin,
  isGroup,
  leaveGroup,
  loadRecentMediaItems,
  memberships,
  maxGroupSize,
  maxRecommendedGroupSize,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  pendingApprovalMemberships,
  pendingMemberships,
  pushPanelForConversation,
  renderChooseGroupMembersModal,
  renderConfirmAdditionsModal,
  replaceAvatar,
  saveAvatarToDisk,
  searchInConversation,
  setDisappearingMessages,
  setMuteExpiration,
  showContactModal,
  showConversation,
  showLightboxWithMedia,
  theme,
  toggleSafetyNumberModal,
  toggleAddUserToAnotherGroupModal,
  updateGroupAttributes,
  userAvatarData,
}: Props): JSX.Element {
  const [modalState, setModalState] = useState<ModalState>(
    ModalState.NothingOpen
  );
  const [editGroupAttributesRequestState, setEditGroupAttributesRequestState] =
    useState<RequestState>(RequestState.Inactive);
  const [addGroupMembersRequestState, setAddGroupMembersRequestState] =
    useState<RequestState>(RequestState.Inactive);

  if (conversation === undefined) {
    throw new Error('ConversationDetails rendered without a conversation');
  }

  useEffect(() => {
    getProfilesForConversation(conversation.id);
  }, [conversation.id, getProfilesForConversation]);

  const invitesCount =
    pendingMemberships.length + pendingApprovalMemberships.length;

  const otherMemberships = memberships.filter(({ member }) => !member.isMe);
  const isJustMe = otherMemberships.length === 0;
  const isAnyoneElseAnAdmin = otherMemberships.some(
    membership => membership.isAdmin
  );
  const cannotLeaveBecauseYouAreLastAdmin =
    isAdmin && !isJustMe && !isAnyoneElseAnAdmin;

  let modalNode: ReactNode;
  switch (modalState) {
    case ModalState.NothingOpen:
      modalNode = undefined;
      break;
    case ModalState.EditingGroupDescription:
    case ModalState.EditingGroupTitle:
      modalNode = (
        <EditConversationAttributesModal
          avatarColor={conversation.color}
          avatarPath={conversation.avatarPath}
          conversationId={conversation.id}
          groupDescription={conversation.groupDescription}
          i18n={i18n}
          initiallyFocusDescription={
            modalState === ModalState.EditingGroupDescription
          }
          makeRequest={async (
            options: Readonly<{
              avatar?: undefined | Uint8Array;
              description?: string;
              title?: string;
            }>
          ) => {
            setEditGroupAttributesRequestState(RequestState.Active);

            updateGroupAttributes(conversation.id, options, {
              onSuccess: () => {
                setModalState(ModalState.NothingOpen);
                setEditGroupAttributesRequestState(RequestState.Inactive);
              },
              onFailure: () => {
                setEditGroupAttributesRequestState(
                  RequestState.InactiveWithError
                );
              },
            });
          }}
          onClose={() => {
            setModalState(ModalState.NothingOpen);
            setEditGroupAttributesRequestState(RequestState.Inactive);
          }}
          requestState={editGroupAttributesRequestState}
          title={conversation.title}
          deleteAvatarFromDisk={deleteAvatarFromDisk}
          replaceAvatar={replaceAvatar}
          saveAvatarToDisk={saveAvatarToDisk}
          userAvatarData={userAvatarData}
        />
      );
      break;
    case ModalState.AddingGroupMembers:
      modalNode = (
        <AddGroupMembersModal
          renderChooseGroupMembersModal={renderChooseGroupMembersModal}
          renderConfirmAdditionsModal={renderConfirmAdditionsModal}
          clearRequestError={() => {
            setAddGroupMembersRequestState(oldRequestState => {
              assertDev(
                oldRequestState !== RequestState.Active,
                'Should not be clearing an active request state'
              );
              return RequestState.Inactive;
            });
          }}
          conversationIdsAlreadyInGroup={
            new Set(memberships.map(membership => membership.member.id))
          }
          groupTitle={conversation.title}
          i18n={i18n}
          makeRequest={async conversationIds => {
            setAddGroupMembersRequestState(RequestState.Active);

            addMembersToGroup(conversation.id, conversationIds, {
              onSuccess: () => {
                setModalState(ModalState.NothingOpen);
                setAddGroupMembersRequestState(RequestState.Inactive);
              },
              onFailure: () => {
                setAddGroupMembersRequestState(RequestState.InactiveWithError);
              },
            });
          }}
          maxGroupSize={maxGroupSize}
          maxRecommendedGroupSize={maxRecommendedGroupSize}
          onClose={() => {
            setModalState(ModalState.NothingOpen);
            setEditGroupAttributesRequestState(RequestState.Inactive);
          }}
          requestState={addGroupMembersRequestState}
        />
      );
      break;
    case ModalState.MuteNotifications:
      modalNode = (
        <ConversationNotificationsModal
          i18n={i18n}
          id={conversation.id}
          muteExpiresAt={conversation.muteExpiresAt}
          onClose={() => {
            setModalState(ModalState.NothingOpen);
          }}
          setMuteExpiration={setMuteExpiration}
        />
      );
      break;
    case ModalState.UnmuteNotifications:
      modalNode = (
        <ConfirmationDialog
          dialogName="ConversationDetails.unmuteNotifications"
          actions={[
            {
              action: () => setMuteExpiration(conversation.id, 0),
              style: 'affirmative',
              text: i18n('unmute'),
            },
          ]}
          hasXButton
          i18n={i18n}
          title={i18n('ConversationDetails__unmute--title')}
          onClose={() => {
            setModalState(ModalState.NothingOpen);
          }}
        >
          {getMutedUntilText(Number(conversation.muteExpiresAt), i18n)}
        </ConfirmationDialog>
      );
      break;
    default:
      throw missingCaseError(modalState);
  }

  const isMuted = isConversationMuted(conversation);

  return (
    <div className="conversation-details-panel">
      <ConversationDetailsHeader
        areWeASubscriber={areWeASubscriber}
        badges={badges}
        canEdit={canEditGroupInfo}
        conversation={conversation}
        i18n={i18n}
        isMe={conversation.isMe}
        isGroup={isGroup}
        memberships={memberships}
        startEditing={(isGroupTitle: boolean) => {
          setModalState(
            isGroupTitle
              ? ModalState.EditingGroupTitle
              : ModalState.EditingGroupDescription
          );
        }}
        theme={theme}
      />

      <div className="ConversationDetails__header-buttons">
        {!conversation.isMe && (
          <>
            <ConversationDetailsCallButton
              disabled={hasActiveCall}
              i18n={i18n}
              onClick={() => onOutgoingVideoCallInConversation(conversation.id)}
              type="video"
            />
            {!isGroup && (
              <ConversationDetailsCallButton
                disabled={hasActiveCall}
                i18n={i18n}
                onClick={() =>
                  onOutgoingAudioCallInConversation(conversation.id)
                }
                type="audio"
              />
            )}
          </>
        )}
        <Button
          icon={isMuted ? ButtonIconType.muted : ButtonIconType.unmuted}
          onClick={() => {
            if (isMuted) {
              setModalState(ModalState.UnmuteNotifications);
            } else {
              setModalState(ModalState.MuteNotifications);
            }
          }}
          variant={ButtonVariant.Details}
        >
          {isMuted ? i18n('unmute') : i18n('mute')}
        </Button>
        <Button
          icon={ButtonIconType.search}
          onClick={() => {
            searchInConversation(conversation.id);
          }}
          variant={ButtonVariant.Details}
        >
          {i18n('search')}
        </Button>
      </div>

      <PanelSection>
        {!isGroup || canEditGroupInfo ? (
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n(
                  'ConversationDetails--disappearing-messages-label'
                )}
                icon={IconType.timer}
              />
            }
            info={
              isGroup
                ? i18n('ConversationDetails--disappearing-messages-info--group')
                : i18n(
                    'ConversationDetails--disappearing-messages-info--direct'
                  )
            }
            label={i18n('ConversationDetails--disappearing-messages-label')}
            right={
              <DisappearingTimerSelect
                i18n={i18n}
                value={conversation.expireTimer || DurationInSeconds.ZERO}
                onChange={value =>
                  setDisappearingMessages(conversation.id, value)
                }
              />
            }
          />
        ) : null}
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('showChatColorEditor')}
              icon={IconType.color}
            />
          }
          label={i18n('showChatColorEditor')}
          onClick={() => {
            pushPanelForConversation({
              type: PanelType.ChatColorEditor,
            });
          }}
          right={
            <div
              className={`ConversationDetails__chat-color ConversationDetails__chat-color--${conversation.conversationColor}`}
              style={{
                ...getCustomColorStyle(conversation.customColor),
              }}
            />
          }
        />
        {isGroup && (
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('ConversationDetails--notifications')}
                icon={IconType.notifications}
              />
            }
            label={i18n('ConversationDetails--notifications')}
            onClick={() =>
              pushPanelForConversation({
                type: PanelType.NotificationSettings,
              })
            }
            right={
              conversation.muteExpiresAt
                ? getMutedUntilText(conversation.muteExpiresAt, i18n)
                : undefined
            }
          />
        )}
        {!isGroup && !conversation.isMe && (
          <PanelRow
            onClick={() => toggleSafetyNumberModal(conversation.id)}
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('verifyNewNumber')}
                icon={IconType.verify}
              />
            }
            label={
              <div className="ConversationDetails__safety-number">
                {i18n('verifyNewNumber')}
              </div>
            }
          />
        )}
      </PanelSection>

      {isGroup && (
        <ConversationDetailsMembershipList
          canAddNewMembers={canAddNewMembers}
          conversationId={conversation.id}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          memberships={memberships}
          showContactModal={showContactModal}
          startAddingNewMembers={() => {
            setModalState(ModalState.AddingGroupMembers);
          }}
          theme={theme}
        />
      )}

      {isGroup && (
        <PanelSection>
          {isAdmin || hasGroupLink ? (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('ConversationDetails--group-link')}
                  icon={IconType.link}
                />
              }
              label={i18n('ConversationDetails--group-link')}
              onClick={() =>
                pushPanelForConversation({
                  type: PanelType.GroupLinkManagement,
                })
              }
              right={hasGroupLink ? i18n('on') : i18n('off')}
            />
          ) : null}
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('ConversationDetails--requests-and-invites')}
                icon={IconType.invites}
              />
            }
            label={i18n('ConversationDetails--requests-and-invites')}
            onClick={() =>
              pushPanelForConversation({
                type: PanelType.GroupInvites,
              })
            }
            right={invitesCount}
          />
          {isAdmin ? (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('permissions')}
                  icon={IconType.lock}
                />
              }
              label={i18n('permissions')}
              onClick={() =>
                pushPanelForConversation({
                  type: PanelType.GroupPermissions,
                })
              }
            />
          ) : null}
        </PanelSection>
      )}

      <ConversationDetailsMediaList
        conversation={conversation}
        i18n={i18n}
        loadRecentMediaItems={loadRecentMediaItems}
        showAllMedia={() =>
          pushPanelForConversation({
            type: PanelType.AllMedia,
          })
        }
        showLightboxWithMedia={showLightboxWithMedia}
      />

      {!isGroup && !conversation.isMe && (
        <ConversationDetailsGroups
          contactId={conversation.id}
          i18n={i18n}
          groupsInCommon={groupsInCommon}
          toggleAddUserToAnotherGroupModal={toggleAddUserToAnotherGroupModal}
          showConversation={showConversation}
        />
      )}

      {!conversation.isMe && (
        <ConversationDetailsActions
          acceptConversation={acceptConversation}
          blockConversation={blockConversation}
          cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
          conversationId={conversation.id}
          conversationTitle={conversation.title}
          i18n={i18n}
          isBlocked={Boolean(conversation.isBlocked)}
          isGroup={isGroup}
          left={Boolean(conversation.left)}
          onLeave={() => leaveGroup(conversation.id)}
        />
      )}

      {modalNode}
    </div>
  );
}

function ConversationDetailsCallButton({
  disabled,
  i18n,
  onClick,
  type,
}: Readonly<{
  disabled: boolean;
  i18n: LocalizerType;
  onClick: () => unknown;
  type: 'audio' | 'video';
}>) {
  const button = (
    <Button
      disabled={disabled}
      icon={ButtonIconType[type]}
      onClick={onClick}
      variant={ButtonVariant.Details}
    >
      {/* eslint-disable-next-line local-rules/valid-i18n-keys */}
      {i18n(type)}
    </Button>
  );

  if (disabled) {
    return (
      <Tooltip content={i18n('calling__in-another-call-tooltip')}>
        {button}
      </Tooltip>
    );
  }

  return button;
}
