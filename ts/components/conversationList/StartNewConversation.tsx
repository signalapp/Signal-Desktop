// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useCallback, useState } from 'react';

import { ButtonVariant } from '../Button';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { BaseConversationListItem } from './BaseConversationListItem';

import type { ParsedE164Type } from '../../util/libphonenumberInstance';
import type { LookupConversationWithoutUuidActionsType } from '../../util/lookupConversationWithoutUuid';
import type { LocalizerType } from '../../types/Util';
import type { ShowConversationType } from '../../state/ducks/conversations';
import { AvatarColors } from '../../types/Colors';

type PropsData = {
  phoneNumber: ParsedE164Type;
  isFetching: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  showConversation: ShowConversationType;
} & LookupConversationWithoutUuidActionsType;

export type Props = PropsData & PropsHousekeeping;

export const StartNewConversation: FunctionComponent<Props> = React.memo(
  function StartNewConversation({
    i18n,
    phoneNumber,
    isFetching,
    lookupConversationWithoutUuid,
    showUserNotFoundModal,
    setIsFetchingUUID,
    showConversation,
  }) {
    const [isModalVisible, setIsModalVisible] = useState(false);

    const boundOnClick = useCallback(async () => {
      if (!phoneNumber.isValid) {
        setIsModalVisible(true);
        return;
      }
      if (isFetching) {
        return;
      }
      const conversationId = await lookupConversationWithoutUuid({
        showUserNotFoundModal,
        setIsFetchingUUID,

        type: 'e164',
        e164: phoneNumber.e164,
        phoneNumber: phoneNumber.userInput,
      });

      if (conversationId !== undefined) {
        showConversation({ conversationId });
      }
    }, [
      showConversation,
      lookupConversationWithoutUuid,
      showUserNotFoundModal,
      setIsFetchingUUID,
      setIsModalVisible,
      phoneNumber,
      isFetching,
    ]);

    let modal: JSX.Element | undefined;
    if (isModalVisible) {
      modal = (
        <ConfirmationDialog
          cancelText={i18n('ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => setIsModalVisible(false)}
        >
          {i18n('startConversation--phone-number-not-valid', {
            phoneNumber: phoneNumber.userInput,
          })}
        </ConfirmationDialog>
      );
    }

    return (
      <>
        <BaseConversationListItem
          acceptedMessageRequest={false}
          color={AvatarColors[0]}
          conversationType="direct"
          headerName={phoneNumber.userInput}
          i18n={i18n}
          isMe={false}
          isSelected={false}
          onClick={boundOnClick}
          phoneNumber={phoneNumber.userInput}
          shouldShowSpinner={isFetching}
          sharedGroupNames={[]}
          title={phoneNumber.userInput}
        />
        {modal}
      </>
    );
  }
);
