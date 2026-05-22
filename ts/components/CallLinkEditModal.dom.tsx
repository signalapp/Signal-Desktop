// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useMemo, useState } from 'react';
import { v4 as generateUuid } from 'uuid';
import type { LocalizerType } from '../types/I18N.std.ts';
import type {
  CallLinkRestrictions,
  CallLinkType,
} from '../types/CallLink.std.ts';
import { linkCallRoute } from '../util/signalRoutes.std.ts';
import { Button, ButtonSize, ButtonVariant } from './Button.dom.tsx';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { getColorForCallLink } from '../util/getColorForCallLink.std.ts';
import { CallLinkRestrictionsSelect } from './CallLinkRestrictionsSelect.dom.tsx';
import { InAnotherCallTooltip } from './conversation/InAnotherCallTooltip.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

const CallLinkEditModalRowIconClasses = {
  Edit: 'CallLinkEditModal__RowIcon--Edit',
  Approve: 'CallLinkEditModal__RowIcon--Approve',
  Copy: 'CallLinkEditModal__RowIcon--Copy',
  Share: 'CallLinkEditModal__RowIcon--Share',
} as const;

function RowIcon({
  icon,
}: {
  icon: keyof typeof CallLinkEditModalRowIconClasses;
}) {
  return (
    <i
      role="presentation"
      className={`CallLinkEditModal__RowIcon ${CallLinkEditModalRowIconClasses[icon]}`}
    />
  );
}

function RowText({ children }: { children: ReactNode }) {
  return <div className="CallLinkEditModal__RowLabel">{children}</div>;
}

function Row({ children }: { children: ReactNode }) {
  return <div className="CallLinkEditModal__Row">{children}</div>;
}

function RowButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="CallLinkEditModal__RowButton"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Hr() {
  return <hr className="CallLinkEditModal__Hr" />;
}

export type CallLinkEditModalProps = {
  i18n: LocalizerType;
  callLink: CallLinkType;
  hasActiveCall: boolean;
  onClose: () => void;
  onCopyCallLink: () => void;
  onOpenCallLinkAddNameModal: () => void;
  onUpdateCallLinkRestrictions: (restrictions: CallLinkRestrictions) => void;
  onShareCallLinkViaSignal: () => void;
  onStartCallLinkLobby: () => void;
};

export function CallLinkEditModal({
  i18n,
  callLink,
  hasActiveCall,
  onClose,
  onCopyCallLink,
  onOpenCallLinkAddNameModal,
  onUpdateCallLinkRestrictions,
  onShareCallLinkViaSignal,
  onStartCallLinkLobby,
}: CallLinkEditModalProps): JSX.Element {
  const [restrictionsId] = useState(() => generateUuid());

  const callLinkWebUrl = useMemo(() => {
    return linkCallRoute.toWebUrl({ key: callLink.rootKey }).toString();
  }, [callLink.rootKey]);

  const joinButton = (
    <Button
      onClick={onStartCallLinkLobby}
      size={ButtonSize.Small}
      variant={ButtonVariant.SecondaryAffirmative}
      discouraged={hasActiveCall}
      className="CallLinkEditModal__JoinButton"
    >
      {i18n('icu:CallLinkEditModal__JoinButtonLabel')}
    </Button>
  );

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:CallLinkEditModal__Title')}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body padding="only-scrollbar-gutter">
          <div className="CallLinkEditModal__Header">
            <Avatar
              i18n={i18n}
              badge={undefined}
              color={getColorForCallLink(callLink.rootKey)}
              conversationType="callLink"
              size={AvatarSize.SIXTY_FOUR}
              title={
                callLink.name === ''
                  ? i18n('icu:calling__call-link-default-title')
                  : callLink.name
              }
            />
            <div className="CallLinkEditModal__Header__Details">
              <div className="CallLinkEditModal__Header__Title">
                {callLink.name === ''
                  ? i18n('icu:calling__call-link-default-title')
                  : callLink.name}
              </div>
              <button
                className="CallLinkEditModal__Header__CallLinkButton"
                type="button"
                onClick={onCopyCallLink}
                aria-label={i18n('icu:CallLinkDetails__CopyLink')}
              >
                <div className="CallLinkEditModal__Header__CallLinkButton__Text">
                  {callLinkWebUrl}
                </div>
              </button>
            </div>
            <div className="CallLinkEditModal__Header__Actions">
              {hasActiveCall ? (
                <InAnotherCallTooltip i18n={i18n}>
                  {joinButton}
                </InAnotherCallTooltip>
              ) : (
                joinButton
              )}
            </div>
          </div>

          <Hr />

          <RowButton onClick={onOpenCallLinkAddNameModal}>
            <Row>
              <RowIcon icon="Edit" />
              <RowText>
                {callLink.name === ''
                  ? i18n('icu:CallLinkEditModal__AddCallNameLabel')
                  : i18n('icu:CallLinkEditModal__EditCallNameLabel')}
              </RowText>
            </Row>
          </RowButton>

          <Row>
            <RowIcon icon="Approve" />
            <RowText>
              <label htmlFor={restrictionsId}>
                {i18n('icu:CallLinkEditModal__InputLabel--ApproveAllMembers')}
              </label>
            </RowText>
            <CallLinkRestrictionsSelect
              i18n={i18n}
              id={restrictionsId}
              value={callLink.restrictions}
              onChange={onUpdateCallLinkRestrictions}
            />
          </Row>

          <Hr />

          <RowButton onClick={onCopyCallLink}>
            <Row>
              <RowIcon icon="Copy" />
              <RowText>{i18n('icu:CallLinkDetails__CopyLink')}</RowText>
            </Row>
          </RowButton>

          <RowButton onClick={onShareCallLinkViaSignal}>
            <Row>
              <RowIcon icon="Share" />
              <RowText>
                {i18n('icu:CallLinkDetails__ShareLinkViaSignal')}
              </RowText>
            </Row>
          </RowButton>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="primary" onClick={onClose}>
              {i18n('icu:done')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
