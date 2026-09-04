// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type ReactNode, useState, type JSX } from 'react';
import type { CallHistoryGroup } from '../types/CallDisposition.std.ts';
import type { LocalizerType } from '../types/I18N.std.ts';
import { CallHistoryGroupPanelSection } from './conversation/conversation-details/CallHistoryGroupPanelSection.dom.tsx';
import {
  CallLinkRestrictions,
  type CallLinkType,
} from '../types/CallLink.std.ts';
import { linkCallRoute } from '../util/signalRoutes.std.ts';
import { drop } from '../util/drop.std.ts';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { copyCallLink } from '../util/copyLinksWithToast.dom.ts';
import { getColorForCallLink } from '../util/getColorForCallLink.std.ts';
import { isCallLinkAdmin } from '../types/CallLink.std.ts';
import { InAnotherCallTooltip } from './conversation/InAnotherCallTooltip.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../axo/items/AxoClickableItem.dom.tsx';
import { AxoContainer } from '../axo/AxoContainer.dom.tsx';
import { AxoSwitchItem } from '../axo/items/AxoSwitchItem.dom.tsx';

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
  });

  return (
    <AxoContainer.Root>
      <header className="CallLinkDetails__Header">
        <Avatar
          className="CallLinkDetails__HeaderAvatar"
          i18n={i18n}
          badge={undefined}
          color={getColorForCallLink(callLink.rootKey)}
          conversationType="callLink"
          size={AvatarSize.SIXTY_FOUR}
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
          <InAnotherCallTooltip inAnotherCall={isInAnotherCall} i18n={i18n}>
            <AxoButton.Root
              variant={
                isAnybodyInCall || isInCall
                  ? 'strong-affirmative'
                  : 'subtle-affirmative'
              }
              symbol="videocamera-fill"
              discouraged={isInAnotherCall}
              size="md"
              onClick={onStartCallLinkLobby}
            >
              {isInCall
                ? i18n('icu:CallsNewCallButton--return')
                : i18n('icu:CallLinkDetails__Join')}
            </AxoButton.Root>
          </InAnotherCallTooltip>
        </div>
      </header>
      <AxoList.Group>
        <CallHistoryGroupPanelSection
          callHistoryGroup={callHistoryGroup}
          i18n={i18n}
        />
        {isCallLinkAdmin(callLink) && (
          <List>
            <AxoClickableItem.Root
              symbol="pencil"
              label={
                callLink.name === ''
                  ? i18n('icu:CallLinkDetails__AddCallNameLabel')
                  : i18n('icu:CallLinkDetails__EditCallNameLabel')
              }
              arrow="next"
              onClick={onOpenCallLinkAddNameModal}
            />
            <AxoSwitchItem.Root
              symbol="person-check"
              label={i18n('icu:CallLinkDetails__ApproveAllMembersLabel')}
              disabled={isCallActiveOnServer}
              tooltip={
                isCallActiveOnServer
                  ? i18n(
                      'icu:CallLinkDetails__SettingTooltip--disabled-for-active-call'
                    )
                  : null
              }
              checked={callLink.restrictions !== CallLinkRestrictions.None}
              onCheckedChange={checked => {
                onUpdateCallLinkRestrictions(
                  checked
                    ? CallLinkRestrictions.AdminApproval
                    : CallLinkRestrictions.None
                );
              }}
            />
          </List>
        )}
        <List>
          <AxoClickableItem.Root
            symbol="copy"
            label={i18n('icu:CallLinkDetails__CopyLink')}
            onClick={() => {
              drop(copyCallLink(webUrl.toString()));
            }}
          />
          <AxoClickableItem.Root
            symbol="share"
            label={i18n('icu:CallLinkDetails__ShareLinkViaSignal')}
            onClick={onShareCallLinkViaSignal}
          />
        </List>
        {isCallLinkAdmin(callLink) && (
          <List>
            <AxoClickableItem.Root
              variant="destructive"
              symbol="trash"
              disabled={isCallActiveOnServer}
              label={i18n('icu:CallLinkDetails__DeleteLink')}
              tooltip={
                isCallActiveOnServer
                  ? i18n(
                      'icu:CallLinkDetails__DeleteLinkTooltip--disabled-for-active-call'
                    )
                  : null
              }
              onClick={() => {
                setIsDeleteCallLinkModalOpen(true);
              }}
            />
          </List>
        )}
      </AxoList.Group>
      <AxoConfirmDialog.Root
        open={isDeleteCallLinkModalOpen}
        onOpenChange={setIsDeleteCallLinkModalOpen}
        title={i18n('icu:CallLinkDetails__DeleteLinkModal__Title')}
        description={i18n('icu:CallLinkDetails__DeleteLinkModal__Body')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={onDeleteCallLink}
        >
          {i18n('icu:CallLinkDetails__DeleteLinkModal__Delete')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </AxoContainer.Root>
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

function List(props: { children: ReactNode }) {
  return (
    <AxoList.Root>
      <AxoList.Body>
        <AxoItem.Group>{props.children}</AxoItem.Group>
      </AxoList.Body>
    </AxoList.Root>
  );
}
