// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useCallback, useState } from 'react';

import type { LocalizerType } from '../../types/Util';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';
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
    <>
      <SystemMessage
        contents={i18n('ChatRefresh--notification')}
        button={
          <Button
            onClick={openDialog}
            size={ButtonSize.Small}
            variant={ButtonVariant.SystemMessage}
          >
            {i18n('ChatRefresh--learnMore')}
          </Button>
        }
        icon="session-refresh"
      />
      {isDialogOpen ? (
        <ChatSessionRefreshedDialog
          onClose={closeDialog}
          contactSupport={wrappedContactSupport}
          i18n={i18n}
        />
      ) : null}
    </>
  );
}
