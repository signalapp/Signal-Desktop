// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, ReactNode } from 'react';

import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { assert } from '../../util/assert';

import { Avatar, AvatarSize } from '../Avatar';
import { ContactName } from './ContactName';
import { SharedGroupNames } from '../SharedGroupNames';

type PropsType = {
  children?: ReactNode;
  conversation: ConversationType;
  i18n: LocalizerType;
  onClick?: () => void;
};

export const ContactSpoofingReviewDialogPerson: FunctionComponent<PropsType> = ({
  children,
  conversation,
  i18n,
  onClick,
}) => {
  assert(
    conversation.type === 'direct',
    '<ContactSpoofingReviewDialogPerson> expected a direct conversation'
  );

  const contents = (
    <>
      <Avatar
        {...conversation}
        conversationType={conversation.type}
        size={AvatarSize.FIFTY_TWO}
        className="module-ContactSpoofingReviewDialogPerson__avatar"
        i18n={i18n}
      />
      <div className="module-ContactSpoofingReviewDialogPerson__info">
        <ContactName
          i18n={i18n}
          module="module-ContactSpoofingReviewDialogPerson__info__contact-name"
          title={conversation.title}
        />
        {conversation.phoneNumber ? (
          <div className="module-ContactSpoofingReviewDialogPerson__info__property">
            {conversation.phoneNumber}
          </div>
        ) : null}
        <div className="module-ContactSpoofingReviewDialogPerson__info__property">
          <SharedGroupNames
            i18n={i18n}
            sharedGroupNames={conversation.sharedGroupNames || []}
          />
        </div>
        {children}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="module-ContactSpoofingReviewDialogPerson"
        onClick={onClick}
      >
        {contents}
      </button>
    );
  }

  return (
    <div className="module-ContactSpoofingReviewDialogPerson">{contents}</div>
  );
};
