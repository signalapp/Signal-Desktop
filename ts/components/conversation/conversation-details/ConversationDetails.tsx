// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, ReactNode } from 'react';

import { ConversationType } from '../../../state/ducks/conversations';
import { assert } from '../../../util/assert';
import * as expirationTimer from '../../../util/expirationTimer';

import { LocalizerType } from '../../../types/Util';
import { MediaItemType } from '../../LightboxGallery';
import { missingCaseError } from '../../../util/missingCaseError';

import { Select } from '../../Select';

import { DisappearingTimeDialog } from '../DisappearingTimeDialog';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { AddGroupMembersModal } from './AddGroupMembersModal';
import { ConversationDetailsActions } from './ConversationDetailsActions';
import { ConversationDetailsHeader } from './ConversationDetailsHeader';
import { ConversationDetailsIcon } from './ConversationDetailsIcon';
import { ConversationDetailsMediaList } from './ConversationDetailsMediaList';
import {
  ConversationDetailsMembershipList,
  GroupV2Membership,
} from './ConversationDetailsMembershipList';
import {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from './PendingInvites';
import { EditConversationAttributesModal } from './EditConversationAttributesModal';
import { RequestState } from './util';
import { getCustomColorStyle } from '../../../util/getCustomColorStyle';

enum ModalState {
  NothingOpen,
  EditingGroupDescription,
  EditingGroupTitle,
  AddingGroupMembers,
  CustomDisappearingTimeout,
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
  memberships: Array<GroupV2Membership>;
  pendingApprovalMemberships: ReadonlyArray<GroupV2RequestingMembership>;
  pendingMemberships: ReadonlyArray<GroupV2PendingMembership>;
  setDisappearingMessages: (seconds: number) => void;
  showAllMedia: () => void;
  showContactModal: (conversationId: string) => void;
  showGroupChatColorEditor: () => void;
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
      description?: string;
      title?: string;
    }>
  ) => Promise<void>;
  onBlock: () => void;
  onLeave: () => void;
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
  memberships,
  pendingApprovalMemberships,
  pendingMemberships,
  setDisappearingMessages,
  showAllMedia,
  showContactModal,
  showGroupChatColorEditor,
  showGroupLinkManagement,
  showGroupV2Permissions,
  showPendingInvites,
  showLightboxForMedia,
  updateGroupAttributes,
  onBlock,
  onLeave,
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

  const updateExpireTimer = (value: string) => {
    const intValue = parseInt(value, 10);
    if (intValue === -1) {
      setModalState(ModalState.CustomDisappearingTimeout);
    } else {
      setDisappearingMessages(intValue);
    }
  };

  if (conversation === undefined) {
    throw new Error('ConversationDetails rendered without a conversation');
  }

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
          avatarPath={conversation.avatarPath}
          groupDescription={conversation.groupDescription}
          i18n={i18n}
          initiallyFocusDescription={
            modalState === ModalState.EditingGroupDescription
          }
          makeRequest={async (
            options: Readonly<{
              avatar?: undefined | ArrayBuffer;
              description?: string;
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
    case ModalState.CustomDisappearingTimeout:
      modalNode = (
        <DisappearingTimeDialog
          i18n={i18n}
          initialValue={conversation.expireTimer}
          onSubmit={value => {
            setModalState(ModalState.NothingOpen);
            setDisappearingMessages(value);
          }}
          onClose={() => setModalState(ModalState.NothingOpen)}
        />
      );
      break;
    default:
      throw missingCaseError(modalState);
  }

  const expireTimer: number = conversation.expireTimer || 0;

  let expirationTimerOptions: ReadonlyArray<{
    readonly value: number;
    readonly text: string;
  }> = expirationTimer.DEFAULT_DURATIONS_IN_SECONDS.map(seconds => {
    const text = expirationTimer.format(i18n, seconds, {
      capitalizeOff: true,
    });
    return {
      value: seconds,
      text,
    };
  });

  const isCustomTimeSelected = !expirationTimer.DEFAULT_DURATIONS_SET.has(
    expireTimer
  );

  // Custom time...
  expirationTimerOptions = [
    ...expirationTimerOptions,
    {
      value: -1,
      text: i18n(
        isCustomTimeSelected
          ? 'selectedCustomDisappearingTimeOption'
          : 'customDisappearingTimeOption'
      ),
    },
  ];

  return (
    <div className="conversation-details-panel">
      <ConversationDetailsHeader
        canEdit={canEditGroupInfo}
        conversation={conversation}
        i18n={i18n}
        memberships={memberships}
        startEditing={(isGroupTitle: boolean) => {
          setModalState(
            isGroupTitle
              ? ModalState.EditingGroupTitle
              : ModalState.EditingGroupDescription
          );
        }}
      />

      <PanelSection>
        {canEditGroupInfo ? (
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
              <Select
                onChange={updateExpireTimer}
                value={isCustomTimeSelected ? -1 : expireTimer}
                options={expirationTimerOptions}
              />
            }
            rightInfo={
              isCustomTimeSelected
                ? expirationTimer.format(i18n, expireTimer)
                : undefined
            }
          />
        ) : null}
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('showChatColorEditor')}
              icon="color"
            />
          }
          label={i18n('showChatColorEditor')}
          onClick={showGroupChatColorEditor}
          right={
            <div
              className={`module-conversation-details__chat-color module-conversation-details__chat-color--${conversation.conversationColor}`}
              style={{
                ...getCustomColorStyle(conversation.customColor),
              }}
            />
          }
        />
      </PanelSection>

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
        onLeave={onLeave}
        onBlock={onBlock}
      />

      {modalNode}
    </div>
  );
};
