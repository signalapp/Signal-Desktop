import React from 'react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from '../Avatar';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { Constants } from '../../session';
import { DefaultTheme } from 'styled-components';
import { PubKey } from '../../session/types';
import autoBind from 'auto-bind';

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
  // this bool is used to make a zombie appear with less opacity than a normal member
  isZombie?: boolean;
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

    autoBind(this);
  }

  public render() {
    const { isSelected, member, isZombie } = this.props;

    const name = member.authorProfileName || PubKey.shorten(member.authorPhoneNumber);

    return (
      <div
        className={classNames(
          `session-member-item-${this.props.index}`,
          'session-member-item',
          isSelected && 'selected',
          isZombie && 'zombie'
        )}
        onClick={this.handleSelectionAction}
        role="button"
      >
        <div className="session-member-item__info">
          <span className="session-member-item__avatar">{this.renderAvatar()}</span>
          <span className="session-member-item__name">{name}</span>
        </div>
        <span className={classNames('session-member-item__checkmark', isSelected && 'selected')}>
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
        size={AvatarSize.XS}
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
