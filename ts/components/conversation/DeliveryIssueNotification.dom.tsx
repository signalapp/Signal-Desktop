// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useCallback, useState } from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button.dom.js';
import { SystemMessage } from './SystemMessage.dom.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { I18n } from '../I18n.dom.js';

import { DeliveryIssueDialog } from './DeliveryIssueDialog.dom.js';
import { UserText } from '../UserText.dom.js';

export type PropsDataType = {
  sender?: ConversationType;
  inGroup: boolean;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

export function DeliveryIssueNotification(
  props: PropsType
): ReactElement | null {
  const { i18n, inGroup, sender } = props;
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, [setIsDialogOpen]);
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, [setIsDialogOpen]);

  if (!sender) {
    return null;
  }

  return (
    <>
      <SystemMessage
        contents={
          <I18n
            id="icu:DeliveryIssue--notification"
            components={{
              sender: <UserText text={sender.firstName || sender.title} />,
            }}
            i18n={i18n}
          />
        }
        icon="info"
        button={
          <Button
            onClick={openDialog}
            size={ButtonSize.Small}
            variant={ButtonVariant.SystemMessage}
          >
            {i18n('icu:DeliveryIssue--learnMore')}
          </Button>
        }
      />
      {isDialogOpen ? (
        <DeliveryIssueDialog
          i18n={i18n}
          inGroup={inGroup}
          sender={sender}
          onClose={closeDialog}
        />
      ) : null}
    </>
  );
}
