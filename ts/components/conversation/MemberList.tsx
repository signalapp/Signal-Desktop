import React from 'react';
import classNames from 'classnames';
import { Avatar } from '../Avatar';

export interface Contact {
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
interface MemberItemProps {
  member: Contact;
  selected: boolean;
  existingMember: boolean;
  onClicked: any;
  i18n: any;
  checkmarked: boolean;
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
    const existingMember = this.props.existingMember;
    const shortPubkey = window.shortenPubkey(pubkey);

    let markType: 'none' | 'kicked' | 'added' | 'existing' = 'none';

    if (this.props.checkmarked) {
      if (existingMember) {
        markType = 'kicked';
      } else {
        markType = 'added';
      }
    } else {
      if (existingMember) {
        markType = 'existing';
      } else {
        markType = 'none';
      }
    }

    const markClasses = ['check-mark'];

    switch (markType) {
      case 'none':
        markClasses.push('invisible');
        break;
      case 'existing':
        markClasses.push('existing-member');
        break;
      case 'kicked':
        markClasses.push('existing-member-kicked');
        break;
      default:
      // do nothing
    }

    const mark = markType === 'kicked' ? '✘' : '✔';

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
        <span className="pubkey-part">{shortPubkey}</span>
        <span className={classNames(markClasses)}>{mark}</span>
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
        i18n={this.props.i18n}
        name={this.props.member.authorName}
        phoneNumber={this.props.member.authorPhoneNumber}
        profileName={this.props.member.authorProfileName}
        size={28}
      />
    );
  }
}

interface MemberListProps {
  members: Array<Contact>;
  selected: any;
  onMemberClicked: any;
  i18n: any;
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
          checkmarked={item.checkmarked}
          existingMember={item.existingMember}
          i18n={this.props.i18n}
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
