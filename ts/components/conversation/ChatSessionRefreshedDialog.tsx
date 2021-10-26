// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';

import { Modal } from '../Modal';

import { useRestoreFocus } from '../../hooks/useRestoreFocus';

import type { LocalizerType } from '../../types/Util';

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

  return (
    <Modal hasXButton={false} onClose={onClose} i18n={i18n}>
      <div className="module-chat-session-refreshed-dialog">
        <div className="module-chat-session-refreshed-dialog__image">
          <img
            src="images/chat-session-refresh.svg"
            height="110"
            width="200"
            alt=""
          />
        </div>
        <div className="module-chat-session-refreshed-dialog__title">
          {i18n('ChatRefresh--notification')}
        </div>
        <div className="module-chat-session-refreshed-dialog__description">
          {i18n('ChatRefresh--summary')}
        </div>
        <div className="module-chat-session-refreshed-dialog__buttons">
          <button
            type="button"
            onClick={contactSupport}
            className={classNames(
              'module-chat-session-refreshed-dialog__button',
              'module-chat-session-refreshed-dialog__button--secondary'
            )}
          >
            {i18n('ChatRefresh--contactSupport')}
          </button>
          <button
            type="button"
            onClick={onClose}
            ref={focusRef}
            className="module-chat-session-refreshed-dialog__button"
          >
            {i18n('Confirmation--confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
