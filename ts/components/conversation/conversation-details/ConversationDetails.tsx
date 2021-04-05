// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, ReactNode } from 'react';

import { ConversationType } from '../../../state/ducks/conversations';
import { assert } from '../../../util/assert';
import {
  ExpirationTimerOptions,
  TimerOption,
} from '../../../util/ExpirationTimerOptions';
import { LocalizerType } from '../../../types/Util';
import { MediaItemType } from '../../LightboxGallery';
import { missingCaseError } from '../../../util/missingCaseError';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { AddGroupMembersModal } from './AddGroupMembersModal';
import { ConversationDetailsActions } from './ConversationDetailsActions';
import { ConversationDetailsHeader } from './ConversationDetailsHeader';
import { ConversationDetailsIcon } from './ConversationDetailsIcon';
import { ConversationDetailsMediaList } from './ConversationDetailsMediaList';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList';
import { EditConversationAttributesModal } from './EditConversationAttributesModal';
import { RequestState } from './util';

enum ModalState {
  NothingOpen,
  EditingGroupAttributes,
  AddingGroupMembers,
}

export type StateProps = {
  addMembers: (conversationIds: ReadonlyArray<string>) => Promise<void>;
  canEditGroupInfo: boolean;
  candidateContactsToAdd: Array<ConversationType>;
  conversation?: ConversationType;
  hasGroupLink: boolean;
  i18n: LocalizerType;
  isAdmin: boolean;
  loadRecentMediaItems: (limit: number) => void;
  setDisappearingMessages: (seconds: number) => void;
  showAllMedia: () => void;
  showContactModal: (conversationId: string) => void;
  showGroupLinkManagement: () => void;
  showGroupV2Permissions: () => void;
  showPendingInvites: () => void;
  showLightboxForMedia: (
    selectedMediaItem: MediaItemType,
    media: Array<MediaItemType>
  ) => void;
  updateGroupAttributes: (
    _: Readonly<{
      avatar?: undefined | ArrayBuffer;
      title?: string;
    }>
  ) => Promise<void>;
  onBlockAndDelete: () => void;
  onDelete: () => void;
};

export type Props = StateProps;

export const ConversationDetails: React.ComponentType<Props> = ({
  addMembers,
  canEditGroupInfo,
  candidateContactsToAdd,
  conversation,
  hasGroupLink,
  i18n,
  isAdmin,
  loadRecentMediaItems,
  setDisappearingMessages,
  showAllMedia,
  showContactModal,
  showGroupLinkManagement,
  showGroupV2Permissions,
  showPendingInvites,
  showLightboxForMedia,
  updateGroupAttributes,
  onBlockAndDelete,
  onDelete,
}) => {
  const [modalState, setModalState] = useState<ModalState>(
    ModalState.NothingOpen
  );
  const [
    editGroupAttributesRequestState,
    setEditGroupAttributesRequestState,
  ] = useState<RequestState>(RequestState.Inactive);
  const [
    addGroupMembersRequestState,
    setAddGroupMembersRequestState,
  ] = useState<RequestState>(RequestState.Inactive);

  const updateExpireTimer = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setDisappearingMessages(parseInt(event.target.value, 10));
  };

  if (conversation === undefined) {
    throw new Error('ConversationDetails rendered without a conversation');
  }

  const memberships = conversation.memberships || [];
  const pendingMemberships = conversation.pendingMemberships || [];
  const pendingApprovalMemberships =
    conversation.pendingApprovalMemberships || [];
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
    case ModalState.EditingGroupAttributes:
      modalNode = (
        <EditConversationAttributesModal
          avatarPath={conversation.avatarPath}
          i18n={i18n}
          makeRequest={async (
            options: Readonly<{
              avatar?: undefined | ArrayBuffer;
              title?: string;
            }>
          ) => {
            setEditGroupAttributesRequestState(RequestState.Active);

            try {
              await updateGroupAttributes(options);
              setModalState(ModalState.NothingOpen);
              setEditGroupAttributesRequestState(RequestState.Inactive);
            } catch (err) {
              setEditGroupAttributesRequestState(
                RequestState.InactiveWithError
              );
            }
          }}
          onClose={() => {
            setModalState(ModalState.NothingOpen);
            setEditGroupAttributesRequestState(RequestState.Inactive);
          }}
          requestState={editGroupAttributesRequestState}
          title={conversation.title}
        />
      );
      break;
    case ModalState.AddingGroupMembers:
      modalNode = (
        <AddGroupMembersModal
          candidateContacts={candidateContactsToAdd}
          clearRequestError={() => {
            setAddGroupMembersRequestState(oldRequestState => {
              assert(
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

            try {
              await addMembers(conversationIds);
              setModalState(ModalState.NothingOpen);
              setAddGroupMembersRequestState(RequestState.Inactive);
            } catch (err) {
              setAddGroupMembersRequestState(RequestState.InactiveWithError);
            }
          }}
          onClose={() => {
            setModalState(ModalState.NothingOpen);
            setEditGroupAttributesRequestState(RequestState.Inactive);
          }}
          requestState={addGroupMembersRequestState}
        />
      );
      break;
    default:
      throw missingCaseError(modalState);
  }

  return (
    <div className="conversation-details-panel">
      <ConversationDetailsHeader
        canEdit={canEditGroupInfo}
        conversation={conversation}
        i18n={i18n}
        startEditing={() => {
          setModalState(ModalState.EditingGroupAttributes);
        }}
      />

      {canEditGroupInfo ? (
        <PanelSection>
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n(
                  'ConversationDetails--disappearing-messages-label'
                )}
                icon="timer"
              />
            }
            info={i18n('ConversationDetails--disappearing-messages-info')}
            label={i18n('ConversationDetails--disappearing-messages-label')}
            right={
              <div className="module-conversation-details-select">
                <select
                  onChange={updateExpireTimer}
                  value={conversation.expireTimer || 0}
                >
                  {ExpirationTimerOptions.map((item: typeof TimerOption) => (
                    <option
                      value={item.get('seconds')}
                      key={item.get('seconds')}
                      aria-label={item.getName(i18n)}
                    >
                      {item.getName(i18n)}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </PanelSection>
      ) : null}

      <ConversationDetailsMembershipList
        canAddNewMembers={canEditGroupInfo}
        i18n={i18n}
        memberships={memberships}
        showContactModal={showContactModal}
        startAddingNewMembers={() => {
          setModalState(ModalState.AddingGroupMembers);
        }}
      />

      <PanelSection>
        {isAdmin || hasGroupLink ? (
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('ConversationDetails--group-link')}
                icon="link"
              />
            }
            label={i18n('ConversationDetails--group-link')}
            onClick={showGroupLinkManagement}
            right={hasGroupLink ? i18n('on') : i18n('off')}
          />
        ) : null}
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('ConversationDetails--requests-and-invites')}
              icon="invites"
            />
          }
          label={i18n('ConversationDetails--requests-and-invites')}
          onClick={showPendingInvites}
          right={invitesCount}
        />
        {isAdmin ? (
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('permissions')}
                icon="lock"
              />
            }
            label={i18n('permissions')}
            onClick={showGroupV2Permissions}
          />
        ) : null}
      </PanelSection>

      <ConversationDetailsMediaList
        conversation={conversation}
        i18n={i18n}
        loadRecentMediaItems={loadRecentMediaItems}
        showAllMedia={showAllMedia}
        showLightboxForMedia={showLightboxForMedia}
      />

      <ConversationDetailsActions
        i18n={i18n}
        cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
        conversationTitle={conversation.title}
        onDelete={onDelete}
        onBlockAndDelete={onBlockAndDelete}
      />

      {modalNode}
    </div>
  );
};
