import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
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
}

export class FriendRequest extends React.Component<Props> {
  public getStringId() {
    const { status } = this.props;

    switch (status) {
      case 'pending':
        return 'friendRequestPending';
      case 'accepted':
        return 'friendRequestAccepted';
      case 'declined':
        return 'friendRequestDeclined';
      default:
        throw new Error(`Invalid friend request status: ${status}`);
    }
  }

  public renderText() {
    const { text, i18n } = this.props;

    if (!text) {
      return null;
    }

    return (
      <div
        dir="auto"
        className='module-message__text module-friend-request__text'
      >
        <MessageBody text={text || ''} i18n={i18n} />
      </div>
    );
  }


  public renderContents() {
    const { source, i18n } = this.props;
    const id = this.getStringId();

    return (
      <div>
        <Intl
            id={id}
            components={[
            <ContactName
                i18n={i18n}
                key="external-1"
                name={source.name}
                profileName={source.profileName}
                phoneNumber={source.phoneNumber}
                module="module-friend-request__contact"
            />,
            ]}
            i18n={i18n}
        />
        {this.renderText()}
      </div>
      
    );
  }

  public renderButtons() {
      const { onAccept, onDecline } = this.props;
      return (
          <div className="module-message__metadata module-friend-request__buttonContainer">
            <button onClick={onAccept}>Accept</button>
            <button onClick={onDecline}>Decline</button>
          </div>
      )
  }

  public render() {
    const { type, status} = this.props;

    return (
      <div className={`module-message module-message--${type}`}>
        <div className={`module-message__container module-message__container--${type}`}>
            <div className={`module-message__text module-message__text--${type}`}>
                {this.renderContents()}
                {(status === 'pending') && this.renderButtons()}
            </div>
        </div>
      </div>
    );
  }
}
