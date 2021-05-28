// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, ReactElement } from 'react';

import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { Intl } from '../Intl';
import { Emojify } from './Emojify';

import { DeliveryIssueDialog } from './DeliveryIssueDialog';

export type PropsDataType = {
  sender?: ConversationType;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

export function DeliveryIssueNotification(
  props: PropsType
): ReactElement | null {
  const { i18n, sender } = props;
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
    <div className="module-delivery-issue-notification">
      <div className="module-delivery-issue-notification__first-line">
        <span className="module-delivery-issue-notification__icon" />
        <Intl
          id="DeliveryIssue--notification"
          components={{
            sender: <Emojify text={sender.firstName || sender.title} />,
          }}
          i18n={i18n}
        />
      </div>
      <button
        type="button"
        onClick={openDialog}
        className="module-delivery-issue-notification__button"
      >
        {i18n('DeliveryIssue--learnMore')}
      </button>
      {isDialogOpen ? (
        <DeliveryIssueDialog
          i18n={i18n}
          sender={sender}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
