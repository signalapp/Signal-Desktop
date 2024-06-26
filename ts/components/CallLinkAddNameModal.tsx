// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useState } from 'react';
import { v4 as generateUuid } from 'uuid';
import { Modal } from './Modal';
import type { LocalizerType } from '../types/I18N';
import { Button, ButtonVariant } from './Button';
import { Avatar, AvatarSize } from './Avatar';
import { Input } from './Input';
import type { CallLinkType } from '../types/CallLink';
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

  const handleNameInputChange = useCallback((nextNameInput: string) => {
    setNameInput(nextNameInput);
  }, []);

  const handleSubmit = useCallback(() => {
    const nameValue = nameInput.trim();
    if (nameValue === callLink.name) {
      return;
    }
    onUpdateCallLinkName(nameValue);
    onClose();
  }, [nameInput, callLink, onUpdateCallLinkName, onClose]);

  return (
    <Modal
      modalName="CallLinkAddNameModal"
      i18n={i18n}
      hasXButton
      noEscapeClose
      noMouseClose
      title={i18n('icu:CallLinkAddNameModal__Title')}
      onClose={onClose}
      moduleClassName="CallLinkAddNameModal"
      modalFooter={
        <>
          <Button onClick={onClose} variant={ButtonVariant.Secondary}>
            {i18n('icu:cancel')}
          </Button>
          <Button type="submit" form={formId} variant={ButtonVariant.Primary}>
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
        />
      </form>
    </Modal>
  );
}
