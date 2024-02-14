// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useCallback, useState } from 'react';

import { ButtonVariant } from '../Button';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { SPINNER_CLASS_NAME } from './BaseConversationListItem';
import { ListTile } from '../ListTile';
import { Avatar, AvatarSize } from '../Avatar';
import { Spinner } from '../Spinner';

import type { ParsedE164Type } from '../../util/libphonenumberInstance';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId';
import type { LocalizerType } from '../../types/Util';
import type { ShowConversationType } from '../../state/ducks/conversations';

type PropsData = {
  phoneNumber: ParsedE164Type;
  isFetching: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  showConversation: ShowConversationType;
} & LookupConversationWithoutServiceIdActionsType;

export type Props = PropsData & PropsHousekeeping;

export const StartNewConversation: FunctionComponent<Props> = React.memo(
  function StartNewConversation({
    i18n,
    phoneNumber,
    isFetching,
    lookupConversationWithoutServiceId,
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
      const conversationId = await lookupConversationWithoutServiceId({
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
      lookupConversationWithoutServiceId,
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
          dialogName="StartNewConversation.invalidPhoneNumber"
          cancelText={i18n('icu:ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => setIsModalVisible(false)}
        >
          {i18n('icu:startConversation--phone-number-not-valid', {
            phoneNumber: phoneNumber.userInput,
          })}
        </ConfirmationDialog>
      );
    }

    return (
      <>
        <ListTile
          leading={
            <Avatar
              acceptedMessageRequest={false}
              conversationType="direct"
              searchResult
              i18n={i18n}
              isMe={false}
              title={phoneNumber.userInput}
              size={AvatarSize.THIRTY_TWO}
              badge={undefined}
              sharedGroupNames={[]}
            />
          }
          title={phoneNumber.userInput}
          onClick={boundOnClick}
          trailing={
            isFetching ? (
              <Spinner
                size="20px"
                svgSize="small"
                moduleClassName={SPINNER_CLASS_NAME}
                direction="on-progress-dialog"
              />
            ) : undefined
          }
        />
        {modal}
      </>
    );
  }
);
