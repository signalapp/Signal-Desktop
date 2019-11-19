import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';
import { MessageBody } from './MessageBody';
import { Timestamp } from './Timestamp';

interface Props {
  text: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  friendStatus: 'pending' | 'accepted' | 'declined' | 'expired';
  i18n: LocalizerType;
  isBlocked: boolean;
  timestamp: number;
  onAccept: () => void;
  onDecline: () => void;
  onDeleteConversation: () => void;
  onRetrySend: () => void;
  onBlockUser: () => void;
  onUnblockUser: () => void;
}

export class FriendRequest extends React.Component<Props> {
  public getStringId() {
    const { friendStatus } = this.props;

    switch (friendStatus) {
      case 'pending':
        return 'friendRequestPending';
      case 'accepted':
        return 'friendRequestAccepted';
      case 'declined':
        return 'friendRequestDeclined';
      case 'expired':
        return 'friendRequestExpired';
      default:
        throw new Error(`Invalid friend request status: ${friendStatus}`);
    }
  }

  public renderContents() {
    const { direction, i18n, text } = this.props;
    const id = this.getStringId();

    return (
      <div>
        <div
          className={`module-friend-request__title module-friend-request__title--${direction}`}
        >
          {i18n(id)}
        </div>
        <div dir="auto">
          <MessageBody text={text || ''} i18n={i18n} />
        </div>
      </div>
    );
  }

  public renderButtons() {
    const {
      i18n,
      friendStatus,
      direction,
      status,
      onAccept,
      onDecline,
      onDeleteConversation,
      onRetrySend,
      isBlocked,
      onBlockUser,
      onUnblockUser,
    } = this.props;

    if (direction === 'incoming') {
      if (friendStatus === 'pending') {
        return (
          <div
            className={classNames(
              'module-message__metadata',
              'module-friend-request__buttonContainer',
              `module-friend-request__buttonContainer--${direction}`
            )}
          >
            <button onClick={onAccept}>Accept</button>
            <button onClick={onDecline}>Decline</button>
          </div>
        );
      } else if (friendStatus === 'declined') {
        const blockTitle = isBlocked ? i18n('unblockUser') : i18n('blockUser');
        const blockHandler = isBlocked ? onUnblockUser : onBlockUser;

        return (
          <div
            className={classNames(
              'module-message__metadata',
              'module-friend-request__buttonContainer',
              `module-friend-request__buttonContainer--${direction}`
            )}
          >
            <button onClick={onDeleteConversation}>Delete Conversation</button>
            <button onClick={blockHandler}>{blockTitle}</button>
          </div>
        );
      }
    } else {
      // Render the retry button if we errored
      if (status === 'error' && friendStatus === 'pending') {
        return (
          <div
            className={classNames(
              'module-message__metadata',
              'module-friend-request__buttonContainer',
              `module-friend-request__buttonContainer--${direction}`
            )}
          >
            <button onClick={onRetrySend}>Retry Send</button>
          </div>
        );
      }
    }

    return null;
  }

  public renderError(isCorrectSide: boolean) {
    const { status, direction } = this.props;

    if (!isCorrectSide || status !== 'error') {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`
          )}
        />
      </div>
    );
  }

  // Renders 'sending', 'read' icons
  public renderStatusIndicator() {
    const { direction, status, i18n, text, timestamp } = this.props;
    if (status === 'error') {
      return null;
    }

    const withImageNoCaption = Boolean(!text);

    return (
      <div className="module-message__metadata">
        <Timestamp
          i18n={i18n}
          timestamp={timestamp}
          extended={true}
          direction={direction}
          withImageNoCaption={withImageNoCaption}
          module="module-message__metadata__date"
        />
        <span className="module-message__metadata__spacer" />
        <div
          className={classNames(
            'module-message__metadata__status-icon',
            `module-message__metadata__status-icon--${status}`
          )}
        />
      </div>
    );
  }

  public render() {
    const { direction } = this.props;

    return (
      <div className={'loki-message-wrapper'}>
        <div
          className={classNames(
            `module-message module-message--${direction}`,
            'module-message-friend-request'
          )}
        >
          {this.renderError(direction === 'incoming')}
          <div
            className={classNames(
              'module-message__container',
              `module-message__container--${direction}`,
              'module-message-friend-request__container'
            )}
          >
            <div
              className={classNames(
                'module-message__text',
                `module-message__text--${direction}`
              )}
            >
              {this.renderContents()}
              {this.renderStatusIndicator()}
              {this.renderButtons()}
            </div>
          </div>
          {this.renderError(direction === 'outgoing')}
        </div>
      </div>
    );
  }
}
