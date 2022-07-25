// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import formatFileSize from 'filesize';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { StorySendStateType, StoryViewType } from '../types/Stories';
import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { ContextMenu } from './ContextMenu';
import { Intl } from './Intl';
import { Modal } from './Modal';
import { SendStatus } from '../messages/MessageSendState';
import { Theme } from '../util/theme';
import { ThemeType } from '../types/Util';
import { Time } from './Time';
import { formatDateTimeLong } from '../util/timestamp';
import { groupBy } from '../util/mapUtil';

export type PropsType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onClose: () => unknown;
  sender: StoryViewType['sender'];
  sendState?: Array<StorySendStateType>;
  size?: number;
  timestamp: number;
};

const contactSortCollator = new window.Intl.Collator();

function getI18nKey(sendStatus: SendStatus | undefined): string {
  if (sendStatus === SendStatus.Failed) {
    return 'MessageDetailsHeader--Failed';
  }

  if (sendStatus === SendStatus.Viewed) {
    return 'MessageDetailsHeader--Viewed';
  }

  if (sendStatus === SendStatus.Read) {
    return 'MessageDetailsHeader--Read';
  }

  if (sendStatus === SendStatus.Delivered) {
    return 'MessageDetailsHeader--Delivered';
  }

  if (sendStatus === SendStatus.Sent) {
    return 'MessageDetailsHeader--Sent';
  }

  if (sendStatus === SendStatus.Pending) {
    return 'MessageDetailsHeader--Pending';
  }

  return 'from';
}

export const StoryDetailsModal = ({
  getPreferredBadge,
  i18n,
  onClose,
  sender,
  sendState,
  size,
  timestamp,
}: PropsType): JSX.Element => {
  const contactsBySendStatus = sendState
    ? groupBy(sendState, contact => contact.status)
    : undefined;

  let content: JSX.Element;
  if (contactsBySendStatus) {
    content = (
      <div className="StoryDetailsModal__contact-container">
        {[
          SendStatus.Failed,
          SendStatus.Viewed,
          SendStatus.Read,
          SendStatus.Delivered,
          SendStatus.Sent,
          SendStatus.Pending,
        ].map(sendStatus => {
          const contacts = contactsBySendStatus.get(sendStatus);

          if (!contacts) {
            return null;
          }

          const i18nKey = getI18nKey(sendStatus);

          const sortedContacts = [...contacts].sort((a, b) =>
            contactSortCollator.compare(a.recipient.title, b.recipient.title)
          );

          return (
            <div key={i18nKey} className="StoryDetailsModal__contact-group">
              <div className="StoryDetailsModal__contact-group__header">
                {i18n(i18nKey)}
              </div>
              {sortedContacts.map(status => {
                const contact = status.recipient;

                return (
                  <div key={contact.id} className="StoryDetailsModal__contact">
                    <Avatar
                      acceptedMessageRequest={contact.acceptedMessageRequest}
                      avatarPath={contact.avatarPath}
                      badge={getPreferredBadge(contact.badges)}
                      color={contact.color}
                      conversationType="direct"
                      i18n={i18n}
                      isMe={contact.isMe}
                      name={contact.profileName}
                      phoneNumber={contact.phoneNumber}
                      profileName={contact.profileName}
                      sharedGroupNames={contact.sharedGroupNames}
                      size={AvatarSize.THIRTY_SIX}
                      theme={ThemeType.dark}
                      title={contact.title}
                      unblurredAvatarPath={contact.unblurredAvatarPath}
                    />
                    <div className="StoryDetailsModal__contact__text">
                      <ContactName title={contact.title} />
                    </div>
                    {status.updatedAt && (
                      <Time
                        className="StoryDetailsModal__status-timestamp"
                        timestamp={status.updatedAt}
                      >
                        {formatDateTimeLong(i18n, status.updatedAt)}
                      </Time>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  } else {
    content = (
      <div className="StoryDetailsModal__contact-container">
        <div className="StoryDetailsModal__contact-group">
          <div className="StoryDetailsModal__contact-group__header">
            {i18n('sent')}
          </div>
          <div className="StoryDetailsModal__contact">
            <Avatar
              acceptedMessageRequest={sender.acceptedMessageRequest}
              avatarPath={sender.avatarPath}
              badge={getPreferredBadge(sender.badges)}
              color={sender.color}
              conversationType="direct"
              i18n={i18n}
              isMe={sender.isMe}
              name={sender.profileName}
              profileName={sender.profileName}
              sharedGroupNames={sender.sharedGroupNames}
              size={AvatarSize.THIRTY_SIX}
              theme={ThemeType.dark}
              title={sender.title}
            />
            <div className="StoryDetailsModal__contact__text">
              <div className="StoryDetailsModal__contact__name">
                <ContactName title={sender.title} />
              </div>
            </div>
            <Time
              className="StoryDetailsModal__status-timestamp"
              timestamp={timestamp}
            >
              {formatDateTimeLong(i18n, timestamp)}
            </Time>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Modal
      hasXButton
      i18n={i18n}
      moduleClassName="StoryDetailsModal"
      onClose={onClose}
      useFocusTrap={false}
      theme={Theme.Dark}
      title={
        <ContextMenu
          i18n={i18n}
          menuOptions={[
            {
              icon: 'StoryDetailsModal__copy-icon',
              label: i18n('StoryDetailsModal__copy-timestamp'),
              onClick: () => {
                window.navigator.clipboard.writeText(String(timestamp));
              },
            },
          ]}
          moduleClassName="StoryDetailsModal__debugger"
          popperOptions={{
            placement: 'bottom',
            strategy: 'absolute',
          }}
          theme={Theme.Dark}
        >
          <div>
            <Intl
              i18n={i18n}
              id="StoryDetailsModal__sent-time"
              components={[
                <Time
                  className="StoryDetailsModal__debugger__button__text"
                  timestamp={timestamp}
                >
                  {formatDateTimeLong(i18n, timestamp)}
                </Time>,
              ]}
            />
          </div>
          {size && (
            <div>
              <Intl
                i18n={i18n}
                id="StoryDetailsModal__file-size"
                components={[
                  <span className="StoryDetailsModal__debugger__button__text">
                    {formatFileSize(size)}
                  </span>,
                ]}
              />
            </div>
          )}
        </ContextMenu>
      }
    >
      {content}
    </Modal>
  );
};
