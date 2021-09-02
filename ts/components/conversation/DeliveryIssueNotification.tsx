// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, ReactElement } from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { Intl } from '../Intl';
import { Emojify } from './Emojify';

import { DeliveryIssueDialog } from './DeliveryIssueDialog';

export type PropsDataType = {
  sender?: ConversationType;
  inGroup: boolean;
};

export type PropsActionsType = {
  learnMoreAboutDeliveryIssue: () => unknown;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

export function DeliveryIssueNotification(
  props: PropsType
): ReactElement | null {
  const { i18n, inGroup, sender, learnMoreAboutDeliveryIssue } = props;
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
    <div className="SystemMessage SystemMessage--multiline">
      <div className="SystemMessage__line">
        <span className="SystemMessage__icon SystemMessage__icon--info" />
        <span>
          <Intl
            id="DeliveryIssue--notification"
            components={{
              sender: <Emojify text={sender.firstName || sender.title} />,
            }}
            i18n={i18n}
          />
        </span>
      </div>
      <div className="SystemMessage__line">
        <Button
          onClick={openDialog}
          size={ButtonSize.Small}
          variant={ButtonVariant.SystemMessage}
        >
          {i18n('DeliveryIssue--learnMore')}
        </Button>
      </div>
      {isDialogOpen ? (
        <DeliveryIssueDialog
          i18n={i18n}
          inGroup={inGroup}
          learnMoreAboutDeliveryIssue={learnMoreAboutDeliveryIssue}
          sender={sender}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
