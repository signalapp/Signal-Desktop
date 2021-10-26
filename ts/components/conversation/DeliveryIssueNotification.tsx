// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useCallback, useState } from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';
import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
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
    <>
      <SystemMessage
        contents={
          <Intl
            id="DeliveryIssue--notification"
            components={{
              sender: <Emojify text={sender.firstName || sender.title} />,
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
            {i18n('DeliveryIssue--learnMore')}
          </Button>
        }
      />
      {isDialogOpen ? (
        <DeliveryIssueDialog
          i18n={i18n}
          inGroup={inGroup}
          learnMoreAboutDeliveryIssue={learnMoreAboutDeliveryIssue}
          sender={sender}
          onClose={closeDialog}
        />
      ) : null}
    </>
  );
}
