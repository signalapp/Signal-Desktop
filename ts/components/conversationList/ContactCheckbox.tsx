// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent, ReactNode } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import { ColorType } from '../../types/Colors';
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
  about?: string;
  avatarPath?: string;
  color?: ColorType;
  disabledReason?: ContactCheckboxDisabledReason;
  id: string;
  isChecked: boolean;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  title: string;
};

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
    avatarPath,
    color,
    disabledReason,
    i18n,
    id,
    isChecked,
    name,
    onClick,
    phoneNumber,
    profileName,
    style,
    title,
  }) => {
    const disabled = Boolean(disabledReason);

    const headerName = (
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
        avatarPath={avatarPath}
        checked={isChecked}
        color={color}
        conversationType="direct"
        disabled={disabled}
        headerName={headerName}
        i18n={i18n}
        id={id}
        isSelected={false}
        messageText={messageText}
        name={name}
        onClick={onClickItem}
        phoneNumber={phoneNumber}
        profileName={profileName}
        style={style}
        title={title}
      />
    );
  }
);
