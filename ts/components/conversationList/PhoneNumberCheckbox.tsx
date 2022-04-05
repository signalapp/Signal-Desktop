// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useState } from 'react';

import { ButtonVariant } from '../Button';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { BaseConversationListItem } from './BaseConversationListItem';
import type { ParsedE164Type } from '../../util/libphonenumberInstance';
import type { LocalizerType, ThemeType } from '../../types/Util';
import { AvatarColors } from '../../types/Colors';
import type { LookupConversationWithoutUuidActionsType } from '../../util/lookupConversationWithoutUuid';

export type PropsDataType = {
  phoneNumber: ParsedE164Type;
  isChecked: boolean;
  isFetching: boolean;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
  theme: ThemeType;
  toggleConversationInChooseMembers: (conversationId: string) => void;
} & LookupConversationWithoutUuidActionsType;

type PropsType = PropsDataType & PropsHousekeepingType;

export const PhoneNumberCheckbox: FunctionComponent<PropsType> = React.memo(
  function PhoneNumberCheckbox({
    phoneNumber,
    isChecked,
    isFetching,
    theme,
    i18n,
    lookupConversationWithoutUuid,
    showUserNotFoundModal,
    setIsFetchingUUID,
    toggleConversationInChooseMembers,
  }) {
    const [isModalVisible, setIsModalVisible] = useState(false);

    const onClickItem = React.useCallback(async () => {
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
        toggleConversationInChooseMembers(conversationId);
      }
    }, [
      isFetching,
      toggleConversationInChooseMembers,
      lookupConversationWithoutUuid,
      showUserNotFoundModal,
      setIsFetchingUUID,
      setIsModalVisible,
      phoneNumber,
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
          checked={isChecked}
          color={AvatarColors[0]}
          conversationType="direct"
          headerName={phoneNumber.userInput}
          i18n={i18n}
          isMe={false}
          isSelected={false}
          onClick={onClickItem}
          phoneNumber={phoneNumber.userInput}
          shouldShowSpinner={isFetching}
          theme={theme}
          sharedGroupNames={[]}
          title={phoneNumber.userInput}
        />
        {modal}
      </>
    );
  }
);
