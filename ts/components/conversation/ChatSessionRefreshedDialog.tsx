// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { Modal } from '../Modal';

import { useRestoreFocus } from '../../hooks/useRestoreFocus';

import type { LocalizerType } from '../../types/Util';
import { Button, ButtonSize, ButtonVariant } from '../Button';

export type PropsType = {
  i18n: LocalizerType;
  contactSupport: () => unknown;
  onClose: () => unknown;
};

export function ChatSessionRefreshedDialog(
  props: PropsType
): React.ReactElement {
  const { i18n, contactSupport, onClose } = props;

  // Focus first button after initial render, restore focus on teardown
  const [focusRef] = useRestoreFocus();

  const footer = (
    <>
      <Button
        onClick={contactSupport}
        size={ButtonSize.Medium}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:ChatRefresh--contactSupport')}
      </Button>
      <Button
        onClick={onClose}
        ref={focusRef}
        size={ButtonSize.Medium}
        variant={ButtonVariant.Primary}
        className="module-chat-session-refreshed-dialog__close-button"
      >
        {i18n('icu:Confirmation--confirm')}
      </Button>
    </>
  );
  return (
    <Modal
      modalName="ChatSessionRefreshedDialog"
      hasXButton={false}
      onClose={onClose}
      i18n={i18n}
      modalFooter={footer}
    >
      <>
        <div className="module-chat-session-refreshed-dialog__image">
          <img
            src="images/chat-session-refresh.svg"
            height="110"
            width="200"
            alt=""
          />
        </div>
        <div className="module-chat-session-refreshed-dialog__title">
          {i18n('icu:ChatRefresh--notification')}
        </div>
        <div className="module-chat-session-refreshed-dialog__description">
          {i18n('icu:ChatRefresh--summary')}
        </div>
      </>
    </Modal>
  );
}
