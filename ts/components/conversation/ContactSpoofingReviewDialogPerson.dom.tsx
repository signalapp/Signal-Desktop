// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect } from 'react';

import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import { assertDev } from '../../util/assert.std.js';

import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { ContactName } from './ContactName.dom.js';
import { SharedGroupNames } from '../SharedGroupNames.dom.js';
import { UserText } from '../UserText.dom.js';
import { I18n } from '../I18n.dom.js';

export type PropsType = Readonly<{
  children?: ReactNode;
  conversation: ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClick?: () => void;
  toggleSignalConnectionsModal: () => void;
  updateSharedGroups: (conversationId: string) => void;
  theme: ThemeType;
  oldName: string | undefined;
  isSignalConnection: boolean;
}>;

export function ContactSpoofingReviewDialogPerson({
  children,
  conversation,
  getPreferredBadge,
  i18n,
  onClick,
  toggleSignalConnectionsModal,
  updateSharedGroups,
  theme,
  oldName,
  isSignalConnection,
}: PropsType): JSX.Element {
  assertDev(
    conversation.type === 'direct',
    '<ContactSpoofingReviewDialogPerson> expected a direct conversation'
  );

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(conversation.id);
  }, [conversation.id, updateSharedGroups]);

  const newName = conversation.profileName || conversation.title;

  let callout: JSX.Element | undefined;
  if (oldName && oldName !== newName) {
    callout = (
      <div className="module-ContactSpoofingReviewDialogPerson__info__property">
        <i className="module-ContactSpoofingReviewDialogPerson__info__property__icon module-ContactSpoofingReviewDialogPerson__info__property__icon--person" />
        <div>
          <I18n
            i18n={i18n}
            id="icu:ContactSpoofingReviewDialog__group__name-change-info"
            components={{
              oldName: <UserText text={oldName} />,
              newName: <UserText text={newName} />,
            }}
          />
        </div>
      </div>
    );
  }

  const name = (
    <ContactName
      module="module-ContactSpoofingReviewDialogPerson__info__contact-name"
      title={conversation.title}
    />
  );

  const contents = (
    <>
      <Avatar
        {...conversation}
        badge={getPreferredBadge(conversation.badges)}
        conversationType={conversation.type}
        size={AvatarSize.FORTY_EIGHT}
        className="module-ContactSpoofingReviewDialogPerson__avatar"
        i18n={i18n}
        theme={theme}
        onClick={onClick}
      />
      <div className="module-ContactSpoofingReviewDialogPerson__info">
        {onClick ? (
          <button
            type="button"
            className="module-ContactSpoofingReviewDialogPerson"
            onClick={onClick}
          >
            {name}
          </button>
        ) : (
          name
        )}
        {callout}
        {conversation.phoneNumber ? (
          <div className="module-ContactSpoofingReviewDialogPerson__info__property">
            <i className="module-ContactSpoofingReviewDialogPerson__info__property__icon module-ContactSpoofingReviewDialogPerson__info__property__icon--phone" />
            <div>{conversation.phoneNumber}</div>
          </div>
        ) : null}
        {isSignalConnection ? (
          <div className="module-ContactSpoofingReviewDialogPerson__info__property">
            <i className="module-ContactSpoofingReviewDialogPerson__info__property__icon module-ContactSpoofingReviewDialogPerson__info__property__icon--connections" />
            <button
              type="button"
              className="module-ContactSpoofingReviewDialogPerson__info__property__signal-connection"
              onClick={toggleSignalConnectionsModal}
            >
              {i18n('icu:ContactSpoofingReviewDialog__signal-connection')}
            </button>
          </div>
        ) : null}
        <div className="module-ContactSpoofingReviewDialogPerson__info__property">
          <i className="module-ContactSpoofingReviewDialogPerson__info__property__icon module-ContactSpoofingReviewDialogPerson__info__property__icon--group" />
          <div>
            {conversation.sharedGroupNames?.length ? (
              <SharedGroupNames
                i18n={i18n}
                sharedGroupNames={conversation.sharedGroupNames || []}
              />
            ) : (
              i18n(
                'icu:ContactSpoofingReviewDialog__group__members__no-shared-groups'
              )
            )}
          </div>
        </div>
        {children}
      </div>
    </>
  );

  return (
    <div className="module-ContactSpoofingReviewDialogPerson">{contents}</div>
  );
}
