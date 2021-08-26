// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, ReactElement } from 'react';

import { LocalizerType } from '../../types/Util';

import { Button, ButtonSize, ButtonVariant } from '../Button';
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
    <div className="SystemMessage SystemMessage--multiline">
      <div className="SystemMessage__line">
        <span className="SystemMessage__icon SystemMessage__icon--session-refresh" />
        {i18n('ChatRefresh--notification')}
      </div>
      <div className="SystemMessage__line">
        <Button
          onClick={openDialog}
          size={ButtonSize.Small}
          variant={ButtonVariant.SystemMessage}
        >
          {i18n('ChatRefresh--learnMore')}
        </Button>
      </div>
      {isDialogOpen ? (
        <ChatSessionRefreshedDialog
          onClose={closeDialog}
          contactSupport={wrappedContactSupport}
          i18n={i18n}
        />
      ) : null}
    </div>
  );
}
