// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useMemo, useState } from 'react';
import { v4 as generateUuid } from 'uuid';
import { Modal } from './Modal';
import type { LocalizerType } from '../types/I18N';
import {
  CallLinkRestrictions,
  toCallLinkRestrictions,
  type CallLinkType,
} from '../types/CallLink';
import { Input } from './Input';
import { Select } from './Select';
import { linkCallRoute } from '../util/signalRoutes';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { Avatar, AvatarSize } from './Avatar';
import { formatUrlWithoutProtocol } from '../util/url';

export type CallLinkEditModalProps = {
  i18n: LocalizerType;
  callLink: CallLinkType;
  onClose: () => void;
  onCopyCallLink: () => void;
  onUpdateCallLinkName: (name: string) => void;
  onUpdateCallLinkRestrictions: (restrictions: CallLinkRestrictions) => void;
  onShareCallLinkViaSignal: () => void;
  onStartCallLinkLobby: () => void;
};

export function CallLinkEditModal({
  i18n,
  callLink,
  onClose,
  onCopyCallLink,
  onUpdateCallLinkName,
  onUpdateCallLinkRestrictions,
  onShareCallLinkViaSignal,
  onStartCallLinkLobby,
}: CallLinkEditModalProps): JSX.Element {
  const { name: savedName, restrictions: savedRestrictions } = callLink;

  const [nameId] = useState(() => generateUuid());
  const [restrictionsId] = useState(() => generateUuid());

  const [nameInput, setNameInput] = useState(savedName);
  const [restrictionsInput, setRestrictionsInput] = useState(savedRestrictions);

  // We only want to use the default name "Signal Call" as a value if the user
  // modified the input and then chose that name. Doesn't revert when saved.
  const [nameTouched, setNameTouched] = useState(false);

  const callLinkWebUrl = useMemo(() => {
    return formatUrlWithoutProtocol(
      linkCallRoute.toWebUrl({ key: callLink.rootKey })
    );
  }, [callLink.rootKey]);

  const onSaveName = useCallback(
    (newName: string) => {
      if (!nameTouched) {
        return;
      }
      if (newName === savedName) {
        return;
      }
      onUpdateCallLinkName(newName);
    },
    [nameTouched, savedName, onUpdateCallLinkName]
  );

  const onSaveRestrictions = useCallback(
    (newRestrictions: CallLinkRestrictions) => {
      if (newRestrictions === savedRestrictions) {
        return;
      }
      onUpdateCallLinkRestrictions(newRestrictions);
    },
    [savedRestrictions, onUpdateCallLinkRestrictions]
  );

  return (
    <Modal
      i18n={i18n}
      modalName="CallLinkEditModal"
      moduleClassName="CallLinkEditModal"
      title={i18n('icu:CallLinkEditModal__Title')}
      hasXButton
      onClose={() => {
        // Save the modal in case the user hits escape
        onSaveName(nameInput);
        onClose();
      }}
    >
      <div className="CallLinkEditModal__Header">
        <Avatar
          i18n={i18n}
          badge={undefined}
          conversationType="callLink"
          size={AvatarSize.SIXTY_FOUR}
          acceptedMessageRequest
          isMe={false}
          sharedGroupNames={[]}
          title={callLink.name ?? i18n('icu:calling__call-link-default-title')}
        />
        <div className="CallLinkEditModal__Header__Details">
          <label htmlFor={nameId} className="CallLinkEditModal__SrOnly">
            {i18n('icu:CallLinkEditModal__InputLabel--Name--SrOnly')}
          </label>
          <Input
            moduleClassName="CallLinkEditModal__Input--Name"
            i18n={i18n}
            value={
              nameInput === '' && !nameTouched
                ? i18n('icu:calling__call-link-default-title')
                : nameInput
            }
            maxByteCount={120}
            onChange={value => {
              setNameTouched(true);
              setNameInput(value);
            }}
            onBlur={() => {
              onSaveName(nameInput);
            }}
            onEnter={() => {
              onSaveName(nameInput);
            }}
            placeholder={i18n('icu:calling__call-link-default-title')}
          />

          <div className="CallLinkEditModal__CallLinkAndJoinButton">
            <button
              className="CallLinkEditModal__CopyUrlTextButton"
              type="button"
              onClick={onCopyCallLink}
              aria-label={i18n('icu:CallLinkDetails__CopyLink')}
            >
              {callLinkWebUrl}
            </button>
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
      </div>

      <div
        className="CallLinkEditModal__ApproveAllMembers__Row"
        // For testing, to easily check the restrictions saved
        data-restrictions={savedRestrictions}
      >
        <label
          htmlFor={restrictionsId}
          className="CallLinkEditModal__ApproveAllMembers__Label"
        >
          {i18n('icu:CallLinkEditModal__InputLabel--ApproveAllMembers')}
        </label>
        <Select
          id={restrictionsId}
          value={restrictionsInput}
          options={[
            {
              value: CallLinkRestrictions.None,
              text: i18n(
                'icu:CallLinkEditModal__ApproveAllMembers__Option--Off'
              ),
            },
            {
              value: CallLinkRestrictions.AdminApproval,
              text: i18n(
                'icu:CallLinkEditModal__ApproveAllMembers__Option--On'
              ),
            },
          ]}
          onChange={value => {
            const newRestrictions = toCallLinkRestrictions(value);
            setRestrictionsInput(newRestrictions);
            onSaveRestrictions(newRestrictions);
          }}
        />
      </div>

      <button
        type="button"
        className="CallLinkEditModal__ActionButton"
        onClick={onCopyCallLink}
      >
        <i
          role="presentation"
          className="CallLinkEditModal__ActionButton__Icon CallLinkEditModal__ActionButton__Icon--Copy"
        />
        {i18n('icu:CallLinkDetails__CopyLink')}
      </button>

      <button
        type="button"
        className="CallLinkEditModal__ActionButton"
        onClick={onShareCallLinkViaSignal}
      >
        <i
          role="presentation"
          className="CallLinkEditModal__ActionButton__Icon CallLinkEditModal__ActionButton__Icon--Share"
        />
        {i18n('icu:CallLinkDetails__ShareLinkViaSignal')}
      </button>
    </Modal>
  );
}
