// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useRef } from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';
import { ContextMenu } from '../ContextMenu.dom.tsx';
import { Time } from '../Time.dom.tsx';
import type {
  Props as MessagePropsType,
  PropsData as MessagePropsDataType,
} from './Message.dom.tsx';
import { Message, MessageInteractivity } from './Message.dom.tsx';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import { groupBy } from '../../util/mapUtil.std.ts';
import type { ContactNameColorType } from '../../types/Colors.std.ts';
import {
  SendStatus,
  type VisibleSendStatus,
} from '../../messages/MessageSendState.std.ts';
import { WidthBreakpoint } from '../_util.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { formatDateTimeLong } from '../../util/formatTimestamp.dom.ts';
import { DurationInSeconds } from '../../util/durations/index.std.ts';
import { format as formatRelativeTime } from '../../util/expirationTimer.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { PanelRow } from './conversation-details/PanelRow.dom.tsx';
import { PanelSection } from './conversation-details/PanelSection.dom.tsx';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation-details/ConversationDetailsIcon.dom.tsx';

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
  | 'title'
> & {
  status?: SendStatus;
  statusTimestamp?: number;

  isOutgoingKeyError: boolean;
  isUnidentifiedDelivery: boolean;

  errors?: ReadonlyArray<Error>;
};

export type PropsData = {
  // An undefined status means they were the sender and it's an incoming message. If
  //   `undefined` is a status, there should be no other items in the array; if there are
  //   any defined statuses, `undefined` shouldn't be present.
  contacts: ReadonlyArray<Contact>;

  contactNameColor?: ContactNameColorType;
  errors: ReadonlyArray<Error>;
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
  | 'endPoll'
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
  | 'retryDeleteForEveryone'
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
  endPoll,
  getPreferredBadge,
  i18n,
  interactionMode,
  kickOffAttachmentDownload,
  markAttachmentAsCorrupted,
  messageExpanded,
  openGiftBadge,
  platform,
  pushPanelForConversation,
  retryDeleteForEveryone,
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
}: Props): React.JSX.Element {
  const messageDetailRef = useRef<HTMLDivElement>(null);

  function renderAvatar(contact: Contact): React.JSX.Element {
    const { avatarUrl, badges, color, phoneNumber, profileName, title } =
      contact;

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
        size={AvatarSize.THIRTY_TWO}
      />
    );
  }

  function renderContact(contact: Contact): React.JSX.Element {
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

  function renderContacts(): ReactNode {
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
            endPoll={endPoll}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            interactivity={MessageInteractivity.Static}
            interactionMode={interactionMode}
            kickOffAttachmentDownload={kickOffAttachmentDownload}
            markAttachmentAsCorrupted={markAttachmentAsCorrupted}
            messageExpanded={messageExpanded}
            openGiftBadge={openGiftBadge}
            platform={platform}
            pushPanelForConversation={pushPanelForConversation}
            retryDeleteForEveryone={retryDeleteForEveryone}
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
