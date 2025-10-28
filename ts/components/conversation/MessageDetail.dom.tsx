// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ReactNode } from 'react';
import React, { useRef } from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { ContactName } from './ContactName.dom.js';
import { ContextMenu } from '../ContextMenu.dom.js';
import { Time } from '../Time.dom.js';
import type {
  Props as MessagePropsType,
  PropsData as MessagePropsDataType,
} from './Message.dom.js';
import { Message } from './Message.dom.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import { groupBy } from '../../util/mapUtil.std.js';
import type { ContactNameColorType } from '../../types/Colors.std.js';
import {
  SendStatus,
  type VisibleSendStatus,
} from '../../messages/MessageSendState.std.js';
import { WidthBreakpoint } from '../_util.std.js';
import { createLogger } from '../../logging/log.std.js';
import { formatDateTimeLong } from '../../util/formatTimestamp.dom.js';
import { DurationInSeconds } from '../../util/durations/index.std.js';
import { format as formatRelativeTime } from '../../util/expirationTimer.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { PanelRow } from './conversation-details/PanelRow.dom.js';
import { PanelSection } from './conversation-details/PanelSection.dom.js';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation-details/ConversationDetailsIcon.dom.js';

const { noop } = lodash;

const log = createLogger('MessageDetail');

export type Contact = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'badges'
  | 'color'
  | 'id'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  status?: SendStatus;
  statusTimestamp?: number;

  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: Array<Error>;
};

export type PropsData = {
  // An undefined status means they were the sender and it's an incoming message. If
  //   `undefined` is a status, there should be no other items in the array; if there are
  //   any defined statuses, `undefined` shouldn't be present.
  contacts: ReadonlyArray<Contact>;

  contactNameColor?: ContactNameColorType;
  errors: Array<Error>;
  message: Omit<
    MessagePropsDataType,
    'renderingContext' | 'menu' | 'contextMenu' | 'showMenu'
  >;
  receivedAt: number;
  sentAt: number;

  i18n: LocalizerType;
  platform: string;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
} & Pick<MessagePropsType, 'getPreferredBadge' | 'interactionMode'>;

export type PropsSmartActions = Pick<MessagePropsType, 'renderAudioAttachment'>;

export type PropsReduxActions = Pick<
  MessagePropsType,
  | 'cancelAttachmentDownload'
  | 'checkForAccount'
  | 'clearTargetedMessage'
  | 'doubleCheckMissingQuoteReference'
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'messageExpanded'
  | 'openGiftBadge'
  | 'pushPanelForConversation'
  | 'retryMessageSend'
  | 'sendPollVote'
  | 'saveAttachment'
  | 'saveAttachments'
  | 'showContactModal'
  | 'showConversation'
  | 'showEditHistoryModal'
  | 'showAttachmentDownloadStillInProgressToast'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
  | 'showLightbox'
  | 'showLightboxForViewOnceMedia'
  | 'showMediaNoLongerAvailableToast'
  | 'showSpoiler'
  | 'showTapToViewNotAvailableModal'
  | 'startConversation'
  | 'viewStory'
> & {
  toggleSafetyNumberModal: (contactId: string) => void;
};

export type Props = PropsData & PropsSmartActions & PropsReduxActions;

const contactSortCollator = new Intl.Collator();

const _keyForError = (error: Error): string => {
  return `${error.name}-${error.message}`;
};

export function MessageDetail({
  contacts,
  errors,
  message,
  receivedAt,
  sentAt,
  cancelAttachmentDownload,
  checkForAccount,
  clearTargetedMessage,
  contactNameColor,
  doubleCheckMissingQuoteReference,
  getPreferredBadge,
  i18n,
  interactionMode,
  kickOffAttachmentDownload,
  markAttachmentAsCorrupted,
  messageExpanded,
  openGiftBadge,
  platform,
  pushPanelForConversation,
  retryMessageSend,
  sendPollVote,
  renderAudioAttachment,
  saveAttachment,
  saveAttachments,
  showContactModal,
  showConversation,
  showEditHistoryModal,
  showAttachmentDownloadStillInProgressToast,
  showExpiredIncomingTapToViewToast,
  showExpiredOutgoingTapToViewToast,
  showLightbox,
  showLightboxForViewOnceMedia,
  showMediaNoLongerAvailableToast,
  showSpoiler,
  showTapToViewNotAvailableModal,
  startConversation,
  theme,
  toggleSafetyNumberModal,
  viewStory,
}: Props): JSX.Element {
  const messageDetailRef = useRef<HTMLDivElement>(null);

  function renderAvatar(contact: Contact): JSX.Element {
    const {
      avatarUrl,
      badges,
      color,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
    } = contact;

    return (
      <Avatar
        avatarUrl={avatarUrl}
        badge={getPreferredBadge(badges)}
        color={color}
        conversationType="direct"
        i18n={i18n}
        phoneNumber={phoneNumber}
        profileName={profileName}
        theme={theme}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.THIRTY_TWO}
      />
    );
  }

  function renderContact(contact: Contact): JSX.Element {
    const contactErrors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          type="button"
          className="module-message-detail__contact__show-safety-number"
          onClick={() => toggleSafetyNumberModal(contact.id)}
        >
          {i18n('icu:showSafetyNumber')}
        </button>
      </div>
    ) : null;
    const unidentifiedDeliveryComponent = contact.isUnidentifiedDelivery ? (
      <div className="module-message-detail__contact__unidentified-delivery-icon" />
    ) : null;

    return (
      <div key={contact.id} className="module-message-detail__contact">
        {renderAvatar(contact)}
        <div className="module-message-detail__contact__text">
          <div className="module-message-detail__contact__name">
            <ContactName title={contact.title} />
          </div>
          {contactErrors.map(contactError => (
            <div
              key={_keyForError(contactError)}
              className="module-message-detail__contact__error"
            >
              {contactError.message}
            </div>
          ))}
        </div>
        {errorComponent}
        {unidentifiedDeliveryComponent}
        {contact.statusTimestamp && (
          <Time
            className="module-message-detail__status-timestamp"
            timestamp={contact.statusTimestamp}
          >
            {formatDateTimeLong(i18n, contact.statusTimestamp)}
          </Time>
        )}
      </div>
    );
  }

  function renderContactGroupHeaderText(
    sendStatus: undefined | VisibleSendStatus
  ): string {
    if (sendStatus === undefined) {
      return i18n('icu:from');
    }

    switch (sendStatus) {
      case SendStatus.Failed:
        return i18n('icu:MessageDetailsHeader--Failed');
      case SendStatus.Pending:
        return i18n('icu:MessageDetailsHeader--Pending');
      case SendStatus.Sent:
        return i18n('icu:MessageDetailsHeader--Sent');
      case SendStatus.Delivered:
        return i18n('icu:MessageDetailsHeader--Delivered');
      case SendStatus.Read:
        return i18n('icu:MessageDetailsHeader--Read');
      case SendStatus.Viewed:
        return i18n('icu:MessageDetailsHeader--Viewed');
      default:
        throw missingCaseError(sendStatus);
    }
  }

  function renderContactGroup(
    sendStatus: undefined | VisibleSendStatus,
    statusContacts: undefined | ReadonlyArray<Contact>
  ): ReactNode {
    if (!statusContacts || !statusContacts.length) {
      return null;
    }

    const sortedContacts = [...statusContacts].sort((a, b) =>
      contactSortCollator.compare(a.title, b.title)
    );

    const headerText = renderContactGroupHeaderText(sendStatus);

    return (
      <div key={headerText} className="module-message-detail__contact-group">
        <div
          className={classNames(
            'module-message-detail__contact-group__header',
            sendStatus &&
              `module-message-detail__contact-group__header--${sendStatus}`
          )}
        >
          {headerText}
        </div>
        {sortedContacts.map(contact => renderContact(contact))}
      </div>
    );
  }

  function renderContacts(): ReactChild {
    // This assumes that the list either contains one sender (a status of `undefined`) or
    //   1+ contacts with `SendStatus`es, but it doesn't check that assumption.
    const contactsBySendStatus = groupBy(contacts, contact => contact.status);

    return (
      <div className="module-message-detail__contact-container">
        {(
          [
            undefined,
            SendStatus.Failed,
            SendStatus.Viewed,
            SendStatus.Read,
            SendStatus.Delivered,
            SendStatus.Sent,
            SendStatus.Pending,
          ] as Array<VisibleSendStatus | undefined>
        ).map(sendStatus =>
          renderContactGroup(sendStatus, contactsBySendStatus.get(sendStatus))
        )}
      </div>
    );
  }

  const timeRemaining = message.expirationTimestamp
    ? DurationInSeconds.fromMillis(message.expirationTimestamp - Date.now())
    : undefined;

  return (
    <div className="module-message-detail" ref={messageDetailRef}>
      <PanelSection>
        <div className="module-message-detail__message-container">
          <Message
            {...message}
            renderingContext="conversation/MessageDetail"
            cancelAttachmentDownload={cancelAttachmentDownload}
            checkForAccount={checkForAccount}
            clearTargetedMessage={clearTargetedMessage}
            contactNameColor={contactNameColor}
            containerElementRef={messageDetailRef}
            containerWidthBreakpoint={WidthBreakpoint.Wide}
            renderMenu={undefined}
            disableScroll
            displayLimit={Number.MAX_SAFE_INTEGER}
            showLightboxForViewOnceMedia={showLightboxForViewOnceMedia}
            doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            interactionMode={interactionMode}
            kickOffAttachmentDownload={kickOffAttachmentDownload}
            markAttachmentAsCorrupted={markAttachmentAsCorrupted}
            messageExpanded={messageExpanded}
            openGiftBadge={openGiftBadge}
            platform={platform}
            pushPanelForConversation={pushPanelForConversation}
            retryMessageSend={retryMessageSend}
            sendPollVote={sendPollVote}
            renderAudioAttachment={renderAudioAttachment}
            saveAttachment={saveAttachment}
            saveAttachments={saveAttachments}
            shouldCollapseAbove={false}
            shouldCollapseBelow={false}
            shouldHideMetadata={false}
            showConversation={showConversation}
            showSpoiler={showSpoiler}
            scrollToQuotedMessage={() => {
              log.warn('scrollToQuotedMessage called!');
            }}
            showContactModal={showContactModal}
            showAttachmentDownloadStillInProgressToast={
              showAttachmentDownloadStillInProgressToast
            }
            showTapToViewNotAvailableModal={showTapToViewNotAvailableModal}
            showExpiredIncomingTapToViewToast={
              showExpiredIncomingTapToViewToast
            }
            showExpiredOutgoingTapToViewToast={
              showExpiredOutgoingTapToViewToast
            }
            showLightbox={showLightbox}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            startConversation={startConversation}
            theme={theme}
            viewStory={viewStory}
            onToggleSelect={noop}
            onReplyToMessage={noop}
          />
        </div>
        <table className="module-message-detail__info">
          <tbody>
            {(errors || []).map(error => (
              <tr key={_keyForError(error)}>
                <td className="module-message-detail__label">
                  {i18n('icu:error')}
                </td>
                <td>
                  {' '}
                  <span className="error-message">{error.message}</span>{' '}
                </td>
              </tr>
            ))}
            <tr>
              <td className="module-message-detail__label">
                {i18n('icu:sent')}
              </td>
              <td>
                <ContextMenu
                  i18n={i18n}
                  menuOptions={[
                    {
                      icon: 'StoryDetailsModal__copy-icon',
                      label: i18n('icu:StoryDetailsModal__copy-timestamp'),
                      onClick: () => {
                        void window.navigator.clipboard.writeText(
                          String(sentAt)
                        );
                      },
                    },
                  ]}
                >
                  <>
                    <Time timestamp={sentAt}>
                      {formatDateTimeLong(i18n, sentAt)}
                    </Time>{' '}
                    <span className="module-message-detail__unix-timestamp">
                      ({sentAt})
                    </span>
                  </>
                </ContextMenu>
              </td>
            </tr>
            {receivedAt && message.direction === 'incoming' ? (
              <tr>
                <td className="module-message-detail__label">
                  {i18n('icu:received')}
                </td>
                <td>
                  <Time timestamp={receivedAt}>
                    {formatDateTimeLong(i18n, receivedAt)}
                  </Time>{' '}
                  <span className="module-message-detail__unix-timestamp">
                    ({receivedAt})
                  </span>
                </td>
              </tr>
            ) : null}
            {timeRemaining && timeRemaining > 0 && (
              <tr>
                <td className="module-message-detail__label">
                  {i18n('icu:MessageDetail--disappears-in')}
                </td>
                <td>
                  {formatRelativeTime(i18n, timeRemaining, {
                    largest: 2,
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PanelSection>
      {message.isEditedMessage && (
        <PanelSection>
          <PanelRow
            icon={
              <ConversationDetailsIcon
                ariaLabel={i18n('icu:MessageDetail__view-edits')}
                icon={IconType.edit}
              />
            }
            label={i18n('icu:MessageDetail__view-edits')}
            onClick={() => {
              showEditHistoryModal?.(message.id);
            }}
          />
        </PanelSection>
      )}

      <PanelSection>{renderContacts()}</PanelSection>
    </div>
  );
}
