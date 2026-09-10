// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { MuteExpiration } from '@signalapp/types';

import type {
  ConversationType,
  PushPanelForConversationActionType,
  ShowConversationType,
  UpdateGroupAttributesType,
} from '../../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.ts';
import type { SmartChooseGroupMembersModalPropsType } from '../../../state/smart/ChooseGroupMembersModal.preload.tsx';
import type { SmartConfirmAdditionsModalPropsType } from '../../../state/smart/ConfirmAdditionsModal.dom.tsx';
import { getMutedUntilText } from '../../../util/getMutedUntilText.std.ts';

import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';
import type { BadgeType } from '../../../badges/types.std.ts';
import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import { DurationInSeconds } from '../../../util/durations/index.std.ts';

import { DisappearingTimerSelect } from '../../DisappearingTimerSelect.dom.tsx';

import { AddGroupMembersModal } from './AddGroupMembersModal.dom.tsx';
import { ConversationDetailsActions } from './ConversationDetailsActions.dom.tsx';
import { ConversationDetailsHeader } from './ConversationDetailsHeader.dom.tsx';
import type { GroupV2Membership } from './ConversationDetailsMembershipList.dom.tsx';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList.dom.tsx';
import type {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from './PendingInvites.dom.tsx';
import { EditConversationAttributesModal } from './EditConversationAttributesModal.dom.tsx';
import { RequestState } from './util.std.ts';
import { getCustomColorStyle } from '../../../util/getCustomColorStyle.dom.ts';
import { openLinkInWebBrowser } from '../../../util/openLinkInWebBrowser.dom.ts';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../../types/Avatar.std.ts';
import { isConversationMuted } from '../../../util/isConversationMuted.std.ts';
import { ConversationDetailsGroups } from './ConversationDetailsGroups.dom.tsx';
import { PanelType } from '../../../types/Panels.std.ts';
import { type CallHistoryGroup } from '../../../types/CallDisposition.std.ts';
import { NavTab } from '../../../types/Nav.std.ts';
import { canHaveNicknameAndNote } from '../../../util/nicknames.dom.ts';
import { CallHistoryGroupPanelSection } from './CallHistoryGroupPanelSection.dom.tsx';
import { InAnotherCallTooltip } from '../InAnotherCallTooltip.dom.tsx';
import type { ContactModalStateType } from '../../../types/globalModals.std.ts';
import type { ContactNameColorType } from '../../../types/Colors.std.ts';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { canConversationOnlyBeMutedAlways } from '../../../conversations/canConversationOnlyBeMutedAlways.dom.ts';
import { CONTACT_SUPPORT_URL } from '../../../util/contactSupport.dom.tsx';
import { AxoStackedButton } from '../../../axo/AxoStackedButton.dom.tsx';
import { getConversationMuteMenu } from '../../../util/getMuteOptions.std.ts';
import { MuteNotificationsDropdownMenu } from '../../MuteNotificationsMenu.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../../../axo/items/AxoClickableItem.dom.tsx';
import { AxoTextItem } from '../../../axo/items/AxoTextItem.dom.tsx';
import { AxoContainer } from '../../../axo/AxoContainer.dom.tsx';
import { AriaClickable } from '../../../axo/AriaClickable.dom.tsx';
import { AxoDropdownMenu } from '../../../axo/AxoDropdownMenu.dom.tsx';

enum ModalState {
  AddingGroupMembers,
  ConfirmDeleteNicknameAndNote,
  EditingGroupDescription,
  EditingGroupTitle,
  NothingOpen,
}

export type StateProps = {
  areWeASubscriber: boolean;
  badges?: ReadonlyArray<BadgeType>;
  callHistoryGroup?: CallHistoryGroup | null;
  canEditGroupInfo: boolean;
  canAddLabel: boolean;
  canAddNewMembers: boolean;
  conversation?: ConversationType;
  hasGroupLink: boolean;
  hasMedia: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasActiveCall: boolean;
  i18n: LocalizerType;
  isAdmin: boolean;
  isEditMemberLabelEnabled: boolean;
  isGroup: boolean;
  isSignalConversation: boolean;
  isTerminateGroupEnabled: boolean;
  groupsInCommon: ReadonlyArray<ConversationType>;
  maxGroupSize: number;
  maxRecommendedGroupSize: number;
  memberships: ReadonlyArray<GroupV2Membership>;
  memberColors: Map<string, ContactNameColorType>;
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
  onConversationArchive: () => void;
  onConversationDeleteMessages: () => void;
  onConversationUnarchive: () => void;
  onDeleteNicknameAndNote: () => void;
  onNavigateToDonate: () => void;
  onOpenEditNicknameAndNoteModal: () => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => unknown;
  onOutgoingVideoCallInConversation: (conversationId: string) => unknown;
  pushPanelForConversation: PushPanelForConversationActionType;
  replaceAvatar: ReplaceAvatarActionType;
  reportSpam: (id: string) => void;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  searchInConversation: (id: string) => unknown;
  setDisappearingMessages: (id: string, seconds: DurationInSeconds) => void;
  setMuteExpiration: (
    id: string,
    expiration: MuteExpiration | undefined
  ) => unknown;
  showContactModal: (payload: ContactModalStateType) => void;
  showConversation: ShowConversationType;
  terminateGroup: (conversationId: string) => void;
  toggleAboutContactModal: (options: ContactModalStateType) => void;
  toggleAddUserToAnotherGroupModal: (contactId?: string) => void;
  toggleSafetyNumberModal: (conversationId: string) => unknown;
  updateGroupAttributes: UpdateGroupAttributesType;
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
  canAddLabel,
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
  isEditMemberLabelEnabled,
  isGroup,
  isSignalConversation,
  isTerminateGroupEnabled,
  leaveGroup,
  memberships,
  memberColors,
  maxGroupSize,
  maxRecommendedGroupSize,
  onConversationArchive,
  onConversationDeleteMessages,
  onConversationUnarchive,
  onDeleteNicknameAndNote,
  onNavigateToDonate,
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
  reportSpam,
  saveAvatarToDisk,
  searchInConversation,
  selectedNavTab,
  setDisappearingMessages,
  setMuteExpiration,
  showContactModal,
  showConversation,
  startAvatarDownload,
  terminateGroup,
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

  const isGroupTerminated = Boolean(conversation.terminated);
  const canTerminateGroup =
    isTerminateGroupEnabled && !isGroupTerminated && isAdmin;

  const areWeMember = memberships.some(({ member }) => member.isMe);

  const onCloseModal = useCallback(() => {
    setModalState(ModalState.NothingOpen);
    setEditGroupAttributesRequestState(RequestState.Inactive);
  }, []);

  const muteMenu = useMemo(() => {
    return getConversationMuteMenu(conversation.muteExpiresAt, i18n, {
      canOnlyBeMutedAlways: canConversationOnlyBeMutedAlways(conversation),
    });
  }, [conversation, i18n]);

  const handleMuteExpiration = useCallback(
    (expiration: MuteExpiration) => {
      setMuteExpiration(conversation.id, expiration);
    },
    [setMuteExpiration, conversation.id]
  );

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
          avatarUrl={conversation.avatarUrl}
          conversationId={conversation.id}
          groupDescription={conversation.groupDescription}
          i18n={i18n}
          initiallyFocusDescription={
            modalState === ModalState.EditingGroupDescription
          }
          makeRequest={async (
            options: Readonly<{
              avatar?: undefined | Uint8Array<ArrayBuffer>;
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
            // This is called on close of the dialog, both on 'add member' and 'cancel'
            setAddGroupMembersRequestState(oldRequestState => {
              if (oldRequestState === RequestState.InactiveWithError) {
                return RequestState.Inactive;
              }
              return oldRequestState;
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
        <AxoConfirmDialog.Root
          open
          onOpenChange={onCloseModal}
          title={i18n(
            'icu:ConversationDetails__ConfirmDeleteNicknameAndNote__Title'
          )}
          description={i18n(
            'icu:ConversationDetails__ConfirmDeleteNicknameAndNote__Description'
          )}
        >
          <AxoConfirmDialog.Cancel />
          <AxoConfirmDialog.Action
            variant="strong-destructive"
            onClick={onDeleteNicknameAndNote}
          >
            {i18n('icu:delete')}
          </AxoConfirmDialog.Action>
        </AxoConfirmDialog.Root>
      );
      break;
    default:
      throw missingCaseError(modalState);
  }

  const isMuted = isConversationMuted(conversation);

  return (
    <AxoContainer.Root>
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
        onNavigateToDonate={onNavigateToDonate}
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
        <AxoStackedButton.Row spacing="md">
          {selectedNavTab === NavTab.Calls && (
            <AxoStackedButton.Root
              symbol="message"
              label={i18n('icu:ConversationDetails__HeaderButton--Message')}
              onClick={() => {
                showConversation({
                  conversationId: conversation?.id,
                  switchToAssociatedView: true,
                });
              }}
            />
          )}
          {!conversation.isMe && !isSignalConversation && (
            <>
              {!conversation.terminated && (
                <InAnotherCallTooltip i18n={i18n} inAnotherCall={hasActiveCall}>
                  <AxoStackedButton.Root
                    symbol="videocamera"
                    label={i18n('icu:video')}
                    discouraged={hasActiveCall}
                    onClick={() =>
                      onOutgoingVideoCallInConversation(conversation.id)
                    }
                  />
                </InAnotherCallTooltip>
              )}
              {!isGroup && (
                <InAnotherCallTooltip i18n={i18n} inAnotherCall={hasActiveCall}>
                  <AxoStackedButton.Root
                    symbol="phone"
                    label={i18n('icu:audio')}
                    discouraged={hasActiveCall}
                    onClick={() =>
                      onOutgoingAudioCallInConversation(conversation.id)
                    }
                  />
                </InAnotherCallTooltip>
              )}
            </>
          )}

          <MuteNotificationsDropdownMenu
            i18n={i18n}
            label={muteMenu.label}
            options={muteMenu.options}
            onMuteExpiration={handleMuteExpiration}
          >
            <AxoStackedButton.Root
              symbol={isMuted ? 'bell-slash' : 'bell'}
              label={isMuted ? i18n('icu:unmute') : i18n('icu:mute')}
            />
          </MuteNotificationsDropdownMenu>

          {selectedNavTab !== NavTab.Calls && (
            <AxoStackedButton.Root
              symbol="search"
              label={i18n('icu:search')}
              onClick={() => {
                searchInConversation(conversation.id);
              }}
            />
          )}
        </AxoStackedButton.Row>
      </div>

      <AxoList.Group>
        {isSignalConversation && (
          <>
            <List>
              <AxoTextItem.Root
                symbol="officialbadge"
                label={i18n('icu:ConversationHero--signal-official-chat')}
              />
              <AxoTextItem.Root
                symbol="bell"
                label={i18n('icu:ConversationHero--release-notes')}
              />
            </List>

            <List label={i18n('icu:ConversationDetails--help-section')}>
              <AxoClickableItem.Root
                symbol="help-circle"
                label={i18n('icu:ConversationDetails--support-center')}
                arrow="external-link"
                onClick={() => {
                  openLinkInWebBrowser('https://support.signal.org');
                }}
              />
              <AxoClickableItem.Root
                symbol="invite"
                label={i18n('icu:contactUs')}
                arrow="external-link"
                onClick={() => {
                  openLinkInWebBrowser(CONTACT_SUPPORT_URL);
                }}
              />
              <AxoClickableItem.Root
                symbol="heart"
                label={i18n('icu:BadgeDialog__become-a-sustainer-button')}
                onClick={onNavigateToDonate}
              />
            </List>
          </>
        )}

        {callHistoryGroup && (
          <CallHistoryGroupPanelSection
            callHistoryGroup={callHistoryGroup}
            i18n={i18n}
          />
        )}

        {!isSignalConversation && (
          <List>
            {(!isGroup ||
              canEditGroupInfo ||
              conversation.expireTimer != null) && (
              <AxoItem.Root>
                <AxoItem.Leading>
                  <AxoItem.Icon symbol="timer-slash" />
                </AxoItem.Leading>
                <AxoItem.Content>
                  <AxoItem.Body>
                    <AxoItem.Label>
                      {i18n(
                        'icu:ConversationDetails--disappearing-messages-label'
                      )}
                    </AxoItem.Label>
                    <AxoItem.Description>
                      {isGroup
                        ? i18n(
                            'icu:ConversationDetails--disappearing-messages-info--group'
                          )
                        : i18n(
                            'icu:ConversationDetails--disappearing-messages-info--direct'
                          )}
                    </AxoItem.Description>
                    <AxoItem.Accessory>
                      <DisappearingTimerSelect
                        i18n={i18n}
                        value={
                          conversation.expireTimer || DurationInSeconds.ZERO
                        }
                        disabled={
                          isGroup &&
                          (!canEditGroupInfo || conversation.terminated)
                        }
                        onChange={value =>
                          setDisappearingMessages(conversation.id, value)
                        }
                      />
                    </AxoItem.Accessory>
                  </AxoItem.Body>
                </AxoItem.Content>
              </AxoItem.Root>
            )}
            {canHaveNicknameAndNote(conversation) && (
              <AxoClickableItem.Root
                symbol="pencil"
                label={i18n('icu:ConversationDetails--nickname-label')}
                onClick={onOpenEditNicknameAndNoteModal}
                accessory={
                  <AriaClickable.DeadArea>
                    <AxoDropdownMenu.Root>
                      <AxoDropdownMenu.Trigger>
                        <AxoItem.IconAction
                          variant="implied-secondary"
                          symbol="more"
                          label={i18n(
                            'icu:ConversationDetails--nickname-actions'
                          )}
                        />
                      </AxoDropdownMenu.Trigger>
                      <AxoDropdownMenu.Content>
                        <AxoDropdownMenu.Item
                          symbol="trash"
                          onSelect={() => {
                            setModalState(
                              ModalState.ConfirmDeleteNicknameAndNote
                            );
                          }}
                        >
                          {i18n(
                            'icu:ConversationDetails--nickname-actions--delete'
                          )}
                        </AxoDropdownMenu.Item>
                      </AxoDropdownMenu.Content>
                    </AxoDropdownMenu.Root>
                  </AriaClickable.DeadArea>
                }
              />
            )}
            {selectedNavTab === NavTab.Chats && (
              <AxoClickableItem.Root
                symbol="palette"
                label={i18n('icu:showChatColorEditor')}
                onClick={() => {
                  pushPanelForConversation({
                    type: PanelType.ChatColorEditor,
                  });
                }}
                accessory={
                  <div
                    className={`ConversationDetails__chat-color ConversationDetails__chat-color--${conversation.conversationColor}`}
                    style={{
                      ...getCustomColorStyle(conversation.customColor),
                    }}
                  />
                }
              />
            )}
            <AxoClickableItem.Root
              symbol="bell"
              label={i18n('icu:ConversationDetails--notifications')}
              onClick={() =>
                pushPanelForConversation({
                  type: PanelType.NotificationSettings,
                })
              }
              value={
                conversation.muteExpiresAt
                  ? getMutedUntilText(conversation.muteExpiresAt, i18n)
                  : null
              }
            />
            {hasMedia && (
              <AxoClickableItem.Root
                symbol="album"
                label={i18n('icu:ConversationDetailsMediaList--title')}
                onClick={() => {
                  pushPanelForConversation({
                    type: PanelType.AllMedia,
                  });
                }}
              />
            )}
            {!isGroup && !conversation.isMe && (
              <AxoClickableItem.Root
                symbol="shield-check"
                label={i18n('icu:ConversationDetails__viewSafetyNumber')}
                onClick={() => toggleSafetyNumberModal(conversation.id)}
              />
            )}
          </List>
        )}
        {isGroup && (
          <ConversationDetailsMembershipList
            canAddLabel={canAddLabel}
            canAddNewMembers={canAddNewMembers}
            canInviteViaGroupLink={hasGroupLink}
            groupLink={conversation.groupLink ?? null}
            conversationId={conversation.id}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            isEditMemberLabelEnabled={isEditMemberLabelEnabled}
            isTerminated={isGroupTerminated}
            memberships={memberships}
            memberColors={memberColors}
            showContactModal={showContactModal}
            showLabelEditor={() => {
              pushPanelForConversation({
                type: PanelType.GroupMemberLabelEditor,
              });
            }}
            startAddingNewMembers={() => {
              setModalState(ModalState.AddingGroupMembers);
            }}
            hasOtherModalOpen={modalState !== ModalState.NothingOpen}
            theme={theme}
          />
        )}

        {isGroup && !isGroupTerminated && (
          <List>
            {(isAdmin || hasGroupLink) && (
              <AxoClickableItem.Root
                symbol="link"
                label={i18n('icu:ConversationDetails--group-link')}
                value={hasGroupLink ? i18n('icu:on') : i18n('icu:off')}
                onClick={() => {
                  pushPanelForConversation({
                    type: PanelType.GroupLinkManagement,
                  });
                }}
              />
            )}
            {isEditMemberLabelEnabled && areWeMember && (
              <AxoClickableItem.Root
                symbol="label"
                disabled={!canAddLabel}
                label={i18n('icu:ConversationDetails--member-label')}
                tooltip={
                  !canAddLabel
                    ? i18n('icu:ToastManager__CannotAddMemberLabel')
                    : null
                }
                onClick={() => {
                  pushPanelForConversation({
                    type: PanelType.GroupMemberLabelEditor,
                  });
                }}
              />
            )}
            <AxoClickableItem.Root
              symbol="group"
              label={i18n('icu:ConversationDetails--requests-and-invites')}
              value={invitesCount}
              onClick={() =>
                pushPanelForConversation({
                  type: PanelType.GroupInvites,
                })
              }
            />
            {isAdmin && (
              <AxoClickableItem.Root
                symbol="key"
                label={i18n('icu:permissions')}
                onClick={() =>
                  pushPanelForConversation({
                    type: PanelType.GroupPermissions,
                  })
                }
              />
            )}
          </List>
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
            cannotLeaveBecauseYouAreLastAdmin={
              cannotLeaveBecauseYouAreLastAdmin
            }
            canTerminateGroup={canTerminateGroup}
            conversationId={conversation.id}
            conversationTitle={conversation.title}
            i18n={i18n}
            isArchived={Boolean(conversation.isArchived)}
            isBlocked={Boolean(conversation.isBlocked)}
            isGroup={isGroup}
            isGroupTerminated={isGroupTerminated}
            isSignalConversation={isSignalConversation}
            left={Boolean(conversation.left)}
            onArchive={onConversationArchive}
            onDelete={onConversationDeleteMessages}
            onUnarchive={onConversationUnarchive}
            onLeave={() => leaveGroup(conversation.id)}
            onReportSpam={() => reportSpam(conversation.id)}
            onReportSpamAndBlock={() => {
              reportSpam(conversation.id);
              blockConversation(conversation.id);
            }}
            onTerminateGroup={() => terminateGroup(conversation.id)}
          />
        )}
      </AxoList.Group>

      {modalNode}
    </AxoContainer.Root>
  );
}

type ListProps = Readonly<{
  label?: string;
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
    </AxoList.Root>
  );
}
