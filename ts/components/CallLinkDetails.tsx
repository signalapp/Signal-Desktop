// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { CallHistoryGroup } from '../types/CallDisposition';
import type { LocalizerType } from '../types/I18N';
import { CallHistoryGroupPanelSection } from './conversation/conversation-details/CallHistoryGroupPanelSection';
import { PanelSection } from './conversation/conversation-details/PanelSection';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation/conversation-details/ConversationDetailsIcon';
import { PanelRow } from './conversation/conversation-details/PanelRow';
import type { CallLinkRestrictions, CallLinkType } from '../types/CallLink';
import { linkCallRoute } from '../util/signalRoutes';
import { drop } from '../util/drop';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { copyCallLink } from '../util/copyLinksWithToast';
import { getColorForCallLink } from '../util/getColorForCallLink';
import { isCallLinkAdmin } from '../types/CallLink';
import { CallLinkRestrictionsSelect } from './CallLinkRestrictionsSelect';
import { ConfirmationDialog } from './ConfirmationDialog';
import { InAnotherCallTooltip } from './conversation/InAnotherCallTooltip';

function toUrlWithoutProtocol(url: URL): string {
  return `${url.hostname}${url.pathname}${url.search}${url.hash}`;
}

export type CallLinkDetailsProps = Readonly<{
  callHistoryGroup: CallHistoryGroup;
  callLink: CallLinkType;
  hasActiveCall: boolean;
  i18n: LocalizerType;
  onDeleteCallLink: () => void;
  onOpenCallLinkAddNameModal: () => void;
  onStartCallLinkLobby: () => void;
  onShareCallLinkViaSignal: () => void;
  onUpdateCallLinkRestrictions: (restrictions: CallLinkRestrictions) => void;
}>;

export function CallLinkDetails({
  callHistoryGroup,
  callLink,
  i18n,
  hasActiveCall,
  onDeleteCallLink,
  onOpenCallLinkAddNameModal,
  onStartCallLinkLobby,
  onShareCallLinkViaSignal,
  onUpdateCallLinkRestrictions,
}: CallLinkDetailsProps): JSX.Element {
  const [isDeleteCallLinkModalOpen, setIsDeleteCallLinkModalOpen] =
    useState(false);
  const webUrl = linkCallRoute.toWebUrl({
    key: callLink.rootKey,
  });
  const joinButton = (
    <Button
      className="CallLinkDetails__HeaderButton"
      variant={ButtonVariant.SecondaryAffirmative}
      discouraged={hasActiveCall}
      size={ButtonSize.Small}
      onClick={onStartCallLinkLobby}
    >
      {i18n('icu:CallLinkDetails__Join')}
    </Button>
  );

  return (
    <div className="CallLinkDetails__Container">
      <header className="CallLinkDetails__Header">
        <Avatar
          className="CallLinkDetails__HeaderAvatar"
          i18n={i18n}
          badge={undefined}
          color={getColorForCallLink(callLink.rootKey)}
          conversationType="callLink"
          size={AvatarSize.SIXTY_FOUR}
          acceptedMessageRequest
          isMe={false}
          sharedGroupNames={[]}
          title={callLink.name ?? i18n('icu:calling__call-link-default-title')}
        />
        <div className="CallLinkDetails__HeaderDetails">
          <h1 className="CallLinkDetails__HeaderTitle">
            {callLink.name === ''
              ? i18n('icu:calling__call-link-default-title')
              : callLink.name}
          </h1>
          <p className="CallLinkDetails__HeaderDescription">
            {toUrlWithoutProtocol(webUrl)}
          </p>
        </div>
        <div className="CallLinkDetails__HeaderActions">
          {hasActiveCall ? (
            <InAnotherCallTooltip i18n={i18n}>
              {joinButton}
            </InAnotherCallTooltip>
          ) : (
            joinButton
          )}
        </div>
      </header>
      <CallHistoryGroupPanelSection
        callHistoryGroup={callHistoryGroup}
        i18n={i18n}
      />
      {isCallLinkAdmin(callLink) && (
        <PanelSection>
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('icu:CallLinkDetails__AddCallNameLabel')}
                icon={IconType.edit}
              />
            }
            label={
              callLink.name === ''
                ? i18n('icu:CallLinkDetails__AddCallNameLabel')
                : i18n('icu:CallLinkDetails__EditCallNameLabel')
            }
            onClick={onOpenCallLinkAddNameModal}
          />
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('icu:CallLinkDetails__ApproveAllMembersLabel')}
                icon={IconType.approveAllMembers}
              />
            }
            label={i18n('icu:CallLinkDetails__ApproveAllMembersLabel')}
            right={
              <CallLinkRestrictionsSelect
                i18n={i18n}
                value={callLink.restrictions}
                onChange={onUpdateCallLinkRestrictions}
              />
            }
          />
        </PanelSection>
      )}
      <PanelSection>
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('icu:CallLinkDetails__CopyLink')}
              icon={IconType.share}
            />
          }
          label={i18n('icu:CallLinkDetails__CopyLink')}
          onClick={() => {
            drop(copyCallLink(webUrl.toString()));
          }}
        />
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('icu:CallLinkDetails__ShareLinkViaSignal')}
              icon={IconType.forward}
            />
          }
          label={i18n('icu:CallLinkDetails__ShareLinkViaSignal')}
          onClick={onShareCallLinkViaSignal}
        />
      </PanelSection>
      {isCallLinkAdmin(callLink) && (
        <PanelSection>
          <PanelRow
            className="CallLinkDetails__DeleteLink"
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('icu:CallLinkDetails__DeleteLink')}
                icon={IconType.trash}
              />
            }
            label={i18n('icu:CallLinkDetails__DeleteLink')}
            onClick={() => {
              setIsDeleteCallLinkModalOpen(true);
            }}
          />
        </PanelSection>
      )}
      {isDeleteCallLinkModalOpen && (
        <ConfirmationDialog
          i18n={i18n}
          dialogName="CallLinkDetails__DeleteLinkModal"
          title={i18n('icu:CallLinkDetails__DeleteLinkModal__Title')}
          cancelText={i18n('icu:CallLinkDetails__DeleteLinkModal__Cancel')}
          actions={[
            {
              text: i18n('icu:CallLinkDetails__DeleteLinkModal__Delete'),
              style: 'affirmative',
              action: onDeleteCallLink,
            },
          ]}
          onClose={() => {
            setIsDeleteCallLinkModalOpen(false);
          }}
        >
          {i18n('icu:CallLinkDetails__DeleteLinkModal__Body')}
        </ConfirmationDialog>
      )}
    </div>
  );
}
