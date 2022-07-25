// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';

import { Avatar, AvatarSize } from '../Avatar';
import { ContactName } from './ContactName';
import { ContextMenu } from '../ContextMenu';
import { Time } from '../Time';
import type {
  Props as MessagePropsType,
  PropsData as MessagePropsDataType,
} from './Message';
import { Message } from './Message';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { groupBy } from '../../util/mapUtil';
import type { ContactNameColorType } from '../../types/Colors';
import { SendStatus } from '../../messages/MessageSendState';
import { WidthBreakpoint } from '../_util';
import * as log from '../../logging/log';
import { formatDateTimeLong } from '../../util/timestamp';

export type Contact = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'badges'
  | 'color'
  | 'id'
  | 'isMe'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'unblurredAvatarPath'
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
  message: Omit<MessagePropsDataType, 'renderingContext'>;
  receivedAt: number;
  sentAt: number;

  showSafetyNumber: (contactId: string) => void;
  i18n: LocalizerType;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
} & Pick<MessagePropsType, 'getPreferredBadge' | 'interactionMode'>;

export type PropsBackboneActions = Pick<
  MessagePropsType,
  | 'displayTapToViewMessage'
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'markViewed'
  | 'openConversation'
  | 'openGiftBadge'
  | 'openLink'
  | 'reactToMessage'
  | 'renderAudioAttachment'
  | 'renderEmojiPicker'
  | 'renderReactionPicker'
  | 'replyToMessage'
  | 'retryDeleteForEveryone'
  | 'retrySend'
  | 'showContactDetail'
  | 'showContactModal'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
  | 'showForwardMessageModal'
  | 'showVisualAttachment'
  | 'startConversation'
>;

export type PropsReduxActions = Pick<
  MessagePropsType,
  | 'clearSelectedMessage'
  | 'doubleCheckMissingQuoteReference'
  | 'checkForAccount'
  | 'viewStory'
>;

export type ExternalProps = PropsData & PropsBackboneActions;
export type Props = PropsData & PropsBackboneActions & PropsReduxActions;

const contactSortCollator = new Intl.Collator();

const _keyForError = (error: Error): string => {
  return `${error.name}-${error.message}`;
};

export class MessageDetail extends React.Component<Props> {
  private readonly focusRef = React.createRef<HTMLDivElement>();
  private readonly messageContainerRef = React.createRef<HTMLDivElement>();

  public override componentDidMount(): void {
    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (this.focusRef.current) {
        this.focusRef.current.focus();
      }
    });
  }

  public renderAvatar(contact: Contact): JSX.Element {
    const { getPreferredBadge, i18n, theme } = this.props;
    const {
      acceptedMessageRequest,
      avatarPath,
      badges,
      color,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
      unblurredAvatarPath,
    } = contact;

    return (
      <Avatar
        acceptedMessageRequest={acceptedMessageRequest}
        avatarPath={avatarPath}
        badge={getPreferredBadge(badges)}
        color={color}
        conversationType="direct"
        i18n={i18n}
        isMe={isMe}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        theme={theme}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.THIRTY_SIX}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }

  public renderContact(contact: Contact): JSX.Element {
    const { i18n, showSafetyNumber } = this.props;
    const errors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          type="button"
          className="module-message-detail__contact__show-safety-number"
          onClick={() => showSafetyNumber(contact.id)}
        >
          {i18n('showSafetyNumber')}
        </button>
      </div>
    ) : null;
    const unidentifiedDeliveryComponent = contact.isUnidentifiedDelivery ? (
      <div className="module-message-detail__contact__unidentified-delivery-icon" />
    ) : null;

    return (
      <div key={contact.id} className="module-message-detail__contact">
        {this.renderAvatar(contact)}
        <div className="module-message-detail__contact__text">
          <div className="module-message-detail__contact__name">
            <ContactName title={contact.title} />
          </div>
          {errors.map(error => (
            <div
              key={_keyForError(error)}
              className="module-message-detail__contact__error"
            >
              {error.message}
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

  private renderContactGroup(
    sendStatus: undefined | SendStatus,
    contacts: undefined | ReadonlyArray<Contact>
  ): ReactNode {
    const { i18n } = this.props;
    if (!contacts || !contacts.length) {
      return null;
    }

    const i18nKey =
      sendStatus === undefined ? 'from' : `MessageDetailsHeader--${sendStatus}`;

    const sortedContacts = [...contacts].sort((a, b) =>
      contactSortCollator.compare(a.title, b.title)
    );

    return (
      <div key={i18nKey} className="module-message-detail__contact-group">
        <div
          className={classNames(
            'module-message-detail__contact-group__header',
            sendStatus &&
              `module-message-detail__contact-group__header--${sendStatus}`
          )}
        >
          {i18n(i18nKey)}
        </div>
        {sortedContacts.map(contact => this.renderContact(contact))}
      </div>
    );
  }

  private renderContacts(): ReactChild {
    // This assumes that the list either contains one sender (a status of `undefined`) or
    //   1+ contacts with `SendStatus`es, but it doesn't check that assumption.
    const { contacts } = this.props;

    const contactsBySendStatus = groupBy(contacts, contact => contact.status);

    return (
      <div className="module-message-detail__contact-container">
        {[
          undefined,
          SendStatus.Failed,
          SendStatus.Viewed,
          SendStatus.Read,
          SendStatus.Delivered,
          SendStatus.Sent,
          SendStatus.Pending,
        ].map(sendStatus =>
          this.renderContactGroup(
            sendStatus,
            contactsBySendStatus.get(sendStatus)
          )
        )}
      </div>
    );
  }

  public override render(): JSX.Element {
    const {
      errors,
      message,
      receivedAt,
      sentAt,

      checkForAccount,
      clearSelectedMessage,
      contactNameColor,
      displayTapToViewMessage,
      doubleCheckMissingQuoteReference,
      getPreferredBadge,
      i18n,
      interactionMode,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      markViewed,
      openConversation,
      openGiftBadge,
      openLink,
      reactToMessage,
      renderAudioAttachment,
      renderEmojiPicker,
      renderReactionPicker,
      replyToMessage,
      retryDeleteForEveryone,
      retrySend,
      showContactDetail,
      showContactModal,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showForwardMessageModal,
      showVisualAttachment,
      startConversation,
      theme,
      viewStory,
    } = this.props;

    return (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      <div className="module-message-detail" tabIndex={0} ref={this.focusRef}>
        <div
          className="module-message-detail__message-container"
          ref={this.messageContainerRef}
        >
          <Message
            {...message}
            renderingContext="conversation/MessageDetail"
            checkForAccount={checkForAccount}
            clearSelectedMessage={clearSelectedMessage}
            contactNameColor={contactNameColor}
            containerElementRef={this.messageContainerRef}
            containerWidthBreakpoint={WidthBreakpoint.Wide}
            deleteMessage={() =>
              log.warn('MessageDetail: deleteMessage called!')
            }
            deleteMessageForEveryone={() =>
              log.warn('MessageDetail: deleteMessageForEveryone called!')
            }
            disableMenu
            disableScroll
            displayLimit={Number.MAX_SAFE_INTEGER}
            displayTapToViewMessage={displayTapToViewMessage}
            downloadAttachment={() =>
              log.warn('MessageDetail: deleteMessageForEveryone called!')
            }
            doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            interactionMode={interactionMode}
            kickOffAttachmentDownload={kickOffAttachmentDownload}
            markAttachmentAsCorrupted={markAttachmentAsCorrupted}
            markViewed={markViewed}
            messageExpanded={noop}
            openConversation={openConversation}
            openGiftBadge={openGiftBadge}
            openLink={openLink}
            reactToMessage={reactToMessage}
            renderAudioAttachment={renderAudioAttachment}
            renderEmojiPicker={renderEmojiPicker}
            renderReactionPicker={renderReactionPicker}
            replyToMessage={replyToMessage}
            retryDeleteForEveryone={retryDeleteForEveryone}
            retrySend={retrySend}
            shouldCollapseAbove={false}
            shouldCollapseBelow={false}
            shouldHideMetadata={false}
            showForwardMessageModal={showForwardMessageModal}
            scrollToQuotedMessage={() => {
              log.warn('MessageDetail: scrollToQuotedMessage called!');
            }}
            showContactDetail={showContactDetail}
            showContactModal={showContactModal}
            showExpiredIncomingTapToViewToast={
              showExpiredIncomingTapToViewToast
            }
            showExpiredOutgoingTapToViewToast={
              showExpiredOutgoingTapToViewToast
            }
            showMessageDetail={() => {
              log.warn('MessageDetail: deleteMessageForEveryone called!');
            }}
            showVisualAttachment={showVisualAttachment}
            startConversation={startConversation}
            theme={theme}
            viewStory={viewStory}
          />
        </div>
        <table className="module-message-detail__info">
          <tbody>
            {(errors || []).map(error => (
              <tr key={_keyForError(error)}>
                <td className="module-message-detail__label">
                  {i18n('error')}
                </td>
                <td>
                  {' '}
                  <span className="error-message">{error.message}</span>{' '}
                </td>
              </tr>
            ))}
            <tr>
              <td className="module-message-detail__label">{i18n('sent')}</td>
              <td>
                <ContextMenu
                  i18n={i18n}
                  menuOptions={[
                    {
                      icon: 'StoryDetailsModal__copy-icon',
                      label: i18n('StoryDetailsModal__copy-timestamp'),
                      onClick: () => {
                        window.navigator.clipboard.writeText(String(sentAt));
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
                  {i18n('received')}
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
          </tbody>
        </table>
        {this.renderContacts()}
      </div>
    );
  }
}
