// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, JSX } from 'react';
import { useCallback, useState, memo } from 'react';
import { SPINNER_CLASS_NAME } from './BaseConversationListItem.dom.tsx';
import { ListTile } from '../ListTile.dom.tsx';
import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import { Spinner } from '../Spinner.dom.tsx';

import type { ParsedE164Type } from '../../util/libphonenumberInstance.std.ts';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { ShowConversationType } from '../../state/ducks/conversations.preload.ts';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';

type PropsData = {
  phoneNumber: ParsedE164Type;
  isFetching: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  showConversation: ShowConversationType;
} & LookupConversationWithoutServiceIdActionsType;

export type Props = PropsData & PropsHousekeeping;

export const StartNewConversation: FunctionComponent<Props> = memo(
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
        <AxoConfirmDialog.Root
          open
          onOpenChange={() => setIsModalVisible(false)}
          // @ts-expect-error ConfirmationDialog migration: Needs title
          title={null}
          description={i18n('icu:startConversation--phone-number-not-valid', {
            phoneNumber: phoneNumber.userInput,
          })}
        >
          <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
        </AxoConfirmDialog.Root>
      );
    }

    return (
      <>
        <ListTile
          leading={
            <Avatar
              conversationType="direct"
              searchResult
              i18n={i18n}
              title={phoneNumber.userInput}
              size={AvatarSize.THIRTY_TWO}
              badge={undefined}
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
