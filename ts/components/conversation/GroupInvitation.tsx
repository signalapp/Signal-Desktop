import React from 'react';
import classNames from 'classnames';

interface Props {
  serverName: string;
  serverAddress: string;
  direction: string;
  onClick: any;
}

export class GroupInvitation extends React.Component<Props> {
  public render() {
    const classes = ['group-invitation'];

    if (this.props.direction === 'outgoing') {
      classes.push('invitation-outgoing');
    }

    return (
      <div className={'group-invitation-container'}>
        <div className={classNames(classes)}>
          <div className="title">Group invitation</div>
          <div className="contents">
            <img
              alt="group-avatar"
              src="images/session/session_chat_icon.png"
              className="invite-group-avatar"
            />
            <span className="group-details">
              <span className="group-name">{this.props.serverName}</span>
              <span className="group-address">{this.props.serverAddress}</span>
            </span>
            <span
              role="button"
              className="join-btn"
              onClick={this.props.onClick}
            >
              Join
            </span>
          </div>
        </div>
      </div>
    );
  }
}
