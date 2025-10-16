// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import classNames from 'classnames';
import type { CallHistoryGroup } from '../types/CallDisposition.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { CallHistoryGroupPanelSection } from './conversation/conversation-details/CallHistoryGroupPanelSection.dom.js';
import { PanelSection } from './conversation/conversation-details/PanelSection.dom.js';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation/conversation-details/ConversationDetailsIcon.dom.js';
import { PanelRow } from './conversation/conversation-details/PanelRow.dom.js';
import type {
  CallLinkRestrictions,
  CallLinkType,
} from '../types/CallLink.std.js';
import { linkCallRoute } from '../util/signalRoutes.std.js';
import { drop } from '../util/drop.std.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { Button, ButtonSize, ButtonVariant } from './Button.dom.js';
import { copyCallLink } from '../util/copyLinksWithToast.dom.js';
import { getColorForCallLink } from '../util/getColorForCallLink.std.js';
import { isCallLinkAdmin } from '../types/CallLink.std.js';
import { CallLinkRestrictionsSelect } from './CallLinkRestrictionsSelect.dom.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { InAnotherCallTooltip } from './conversation/InAnotherCallTooltip.dom.js';
import { offsetDistanceModifier } from '../util/popperUtil.std.js';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.js';

function toUrlWithoutProtocol(url: URL): string {
  return `${url.hostname}${url.pathname}${url.search}${url.hash}`;
}

export type CallLinkDetailsProps = Readonly<{
  callHistoryGroup: CallHistoryGroup;
  callLink: CallLinkType | undefined;
  isAnybodyInCall: boolean;
  isCallActiveOnServer: boolean;
  isInCall: boolean;
  isInAnotherCall: boolean;
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
  isAnybodyInCall,
  isCallActiveOnServer,
  isInCall,
  isInAnotherCall,
  onDeleteCallLink,
  onOpenCallLinkAddNameModal,
  onStartCallLinkLobby,
  onShareCallLinkViaSignal,
  onUpdateCallLinkRestrictions,
}: CallLinkDetailsProps): JSX.Element {
  const [isDeleteCallLinkModalOpen, setIsDeleteCallLinkModalOpen] =
    useState(false);

  if (!callLink) {
    return renderMissingCallLink({ callHistoryGroup, i18n });
  }

  const webUrl = linkCallRoute.toWebUrl({
    key: callLink.rootKey,
    epoch: callLink.epoch,
  });
  const joinButton = (
    <Button
      className={classNames({
        CallLinkDetails__HeaderButton: true,
        'CallLinkDetails__HeaderButton--active-call': isAnybodyInCall,
      })}
      variant={
        isAnybodyInCall
          ? ButtonVariant.Calling
          : ButtonVariant.SecondaryAffirmative
      }
      discouraged={isInAnotherCall}
      size={ButtonSize.Small}
      onClick={onStartCallLinkLobby}
    >
      {isInCall
        ? i18n('icu:CallsNewCallButton--return')
        : i18n('icu:CallLinkDetails__Join')}
    </Button>
  );
  const callLinkRestrictionsSelect = (
    <CallLinkRestrictionsSelect
      disabled={isCallActiveOnServer}
      i18n={i18n}
      value={callLink.restrictions}
      onChange={onUpdateCallLinkRestrictions}
    />
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
          {isInAnotherCall ? (
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
              isCallActiveOnServer ? (
                <Tooltip
                  className="CallLinkDetails__ApproveAllMembersDisabledTooltip"
                  content={i18n(
                    'icu:CallLinkDetails__SettingTooltip--disabled-for-active-call'
                  )}
                  direction={TooltipPlacement.Top}
                  popperModifiers={[offsetDistanceModifier(5)]}
                >
                  {callLinkRestrictionsSelect}
                </Tooltip>
              ) : (
                callLinkRestrictionsSelect
              )
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
            className={classNames({
              CallLinkDetails__DeleteLink: true,
              'CallLinkDetails__DeleteLink--disabled-for-active-call':
                isCallActiveOnServer,
            })}
            disabled={isCallActiveOnServer}
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('icu:CallLinkDetails__DeleteLink')}
                icon={IconType.trash}
              />
            }
            label={
              isCallActiveOnServer ? (
                <Tooltip
                  className="CallLinkDetails__DeleteLinkTooltip"
                  content={i18n(
                    'icu:CallLinkDetails__DeleteLinkTooltip--disabled-for-active-call'
                  )}
                  direction={TooltipPlacement.Top}
                  popperModifiers={[offsetDistanceModifier(5)]}
                >
                  {i18n('icu:CallLinkDetails__DeleteLink')}
                </Tooltip>
              ) : (
                i18n('icu:CallLinkDetails__DeleteLink')
              )
            }
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

function renderMissingCallLink({
  callHistoryGroup,
  i18n,
}: Pick<CallLinkDetailsProps, 'callHistoryGroup' | 'i18n'>): JSX.Element {
  return (
    <div className="CallLinkDetails__Container">
      <header className="CallLinkDetails__Header">
        <Avatar
          className="CallLinkDetails__HeaderAvatar"
          i18n={i18n}
          badge={undefined}
          conversationType="callLink"
          size={AvatarSize.SIXTY_FOUR}
          sharedGroupNames={[]}
          title={i18n('icu:calling__call-link-default-title')}
        />
        <div className="CallLinkDetails__HeaderDetails">
          <h1 className="CallLinkDetails__HeaderTitle">
            {i18n('icu:calling__call-link-default-title')}
          </h1>
        </div>
      </header>
      <CallHistoryGroupPanelSection
        callHistoryGroup={callHistoryGroup}
        i18n={i18n}
      />
    </div>
  );
}
