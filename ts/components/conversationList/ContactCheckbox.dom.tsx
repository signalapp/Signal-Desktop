// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { FunctionComponent } from 'react';

import { HEADER_CONTACT_NAME_CLASS_NAME } from './BaseConversationListItem.dom.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { BadgeType } from '../../badges/types.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import { ContactName } from '../conversation/ContactName.dom.js';
import { About } from '../conversation/About.dom.js';
import { ListTile } from '../ListTile.dom.js';
import { Avatar, AvatarSize } from '../Avatar.dom.js';

export enum ContactCheckboxDisabledReason {
  // We start the enum at 1 because the default starting value of 0 is falsy.
  AlreadyAdded = 1,
  MaximumContactsSelected,
}

export type PropsDataType = {
  badge: undefined | BadgeType;
  disabledReason?: ContactCheckboxDisabledReason;
  isChecked: boolean;
} & Pick<
  ConversationType,
  | 'about'
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'color'
  | 'groupId'
  | 'id'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'type'
  | 'serviceId'
>;

type PropsHousekeepingType = {
  i18n: LocalizerType;
  onClick: (
    id: string,
    disabledReason: undefined | ContactCheckboxDisabledReason
  ) => void;
  theme: ThemeType;
};

type PropsType = PropsDataType & PropsHousekeepingType;

export const ContactCheckbox: FunctionComponent<PropsType> = React.memo(
  function ContactCheckbox({
    about,
    avatarUrl,
    badge,
    color,
    disabledReason,
    i18n,
    id,
    isChecked,
    isMe,
    onClick,
    phoneNumber,
    profileName,
    sharedGroupNames,
    theme,
    title,
    type,
  }) {
    const disabled = Boolean(disabledReason);

    const headerName = isMe ? (
      <ContactName
        module={HEADER_CONTACT_NAME_CLASS_NAME}
        title={i18n('icu:noteToSelf')}
        isMe={isMe}
      />
    ) : (
      <ContactName module={HEADER_CONTACT_NAME_CLASS_NAME} title={title} />
    );

    let messageText: undefined | string | JSX.Element;
    if (disabledReason === ContactCheckboxDisabledReason.AlreadyAdded) {
      messageText = i18n('icu:alreadyAMember');
    } else if (about) {
      messageText = <About className="" text={about} />;
    }

    const onClickItem = () => {
      onClick(id, disabledReason);
    };

    return (
      <ListTile.checkbox
        clickable
        disabled={disabled}
        isChecked={isChecked}
        leading={
          <Avatar
            avatarUrl={avatarUrl}
            color={color}
            conversationType={type}
            noteToSelf={Boolean(isMe)}
            i18n={i18n}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            sharedGroupNames={sharedGroupNames}
            size={AvatarSize.THIRTY_TWO}
            // appease the type checker.
            {...(badge ? { badge, theme } : { badge: undefined })}
          />
        }
        title={headerName}
        subtitle={isMe ? undefined : messageText}
        subtitleMaxLines={1}
        onClick={onClickItem}
      />
    );
  }
);
