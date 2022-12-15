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
import { DurationInSeconds } from '../../util/durations';
import { format as formatRelativeTime } from '../../util/expirationTimer';

export type Contact = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'badges'
  | 'color'
  | 'id'
  | 'isMe'
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
  message: Omit<
    MessagePropsDataType,
    'renderingContext' | 'menu' | 'contextMenu' | 'showMenu'
  >;
  receivedAt: number;
  sentAt: number;

  i18n: LocalizerType;
  theme: ThemeType;
  getPreferredBadge: PreferredBadgeSelectorType;
  markViewed: (messageId: string) => void;
} & Pick<
  MessagePropsType,
  | 'getPreferredBadge'
  | 'interactionMode'
  | 'expirationLength'
  | 'expirationTimestamp'
>;

export type PropsBackboneActions = Pick<
  MessagePropsType,
  | 'kickOffAttachmentDownload'
  | 'markAttachmentAsCorrupted'
  | 'openGiftBadge'
  | 'openLink'
  | 'renderAudioAttachment'
  | 'showExpiredIncomingTapToViewToast'
  | 'showExpiredOutgoingTapToViewToast'
  | 'startConversation'
>;

export type PropsReduxActions = Pick<
  MessagePropsType,
  | 'checkForAccount'
  | 'clearSelectedMessage'
  | 'doubleCheckMissingQuoteReference'
  | 'pushPanelForConversation'
  | 'saveAttachment'
  | 'showContactModal'
  | 'showConversation'
  | 'showLightbox'
  | 'showLightboxForViewOnceMedia'
  | 'viewStory'
> & {
  toggleSafetyNumberModal: (contactId: string) => void;
};

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
        phoneNumber={phoneNumber}
        profileName={profileName}
        theme={theme}
        title={title}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.THIRTY_TWO}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }

  public renderContact(contact: Contact): JSX.Element {
    const { i18n, toggleSafetyNumberModal } = this.props;
    const errors = contact.errors || [];

    const errorComponent = contact.isOutgoingKeyError ? (
      <div className="module-message-detail__contact__error-buttons">
        <button
          type="button"
          className="module-message-detail__contact__show-safety-number"
          onClick={() => toggleSafetyNumberModal(contact.id)}
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
      showLightboxForViewOnceMedia,
      doubleCheckMissingQuoteReference,
      expirationTimestamp,
      getPreferredBadge,
      i18n,
      interactionMode,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      markViewed,
      openGiftBadge,
      openLink,
      pushPanelForConversation,
      renderAudioAttachment,
      saveAttachment,
      showContactModal,
      showConversation,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showLightbox,
      startConversation,
      theme,
      viewStory,
    } = this.props;

    const timeRemaining = expirationTimestamp
      ? DurationInSeconds.fromMillis(expirationTimestamp - Date.now())
      : undefined;

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
            menu={undefined}
            disableScroll
            displayLimit={Number.MAX_SAFE_INTEGER}
            showLightboxForViewOnceMedia={showLightboxForViewOnceMedia}
            doubleCheckMissingQuoteReference={doubleCheckMissingQuoteReference}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            interactionMode={interactionMode}
            kickOffAttachmentDownload={kickOffAttachmentDownload}
            markAttachmentAsCorrupted={markAttachmentAsCorrupted}
            markViewed={markViewed}
            messageExpanded={noop}
            showConversation={showConversation}
            openGiftBadge={openGiftBadge}
            openLink={openLink}
            pushPanelForConversation={pushPanelForConversation}
            renderAudioAttachment={renderAudioAttachment}
            saveAttachment={saveAttachment}
            shouldCollapseAbove={false}
            shouldCollapseBelow={false}
            shouldHideMetadata={false}
            scrollToQuotedMessage={() => {
              log.warn('MessageDetail: scrollToQuotedMessage called!');
            }}
            showContactModal={showContactModal}
            showExpiredIncomingTapToViewToast={
              showExpiredIncomingTapToViewToast
            }
            showExpiredOutgoingTapToViewToast={
              showExpiredOutgoingTapToViewToast
            }
            showMessageDetail={() => {
              log.warn('MessageDetail: showMessageDetail called!');
            }}
            showLightbox={showLightbox}
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
            {timeRemaining && timeRemaining > 0 && (
              <tr>
                <td className="module-message-detail__label">
                  {i18n('MessageDetail--disappears-in')}
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
        {this.renderContacts()}
      </div>
    );
  }
}
