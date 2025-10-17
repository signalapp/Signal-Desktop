// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useState, useCallback } from 'react';

import { Button, ButtonIconType, ButtonVariant } from '../../Button.dom.js';
import type {
  ConversationType,
  PushPanelForConversationActionType,
  ShowConversationType,
} from '../../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.js';
import type { SmartChooseGroupMembersModalPropsType } from '../../../state/smart/ChooseGroupMembersModal.preload.js';
import type { SmartConfirmAdditionsModalPropsType } from '../../../state/smart/ConfirmAdditionsModal.dom.js';
import { assertDev } from '../../../util/assert.std.js';
import { getMutedUntilText } from '../../../util/getMutedUntilText.std.js';

import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type { BadgeType } from '../../../badges/types.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { DurationInSeconds } from '../../../util/durations/index.std.js';

import { DisappearingTimerSelect } from '../../DisappearingTimerSelect.dom.js';

import { PanelRow } from './PanelRow.dom.js';
import { PanelSection } from './PanelSection.dom.js';
import { AddGroupMembersModal } from './AddGroupMembersModal.dom.js';
import { ConversationDetailsActions } from './ConversationDetailsActions.dom.js';
import { ConversationDetailsHeader } from './ConversationDetailsHeader.dom.js';
import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.js';
import type { GroupV2Membership } from './ConversationDetailsMembershipList.dom.js';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList.dom.js';
import type {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from './PendingInvites.dom.js';
import { EditConversationAttributesModal } from './EditConversationAttributesModal.dom.js';
import { RequestState } from './util.std.js';
import { getCustomColorStyle } from '../../../util/getCustomColorStyle.dom.js';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.js';
import { ConfirmationDialog } from '../../ConfirmationDialog.dom.js';
import { ConversationNotificationsModal } from './ConversationNotificationsModal.dom.js';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../../types/Avatar.std.js';
import { isConversationMuted } from '../../../util/isConversationMuted.std.js';
import { ConversationDetailsGroups } from './ConversationDetailsGroups.dom.js';
import { PanelType } from '../../../types/Panels.std.js';
import { type CallHistoryGroup } from '../../../types/CallDisposition.std.js';
import { NavTab } from '../../../types/Nav.std.js';
import { ContextMenu } from '../../ContextMenu.dom.js';
import { canHaveNicknameAndNote } from '../../../util/nicknames.dom.js';
import { CallHistoryGroupPanelSection } from './CallHistoryGroupPanelSection.dom.js';
import {
  InAnotherCallTooltip,
  getTooltipContent,
} from '../InAnotherCallTooltip.dom.js';
import { BadgeSustainerInstructionsDialog } from '../../BadgeSustainerInstructionsDialog.dom.js';

enum ModalState {
  AddingGroupMembers,
  BecomeSustainer,
  ConfirmDeleteNicknameAndNote,
  EditingGroupDescription,
  EditingGroupTitle,
  MuteNotifications,
  NothingOpen,
  UnmuteNotifications,
}

export type StateProps = {
  areWeASubscriber: boolean;
  badges?: ReadonlyArray<BadgeType>;
  callHistoryGroup?: CallHistoryGroup | null;
  canEditGroupInfo: boolean;
  canAddNewMembers: boolean;
  conversation?: ConversationType;
  hasGroupLink: boolean;
  hasMedia: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasActiveCall: boolean;
  i18n: LocalizerType;
  isAdmin: boolean;
  isGroup: boolean;
  isSignalConversation: boolean;
  groupsInCommon: ReadonlyArray<ConversationType>;
  maxGroupSize: number;
  maxRecommendedGroupSize: number;
  memberships: ReadonlyArray<GroupV2Membership>;
  pendingApprovalMemberships: ReadonlyArray<GroupV2RequestingMembership>;
  pendingAvatarDownload?: boolean;
  pendingMemberships: ReadonlyArray<GroupV2PendingMembership>;
  selectedNavTab: NavTab;
  startAvatarDownload: () => void;
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
  onDeleteNicknameAndNote: () => void;
  onOpenEditNicknameAndNoteModal: () => void;
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
  toggleAboutContactModal: (contactId: string) => void;
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
};

export type Props = StateProps & ActionProps;

export function getCannotLeaveBecauseYouAreLastAdmin(
  memberships: ReadonlyArray<GroupV2Membership>,
  isAdmin: boolean
): boolean {
  const otherMemberships = memberships.filter(({ member }) => !member.isMe);
  const isJustMe = otherMemberships.length === 0;
  const isAnyoneElseAnAdmin = otherMemberships.some(
    membership => membership.isAdmin
  );
  const cannotLeaveBecauseYouAreLastAdmin =
    isAdmin && !isJustMe && !isAnyoneElseAnAdmin;
  return cannotLeaveBecauseYouAreLastAdmin;
}

export function ConversationDetails({
  acceptConversation,
  addMembersToGroup,
  areWeASubscriber,
  badges,
  blockConversation,
  callHistoryGroup,
  canEditGroupInfo,
  canAddNewMembers,
  conversation,
  deleteAvatarFromDisk,
  hasGroupLink,
  hasMedia,
  getPreferredBadge,
  getProfilesForConversation,
  groupsInCommon,
  hasActiveCall,
  i18n,
  isAdmin,
  isGroup,
  isSignalConversation,
  leaveGroup,
  memberships,
  maxGroupSize,
  maxRecommendedGroupSize,
  onDeleteNicknameAndNote,
  onOpenEditNicknameAndNoteModal,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  pendingApprovalMemberships,
  pendingAvatarDownload,
  pendingMemberships,
  pushPanelForConversation,
  renderChooseGroupMembersModal,
  renderConfirmAdditionsModal,
  replaceAvatar,
  saveAvatarToDisk,
  searchInConversation,
  selectedNavTab,
  setDisappearingMessages,
  setMuteExpiration,
  showContactModal,
  showConversation,
  startAvatarDownload,
  theme,
  toggleAboutContactModal,
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

  const cannotLeaveBecauseYouAreLastAdmin =
    getCannotLeaveBecauseYouAreLastAdmin(memberships, isAdmin);

  const onCloseModal = useCallback(() => {
    setModalState(ModalState.NothingOpen);
    setEditGroupAttributesRequestState(RequestState.Inactive);
  }, []);

  let modalNode: ReactNode;
  switch (modalState) {
    case ModalState.NothingOpen:
      modalNode = undefined;
      break;
    case ModalState.BecomeSustainer:
      modalNode = (
        <BadgeSustainerInstructionsDialog i18n={i18n} onClose={onCloseModal} />
      );
      break;
    case ModalState.EditingGroupDescription:
    case ModalState.EditingGroupTitle:
      modalNode = (
        <EditConversationAttributesModal
          avatarColor={conversation.color}
          avatarUrl={conversation.avatarUrl}
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
          onClose={onCloseModal}
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
          onClose={onCloseModal}
          requestState={addGroupMembersRequestState}
        />
      );
      break;
    case ModalState.ConfirmDeleteNicknameAndNote:
      modalNode = (
        <ConfirmationDialog
          dialogName="ConversationDetails.ConfirmDeleteNicknameAndNote"
          actions={[
            {
              action: onDeleteNicknameAndNote,
              style: 'negative',
              text: i18n('icu:delete'),
            },
          ]}
          hasXButton
          i18n={i18n}
          title={i18n(
            'icu:ConversationDetails__ConfirmDeleteNicknameAndNote__Title'
          )}
          onClose={onCloseModal}
        >
          {i18n(
            'icu:ConversationDetails__ConfirmDeleteNicknameAndNote__Description'
          )}
        </ConfirmationDialog>
      );
      break;
    case ModalState.MuteNotifications:
      modalNode = (
        <ConversationNotificationsModal
          i18n={i18n}
          id={conversation.id}
          muteExpiresAt={conversation.muteExpiresAt}
          onClose={onCloseModal}
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
              text: i18n('icu:unmute'),
            },
          ]}
          hasXButton
          i18n={i18n}
          title={i18n('icu:ConversationDetails__unmute--title')}
          onClose={onCloseModal}
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
        isSignalConversation={isSignalConversation}
        membersCount={conversation.membersCount ?? null}
        pendingAvatarDownload={pendingAvatarDownload ?? false}
        startAvatarDownload={startAvatarDownload}
        startEditing={(isGroupTitle: boolean) => {
          setModalState(
            isGroupTitle
              ? ModalState.EditingGroupTitle
              : ModalState.EditingGroupDescription
          );
        }}
        theme={theme}
        toggleAboutContactModal={toggleAboutContactModal}
      />

      <div className="ConversationDetails__header-buttons">
        {selectedNavTab === NavTab.Calls && (
          <Button
            icon={ButtonIconType.message}
            onClick={() => {
              showConversation({
                conversationId: conversation?.id,
                switchToAssociatedView: true,
              });
            }}
            variant={ButtonVariant.Details}
          >
            {i18n('icu:ConversationDetails__HeaderButton--Message')}
          </Button>
        )}
        {!conversation.isMe && !isSignalConversation && (
          <>
            <ConversationDetailsCallButton
              hasActiveCall={hasActiveCall}
              i18n={i18n}
              onClick={() => onOutgoingVideoCallInConversation(conversation.id)}
              type="video"
            />
            {!isGroup && (
              <ConversationDetailsCallButton
                hasActiveCall={hasActiveCall}
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
          {isMuted ? i18n('icu:unmute') : i18n('icu:mute')}
        </Button>
        {selectedNavTab !== NavTab.Calls && (
          <Button
            icon={ButtonIconType.search}
            onClick={() => {
              searchInConversation(conversation.id);
            }}
            variant={ButtonVariant.Details}
          >
            {i18n('icu:search')}
          </Button>
        )}
      </div>

      {isSignalConversation && (
        <>
          <PanelSection>
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationHero--signal-official-chat')}
                  icon={IconType.official}
                />
              }
              label={i18n('icu:ConversationHero--signal-official-chat')}
            />
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationHero--release-notes')}
                  icon={IconType.bell}
                />
              }
              label={i18n('icu:ConversationHero--release-notes')}
            />
          </PanelSection>

          <PanelSection title={i18n('icu:ConversationDetails--help-section')}>
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationDetails--support-center')}
                  icon={IconType.help}
                />
              }
              label={i18n('icu:ConversationDetails--support-center')}
              onClick={() => {
                openLinkInWebBrowser('https://support.signal.org');
              }}
            />
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:contactUs')}
                  icon={IconType.invite}
                />
              }
              label={i18n('icu:contactUs')}
              onClick={() => {
                openLinkInWebBrowser(
                  'https://support.signal.org/hc/requests/new?desktop'
                );
              }}
            />
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:BadgeDialog__become-a-sustainer-button')}
                  icon={IconType.heart}
                />
              }
              label={i18n('icu:BadgeDialog__become-a-sustainer-button')}
              onClick={() => setModalState(ModalState.BecomeSustainer)}
            />
          </PanelSection>
        </>
      )}

      {callHistoryGroup && (
        <CallHistoryGroupPanelSection
          callHistoryGroup={callHistoryGroup}
          i18n={i18n}
        />
      )}

      {!isSignalConversation && (
        <PanelSection>
          {!isGroup || canEditGroupInfo ? (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n(
                    'icu:ConversationDetails--disappearing-messages-label'
                  )}
                  icon={IconType.timer}
                />
              }
              info={
                isGroup
                  ? i18n(
                      'icu:ConversationDetails--disappearing-messages-info--group'
                    )
                  : i18n(
                      'icu:ConversationDetails--disappearing-messages-info--direct'
                    )
              }
              label={i18n(
                'icu:ConversationDetails--disappearing-messages-label'
              )}
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
          {canHaveNicknameAndNote(conversation) && (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationDetails--nickname-label')}
                  icon={IconType.edit}
                />
              }
              label={i18n('icu:ConversationDetails--nickname-label')}
              onClick={onOpenEditNicknameAndNoteModal}
              actions={
                (conversation.nicknameGivenName ||
                  conversation.nicknameFamilyName ||
                  conversation.note) && (
                  <ContextMenu
                    i18n={i18n}
                    portalToRoot
                    popperOptions={{
                      placement: 'bottom',
                      strategy: 'absolute',
                    }}
                    menuOptions={[
                      {
                        icon: 'ConversationDetails--nickname-actions--delete',
                        label: i18n(
                          'icu:ConversationDetails--nickname-actions--delete'
                        ),
                        onClick: () => {
                          setModalState(
                            ModalState.ConfirmDeleteNicknameAndNote
                          );
                        },
                      },
                    ]}
                  >
                    {({ onClick }) => {
                      return (
                        <button
                          type="button"
                          className="ConversationDetails--nickname-actions"
                          onClick={onClick}
                        >
                          <span className="ConversationDetails--nickname-actions-label">
                            {i18n('icu:ConversationDetails--nickname-actions')}
                          </span>
                        </button>
                      );
                    }}
                  </ContextMenu>
                )
              }
            />
          )}
          {selectedNavTab === NavTab.Chats && (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:showChatColorEditor')}
                  icon={IconType.color}
                />
              }
              label={i18n('icu:showChatColorEditor')}
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
          )}
          {isGroup && (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationDetails--notifications')}
                  icon={IconType.notifications}
                />
              }
              label={i18n('icu:ConversationDetails--notifications')}
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
          {hasMedia && (
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationDetailsMediaList--title')}
                  icon={IconType.media}
                />
              }
              label={i18n('icu:ConversationDetailsMediaList--title')}
              onClick={() => {
                pushPanelForConversation({
                  type: PanelType.AllMedia,
                });
              }}
            />
          )}
          {!isGroup && !conversation.isMe && (
            <PanelRow
              onClick={() => toggleSafetyNumberModal(conversation.id)}
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:ConversationDetails__viewSafetyNumber')}
                  icon={IconType.verify}
                />
              }
              label={
                <div className="ConversationDetails__safety-number">
                  {i18n('icu:ConversationDetails__viewSafetyNumber')}
                </div>
              }
            />
          )}
        </PanelSection>
      )}
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
                  ariaLabel={i18n('icu:ConversationDetails--group-link')}
                  icon={IconType.link}
                />
              }
              label={i18n('icu:ConversationDetails--group-link')}
              onClick={() =>
                pushPanelForConversation({
                  type: PanelType.GroupLinkManagement,
                })
              }
              right={hasGroupLink ? i18n('icu:on') : i18n('icu:off')}
            />
          ) : null}
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n(
                  'icu:ConversationDetails--requests-and-invites'
                )}
                icon={IconType.invites}
              />
            }
            label={i18n('icu:ConversationDetails--requests-and-invites')}
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
                  ariaLabel={i18n('icu:permissions')}
                  icon={IconType.lock}
                />
              }
              label={i18n('icu:permissions')}
              onClick={() =>
                pushPanelForConversation({
                  type: PanelType.GroupPermissions,
                })
              }
            />
          ) : null}
        </PanelSection>
      )}

      {!isGroup && !conversation.isMe && !isSignalConversation && (
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
  hasActiveCall,
  i18n,
  onClick,
  type,
}: Readonly<{
  hasActiveCall: boolean;
  i18n: LocalizerType;
  onClick: () => unknown;
  type: 'audio' | 'video';
}>) {
  const tooltipContent = hasActiveCall ? getTooltipContent(i18n) : undefined;
  const button = (
    <Button
      icon={ButtonIconType[type]}
      onClick={onClick}
      variant={ButtonVariant.Details}
      discouraged={hasActiveCall}
      aria-label={tooltipContent}
    >
      {type === 'audio' ? i18n('icu:audio') : i18n('icu:video')}
    </Button>
  );

  if (hasActiveCall) {
    return <InAnotherCallTooltip i18n={i18n}>{button}</InAnotherCallTooltip>;
  }

  return button;
}
