// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { assert } from '../../util/assert';

import { Avatar, AvatarSize } from '../Avatar';
import { ContactName } from './ContactName';
import { SharedGroupNames } from '../SharedGroupNames';

type PropsType = {
  children?: ReactNode;
  conversation: ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClick?: () => void;
  theme: ThemeType;
};

export const ContactSpoofingReviewDialogPerson: FunctionComponent<
  PropsType
> = ({ children, conversation, getPreferredBadge, i18n, onClick, theme }) => {
  assert(
    conversation.type === 'direct',
    '<ContactSpoofingReviewDialogPerson> expected a direct conversation'
  );

  const contents = (
    <>
      <Avatar
        {...conversation}
        badge={getPreferredBadge(conversation.badges)}
        conversationType={conversation.type}
        size={AvatarSize.FIFTY_TWO}
        className="module-ContactSpoofingReviewDialogPerson__avatar"
        i18n={i18n}
        theme={theme}
      />
      <div className="module-ContactSpoofingReviewDialogPerson__info">
        <ContactName
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
