// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useMemo, useState } from 'react';
import { v4 as generateUuid } from 'uuid';
import { Modal } from './Modal';
import type { LocalizerType } from '../types/I18N';
import { Button, ButtonVariant } from './Button';
import { Avatar, AvatarSize } from './Avatar';
import { Input } from './Input';
import {
  CallLinkNameMaxByteLength,
  CallLinkNameMaxLength,
  type CallLinkType,
} from '../types/CallLink';
import { getColorForCallLink } from '../util/getColorForCallLink';

export type CallLinkAddNameModalProps = Readonly<{
  i18n: LocalizerType;
  callLink: CallLinkType;
  onClose: () => void;
  onUpdateCallLinkName: (name: string) => void;
}>;

export function CallLinkAddNameModal({
  i18n,
  callLink,
  onClose,
  onUpdateCallLinkName,
}: CallLinkAddNameModalProps): JSX.Element {
  const [formId] = useState(() => generateUuid());
  const [nameId] = useState(() => generateUuid());
  const [nameInput, setNameInput] = useState(callLink.name);

  const parsedForm = useMemo(() => {
    const name = nameInput.trim();
    if (name === callLink.name) {
      return null;
    }
    return { name };
  }, [nameInput, callLink]);

  const handleNameInputChange = useCallback((nextNameInput: string) => {
    setNameInput(nextNameInput);
  }, []);

  const handleSubmit = useCallback(() => {
    if (parsedForm == null) {
      return;
    }
    onUpdateCallLinkName(parsedForm.name);
    onClose();
  }, [parsedForm, onUpdateCallLinkName, onClose]);

  return (
    <Modal
      modalName="CallLinkAddNameModal"
      i18n={i18n}
      hasXButton
      noMouseClose
      title={
        callLink.name === ''
          ? i18n('icu:CallLinkAddNameModal__Title')
          : i18n('icu:CallLinkAddNameModal__Title--Edit')
      }
      onClose={onClose}
      moduleClassName="CallLinkAddNameModal"
      modalFooter={
        <>
          <Button onClick={onClose} variant={ButtonVariant.Secondary}>
            {i18n('icu:cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={ButtonVariant.Primary}
            aria-disabled={parsedForm == null}
          >
            {i18n('icu:save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="CallLinkAddNameModal__Row"
      >
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

        <label htmlFor={nameId} className="CallLinkAddNameModal__SrOnly">
          {i18n('icu:CallLinkAddNameModal__NameLabel')}
        </label>
        <Input
          i18n={i18n}
          id={nameId}
          value={nameInput}
          placeholder={i18n('icu:CallLinkAddNameModal__NameLabel')}
          autoFocus
          onChange={handleNameInputChange}
          moduleClassName="CallLinkAddNameModal__Input"
          maxByteCount={CallLinkNameMaxByteLength}
          maxLengthCount={CallLinkNameMaxLength}
        />
      </form>
    </Modal>
  );
}
