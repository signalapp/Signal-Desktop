import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';

export interface ContactType {
  id: string;
  selected: boolean;
  authorProfileName: string;
  authorPhoneNumber: string;
  authorName: string;
  authorColor: any;
  authorAvatarPath: string;
  checkmarked: boolean;
  existingMember: boolean;
}

interface Props {
  member: ContactType;
  isSelected: boolean;
  onSelect?: any;
  onUnselect?: any;
}

interface State {
  isSelected: boolean;
}

export class SessionMemberListItem extends React.Component<Props, State> {
  public static defaultProps = {
    isSelected: false,
  };

  constructor(props: any) {
    super(props);

    this.state = {
      isSelected: this.props.isSelected,
    };

    this.handleSelectionAction = this.handleSelectionAction.bind(this);
    this.selectMember = this.selectMember.bind(this);
    this.unselectMember = this.unselectMember.bind(this);
    this.renderAvatar = this.renderAvatar.bind(this);
  }

  public render() {
    const { isSelected } = this.state;

    const name = this.props.member.authorProfileName;
    const pubkey = this.props.member.authorPhoneNumber;
    const shortPubkey = window.shortenPubkey(pubkey);

    return (
      <div
        className={classNames('session-member-item', isSelected && 'selected')}
        onClick={this.handleSelectionAction}
        role="button"
      >
        <div className="session-member-item__info">
          <span className="session-member-item__avatar">
            {this.renderAvatar()}
          </span>
          <span className="session-member-item__name">{name}</span>
          <span className="session-member-item__pubkey">{shortPubkey}</span>
        </div>
        <span
          className={classNames(
            'session-member-item__checkmark',
            isSelected && 'selected'
          )}
        >
          <SessionIcon
            iconType={SessionIconType.Check}
            iconSize={SessionIconSize.Medium}
            iconColor={'#00f782'}
          />
        </span>
      </div>
    );
  }

  private renderAvatar() {
    return (
      <Avatar
        avatarPath={this.props.member.authorAvatarPath}
        color={this.props.member.authorColor}
        conversationType="direct"
        i18n={window.i18n}
        name={this.props.member.authorName}
        phoneNumber={this.props.member.authorPhoneNumber}
        profileName={this.props.member.authorProfileName}
        size={28}
      />
    );
  }

  private handleSelectionAction() {
    if (this.state.isSelected) {
      this.unselectMember();

      return;
    }

    this.selectMember();
  }

  private selectMember() {
    this.setState({
      isSelected: true,
    });

    if (this.props.onSelect) {
      this.props.onSelect(this.props.member);
    }
  }

  private unselectMember() {
    this.setState({
      isSelected: false,
    });

    if (this.props.onUnselect) {
      this.props.onUnselect(this.props.member);
    }
  }
}
