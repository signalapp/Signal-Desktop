// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent, ReactNode } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { ContactName } from '../conversation/ContactName';
import { About } from '../conversation/About';

export enum ContactCheckboxDisabledReason {
  // We start the enum at 1 because the default starting value of 0 is falsy.
  AlreadyAdded = 1,
  MaximumContactsSelected,
  NotCapable,
}

export type PropsDataType = {
  disabledReason?: ContactCheckboxDisabledReason;
  isChecked: boolean;
} & Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'id'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'type'
  | 'unblurredAvatarPath'
>;

type PropsHousekeepingType = {
  i18n: LocalizerType;
  style: CSSProperties;
  onClick: (
    id: string,
    disabledReason: undefined | ContactCheckboxDisabledReason
  ) => void;
};

type PropsType = PropsDataType & PropsHousekeepingType;

export const ContactCheckbox: FunctionComponent<PropsType> = React.memo(
  ({
    about,
    acceptedMessageRequest,
    avatarPath,
    color,
    disabledReason,
    i18n,
    id,
    isChecked,
    isMe,
    name,
    onClick,
    phoneNumber,
    profileName,
    sharedGroupNames,
    style,
    title,
    type,
    unblurredAvatarPath,
  }) => {
    const disabled = Boolean(disabledReason);

    const headerName = isMe ? (
      i18n('noteToSelf')
    ) : (
      <ContactName
        phoneNumber={phoneNumber}
        name={name}
        profileName={profileName}
        title={title}
        i18n={i18n}
      />
    );

    let messageText: ReactNode;
    if (disabledReason === ContactCheckboxDisabledReason.AlreadyAdded) {
      messageText = i18n('alreadyAMember');
    } else if (about) {
      messageText = <About className="" text={about} />;
    } else {
      messageText = null;
    }

    const onClickItem = () => {
      onClick(id, disabledReason);
    };

    return (
      <BaseConversationListItem
        acceptedMessageRequest={acceptedMessageRequest}
        avatarPath={avatarPath}
        checked={isChecked}
        color={color}
        conversationType={type}
        disabled={disabled}
        headerName={headerName}
        i18n={i18n}
        id={id}
        isMe={isMe}
        isSelected={false}
        messageText={messageText}
        name={name}
        onClick={onClickItem}
        phoneNumber={phoneNumber}
        profileName={profileName}
        sharedGroupNames={sharedGroupNames}
        style={style}
        title={title}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }
);
