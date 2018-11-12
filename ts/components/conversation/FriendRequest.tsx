import React from 'react';
// import classNames from 'classnames';

import { Localizer } from '../../types/Util';
import { MessageBody } from './MessageBody';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

interface Props {
  text?: string;
  direction: 'incoming' | 'outgoing';
  source: Contact;
  target: Contact;
  i18n: Localizer;
  friendStatus: 'pending' | 'accepted' | 'declined';
  onAccept: () => void;
  onDecline: () => void;
  onDelete: () => void;
}

export class FriendRequest extends React.Component<Props> {
  public getStringId() {
    const { friendStatus, direction } = this.props;

    switch (friendStatus) {
      case 'pending':
        return `${direction}FriendRequestPending`;
      case 'accepted':
        return `friendRequestAccepted`;
      case 'declined':
        return `friendRequestDeclined`;
      default:
        throw new Error(`Invalid friend request status: ${friendStatus}`);
    }
  }

  public renderContents() {
    const { direction, i18n, text } = this.props;
    const id = this.getStringId();

    return (
      <div>
        <div className={`module-friend-request__title module-friend-request__title--${direction}`}>{i18n(id)}</div>
        {!!text &&
          <div dir="auto">
            <MessageBody text={text || ''} i18n={i18n} />
          </div>
        }
      </div>
      
    );
  }

  public renderButtons() {
      const { friendStatus, direction, onAccept, onDecline, onDelete } = this.props;

      if (direction === 'incoming') {
        if (friendStatus === 'pending') {
          return (
              <div className={`module-message__metadata module-friend-request__buttonContainer module-friend-request__buttonContainer--${direction}`}>
                <button onClick={onAccept}>Accept</button>
                <button onClick={onDecline}>Decline</button>
              </div>
          );
        } else if (friendStatus === 'declined') {
          return (
            <div className={`module-message__metadata module-friend-request__buttonContainer module-friend-request__buttonContainer--${direction}`}>
              <button onClick={onDelete}>Delete Conversation</button>
            </div>
          );
        }
      }
      return null;
  }

  public render() {
    const { direction } = this.props;

    return (
      <div className={`module-message module-message--${direction} module-message-friend-request`}>
        <div className={`module-message__container module-message__container--${direction} module-message-friend-request__container`}>
            <div className={`module-message__text module-message__text--${direction}`}>
                {this.renderContents()}
                {this.renderButtons()}
            </div>
        </div>
      </div>
    );
  }
}
