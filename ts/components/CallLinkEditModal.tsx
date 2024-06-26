// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useMemo, useState } from 'react';
import { v4 as generateUuid } from 'uuid';
import { Modal } from './Modal';
import type { LocalizerType } from '../types/I18N';
import {
  CallLinkRestrictions,
  toCallLinkRestrictions,
  type CallLinkType,
} from '../types/CallLink';
import { Select } from './Select';
import { linkCallRoute } from '../util/signalRoutes';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { Avatar, AvatarSize } from './Avatar';
import { getColorForCallLink } from '../util/getColorForCallLink';

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

  return (
    <Modal
      i18n={i18n}
      modalName="CallLinkEditModal"
      moduleClassName="CallLinkEditModal"
      title={i18n('icu:CallLinkEditModal__Title')}
      noEscapeClose
      noMouseClose
      padded={false}
      modalFooter={
        <Button type="submit" variant={ButtonVariant.Primary} onClick={onClose}>
          {i18n('icu:done')}
        </Button>
      }
      onClose={onClose}
    >
      <div className="CallLinkEditModal__Header">
        <Avatar
          i18n={i18n}
          badge={undefined}
          color={getColorForCallLink(callLink.rootKey)}
          conversationType="callLink"
          size={AvatarSize.SIXTY_FOUR}
          acceptedMessageRequest
          isMe={false}
          sharedGroupNames={[]}
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
          <Button
            onClick={onStartCallLinkLobby}
            size={ButtonSize.Small}
            variant={ButtonVariant.SecondaryAffirmative}
            className="CallLinkEditModal__JoinButton"
          >
            {i18n('icu:CallLinkEditModal__JoinButtonLabel')}
          </Button>
        </div>
      </div>

      <Hr />

      <RowButton onClick={onOpenCallLinkAddNameModal}>
        <Row>
          <RowIcon icon="Edit" />
          <RowText>{i18n('icu:CallLinkEditModal__AddCallNameLabel')}</RowText>
        </Row>
      </RowButton>

      <Row>
        <RowIcon icon="Approve" />
        <RowText>
          <label htmlFor={restrictionsId}>
            {i18n('icu:CallLinkEditModal__InputLabel--ApproveAllMembers')}
          </label>
        </RowText>
        <Select
          id={restrictionsId}
          value={String(callLink.restrictions)}
          moduleClassName="CallLinkEditModal__RowSelect"
          options={[
            {
              value: String(CallLinkRestrictions.None),
              text: i18n(
                'icu:CallLinkEditModal__ApproveAllMembers__Option--Off'
              ),
            },
            {
              value: String(CallLinkRestrictions.AdminApproval),
              text: i18n(
                'icu:CallLinkEditModal__ApproveAllMembers__Option--On'
              ),
            },
          ]}
          onChange={value => {
            onUpdateCallLinkRestrictions(toCallLinkRestrictions(value));
          }}
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
          <RowText>{i18n('icu:CallLinkDetails__ShareLinkViaSignal')}</RowText>
        </Row>
      </RowButton>
    </Modal>
  );
}
