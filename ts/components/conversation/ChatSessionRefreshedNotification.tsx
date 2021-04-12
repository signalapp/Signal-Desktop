// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, ReactElement } from 'react';

import { LocalizerType } from '../../types/Util';

import { ModalHost } from '../ModalHost';
import { ChatSessionRefreshedDialog } from './ChatSessionRefreshedDialog';

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsActionsType = {
  contactSupport: () => unknown;
};

export type PropsType = PropsHousekeepingType & PropsActionsType;

export function ChatSessionRefreshedNotification(
  props: PropsType
): ReactElement {
  const { contactSupport, i18n } = props;
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, [setIsDialogOpen]);
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, [setIsDialogOpen]);

  const wrappedContactSupport = useCallback(() => {
    setIsDialogOpen(false);
    contactSupport();
  }, [contactSupport, setIsDialogOpen]);

  return (
    <div className="module-chat-session-refreshed-notification">
      <div className="module-chat-session-refreshed-notification__first-line">
        <span className="module-chat-session-refreshed-notification__icon" />
        {i18n('ChatRefresh--notification')}
      </div>
      <button
        type="button"
        onClick={openDialog}
        className="module-chat-session-refreshed-notification__button"
      >
        {i18n('ChatRefresh--learnMore')}
      </button>
      {isDialogOpen ? (
        <ModalHost onClose={closeDialog}>
          <ChatSessionRefreshedDialog
            onClose={closeDialog}
            contactSupport={wrappedContactSupport}
            i18n={i18n}
          />
        </ModalHost>
      ) : null}
    </div>
  );
}
