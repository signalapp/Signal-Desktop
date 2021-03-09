// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { ConversationType } from '../../../state/ducks/conversations';
import {
  ExpirationTimerOptions,
  TimerOption,
} from '../../../util/ExpirationTimerOptions';
import { LocalizerType } from '../../../types/Util';
import { MediaItemType } from '../../LightboxGallery';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { ConversationDetailsActions } from './ConversationDetailsActions';
import { ConversationDetailsHeader } from './ConversationDetailsHeader';
import { ConversationDetailsIcon } from './ConversationDetailsIcon';
import { ConversationDetailsMediaList } from './ConversationDetailsMediaList';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList';
import {
  EditConversationAttributesModal,
  RequestState as EditGroupAttributesRequestState,
} from './EditConversationAttributesModal';

export type StateProps = {
  canEditGroupInfo: boolean;
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
  ) => void;
  onBlockAndDelete: () => void;
  onDelete: () => void;
};

export type Props = StateProps;

export const ConversationDetails: React.ComponentType<Props> = ({
  canEditGroupInfo,
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
  const [isEditingGroupAttributes, setIsEditingGroupAttributes] = useState(
    false
  );
  const [
    editGroupAttributesRequestState,
    setEditGroupAttributesRequestState,
  ] = useState<EditGroupAttributesRequestState>(
    EditGroupAttributesRequestState.Inactive
  );

  const updateExpireTimer = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setDisappearingMessages(parseInt(event.target.value, 10));
  };

  if (conversation === undefined) {
    throw new Error('ConversationDetails rendered without a conversation');
  }

  const pendingMemberships = conversation.pendingMemberships || [];
  const pendingApprovalMemberships =
    conversation.pendingApprovalMemberships || [];
  const invitesCount =
    pendingMemberships.length + pendingApprovalMemberships.length;

  return (
    <div className="conversation-details-panel">
      <ConversationDetailsHeader
        canEdit={canEditGroupInfo}
        conversation={conversation}
        i18n={i18n}
        startEditing={() => {
          setIsEditingGroupAttributes(true);
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
        i18n={i18n}
        showContactModal={showContactModal}
        memberships={conversation.memberships || []}
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
        conversationTitle={conversation.title}
        onDelete={onDelete}
        onBlockAndDelete={onBlockAndDelete}
      />

      {isEditingGroupAttributes && (
        <EditConversationAttributesModal
          avatarPath={conversation.avatarPath}
          i18n={i18n}
          makeRequest={async (
            options: Readonly<{
              avatar?: undefined | ArrayBuffer;
              title?: string;
            }>
          ) => {
            setEditGroupAttributesRequestState(
              EditGroupAttributesRequestState.Active
            );

            try {
              await updateGroupAttributes(options);
              setIsEditingGroupAttributes(false);
              setEditGroupAttributesRequestState(
                EditGroupAttributesRequestState.Inactive
              );
            } catch (err) {
              setEditGroupAttributesRequestState(
                EditGroupAttributesRequestState.InactiveWithError
              );
            }
          }}
          onClose={() => {
            setIsEditingGroupAttributes(false);
            setEditGroupAttributesRequestState(
              EditGroupAttributesRequestState.Inactive
            );
          }}
          requestState={editGroupAttributesRequestState}
          title={conversation.title}
        />
      )}
    </div>
  );
};
