// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useCallback, useState } from 'react';

import type { LocalizerType } from '../../types/Util.std.js';

import { Button, ButtonSize, ButtonVariant } from '../Button.dom.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { ChatSessionRefreshedDialog } from './ChatSessionRefreshedDialog.dom.js';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.js';

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsHousekeepingType;

export function ChatSessionRefreshedNotification(
  props: PropsType
): ReactElement {
  const { i18n } = props;
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, [setIsDialogOpen]);
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, [setIsDialogOpen]);

  const wrappedContactSupport = useCallback(() => {
    setIsDialogOpen(false);

    const url =
      'https://support.signal.org/hc/requests/new?desktop&chat_refreshed';

    openLinkInWebBrowser(url);
  }, [setIsDialogOpen]);

  return (
    <>
      <SystemMessage
        contents={i18n('icu:ChatRefresh--notification')}
        button={
          <Button
            onClick={openDialog}
            size={ButtonSize.Small}
            variant={ButtonVariant.SystemMessage}
          >
            {i18n('icu:ChatRefresh--learnMore')}
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
