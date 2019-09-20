import React from 'react';
import classNames from 'classnames';
import { Avatar } from '../Avatar';

interface MemberItemProps {
  member: any;
  selected: Boolean;
  onClicked: any;
}

class MemberItem extends React.Component<MemberItemProps> {
  constructor(props: any) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  public render() {
    const name = this.props.member.authorProfileName;
    const pubkey = this.props.member.authorPhoneNumber;
    const selected = this.props.selected;

    return (
      <div
        role="button"
        className={classNames(
          'member-item',
          selected ? 'member-selected' : null
        )}
        onClick={this.handleClick}
      >
        {this.renderAvatar()}
        <span className="name-part">{name}</span>
        <span className="pubkey-part">{pubkey}</span>
      </div>
    );
  }

  private handleClick() {
    this.props.onClicked(this.props.member);
  }

  private renderAvatar() {
    return (
      <Avatar
        avatarPath={this.props.member.authorAvatarPath}
        color={this.props.member.authorColor}
        conversationType="direct"
        i18n={this.props.member.i18n}
        name={this.props.member.authorName}
        phoneNumber={this.props.member.authorPhoneNumber}
        profileName={this.props.member.authorProfileName}
        size={28}
      />
    );
  }
}

interface MemberListProps {
  members: [any];
  selected: any;
  onMemberClicked: any;
}

export class MemberList extends React.Component<MemberListProps> {
  constructor(props: any) {
    super(props);

    this.handleMemberClicked = this.handleMemberClicked.bind(this);
  }

  public render() {
    const { members } = this.props;

    const itemList = members.map(item => {
      const selected = item === this.props.selected;

      return (
        <MemberItem
          key={item.id}
          member={item}
          selected={selected}
          onClicked={this.handleMemberClicked}
        />
      );
    });

    return <div>{itemList}</div>;
  }

  private handleMemberClicked(member: any) {
    this.props.onMemberClicked(member);
  }
}
