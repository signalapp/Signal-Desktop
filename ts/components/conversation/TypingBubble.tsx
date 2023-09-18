// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import classNames from 'classnames';

import { TypingAnimation } from './TypingAnimation';
import { Avatar } from '../Avatar';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { BadgeType } from '../../badges/types';

const MAX_AVATARS_COUNT = 3;

export type PropsType = {
  conversationId: string;
  conversationType: 'group' | 'direct';
  showContactModal: (contactId: string, conversationId?: string) => void;
  i18n: LocalizerType;
  theme: ThemeType;
  typingContacts: Array<
    Pick<
      ConversationType,
      | 'acceptedMessageRequest'
      | 'avatarPath'
      | 'color'
      | 'id'
      | 'isMe'
      | 'phoneNumber'
      | 'profileName'
      | 'sharedGroupNames'
      | 'title'
    > & {
      badge: undefined | BadgeType;
    }
  >;
};

export function TypingBubble({
  conversationId,
  conversationType,
  showContactModal,
  i18n,
  theme,
  typingContacts,
}: PropsType): ReactElement {
  const isGroup = conversationType === 'group';

  const typingContactsOverflowCount = Math.max(
    typingContacts.length - MAX_AVATARS_COUNT,
    0
  );

  return (
    <div
      className={classNames(
        'module-message',
        'module-message--incoming',
        isGroup ? 'module-message--group' : null
      )}
    >
      {isGroup && (
        <div className="module-message__typing-avatar-container">
          {typingContactsOverflowCount > 0 && (
            <div
              className="module-message__typing-avatar module-message__typing-avatar--overflow-count
            "
            >
              <div
                aria-label={i18n('icu:TypingBubble__avatar--overflow-count', {
                  count: typingContactsOverflowCount,
                })}
                className="module-Avatar"
              >
                <div className="module-Avatar__contents">
                  <div aria-hidden="true" className="module-Avatar__label">
                    +{typingContactsOverflowCount}
                  </div>
                </div>
              </div>
            </div>
          )}
          {typingContacts.slice(-1 * MAX_AVATARS_COUNT).map(contact => (
            <div key={contact.id} className="module-message__typing-avatar">
              <Avatar
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarPath={contact.avatarPath}
                badge={contact.badge}
                color={contact.color}
                conversationType="direct"
                i18n={i18n}
                isMe={contact.isMe}
                onClick={event => {
                  event.stopPropagation();
                  event.preventDefault();
                  showContactModal(contact.id, conversationId);
                }}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                theme={theme}
                title={contact.title}
                sharedGroupNames={contact.sharedGroupNames}
                size={28}
              />
            </div>
          ))}
        </div>
      )}
      <div className="module-message__container-outer">
        <div
          className={classNames(
            'module-message__container',
            'module-message__container--incoming'
          )}
        >
          <div className="module-message__typing-container">
            <TypingAnimation color="light" i18n={i18n} />
          </div>
        </div>
      </div>
    </div>
  );
}
