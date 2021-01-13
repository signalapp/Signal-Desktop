import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { Constants } from '../../session';
import { DefaultTheme, withTheme } from 'styled-components';

export interface ContactType {
  id: string;
  selected: boolean;
  authorProfileName: string;
  authorPhoneNumber: string;
  authorName: string;
  authorAvatarPath: string;
  checkmarked: boolean;
  existingMember: boolean;
}

interface Props {
  member: ContactType;
  index: number; // index in the list
  isSelected: boolean;
  onSelect?: any;
  onUnselect?: any;
  theme: DefaultTheme;
}

class SessionMemberListItemInner extends React.Component<Props> {
  public static defaultProps = {
    isSelected: false,
  };

  constructor(props: any) {
    super(props);

    this.handleSelectionAction = this.handleSelectionAction.bind(this);
    this.selectMember = this.selectMember.bind(this);
    this.unselectMember = this.unselectMember.bind(this);
    this.renderAvatar = this.renderAvatar.bind(this);
  }

  public render() {
    const { isSelected } = this.props;

    const name = this.props.member.authorProfileName;

    return (
      <div
        className={classNames(
          `session-member-item-${this.props.index}`,
          'session-member-item',
          isSelected && 'selected'
        )}
        onClick={this.handleSelectionAction}
        role="button"
      >
        <div className="session-member-item__info">
          <span className="session-member-item__avatar">
            {this.renderAvatar()}
          </span>
          <span className="session-member-item__name">{name}</span>
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
            iconColor={Constants.UI.COLORS.GREEN}
            theme={this.props.theme}
          />
        </span>
      </div>
    );
  }

  private renderAvatar() {
    const {
      authorAvatarPath,
      authorName,
      authorPhoneNumber,
      authorProfileName,
    } = this.props.member;
    const userName = authorName || authorProfileName || authorPhoneNumber;
    return (
      <Avatar
        avatarPath={authorAvatarPath}
        name={userName}
        size={28}
        pubkey={authorPhoneNumber}
      />
    );
  }

  private handleSelectionAction() {
    if (this.props.isSelected) {
      this.unselectMember();

      return;
    }

    this.selectMember();
  }

  private selectMember() {
    if (this.props.onSelect) {
      this.props.onSelect(this.props.member);
    }
  }

  private unselectMember() {
    if (this.props.onUnselect) {
      this.props.onUnselect(this.props.member);
    }
  }
}

export const SessionMemberListItem = SessionMemberListItemInner;
