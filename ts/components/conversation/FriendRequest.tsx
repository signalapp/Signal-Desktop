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
  type: 'incoming' | 'outgoing';
  source: Contact;
  target: Contact;
  i18n: Localizer;
  status: 'pending' | 'accepted' | 'declined';
  onAccept: () => void;
  onDecline: () => void;
  onDelete: () => void;
}

export class FriendRequest extends React.Component<Props> {
  public getStringId() {
    const { status, type } = this.props;

    switch (status) {
      case 'pending':
        return `${type}FriendRequestPending`;
      case 'accepted':
        return `friendRequestAccepted`;
      case 'declined':
        return `friendRequestDeclined`;
      default:
        throw new Error(`Invalid friend request status: ${status}`);
    }
  }

  public renderContents() {
    const { type, i18n, text } = this.props;
    const id = this.getStringId();

    return (
      <div>
        <div className={`module-friend-request__title module-friend-request__title--${type}`}>{i18n(id)}</div>
        {!!text &&
          <div dir="auto">
            <MessageBody text={text || ''} i18n={i18n} />
          </div>
        }
      </div>
      
    );
  }

  public renderButtons() {
      const { status, type, onAccept, onDecline, onDelete } = this.props;

      if (type === 'incoming') {
        if (status === 'pending') {
          return (
              <div className={`module-message__metadata module-friend-request__buttonContainer module-friend-request__buttonContainer--${type}`}>
                <button onClick={onAccept}>Accept</button>
                <button onClick={onDecline}>Decline</button>
              </div>
          );
        } else if (status === 'declined') {
          return (
            <div className={`module-message__metadata module-friend-request__buttonContainer module-friend-request__buttonContainer--${type}`}>
              <button onClick={onDelete}>Delete Conversation</button>
            </div>
          );
        }
      }
      return null;
  }

  public render() {
    const { type} = this.props;

    return (
      <div className={`module-message module-message--${type} module-message-friend-request`}>
        <div className={`module-message__container module-message__container--${type} module-message-friend-request__container`}>
            <div className={`module-message__text module-message__text--${type}`}>
                {this.renderContents()}
                {this.renderButtons()}
            </div>
        </div>
      </div>
    );
  }
}
