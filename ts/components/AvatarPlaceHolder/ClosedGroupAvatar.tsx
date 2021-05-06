import React from 'react';
import { Avatar, AvatarSize } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import { ConversationAvatar } from '../session/usingClosedConversationDetails';

interface Props {
  size: number;
  memberAvatars: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
  i18n: LocalizerType;
  onAvatarClick?: () => void;
}

export class ClosedGroupAvatar extends React.PureComponent<Props> {
  public getClosedGroupAvatarsSize(size: AvatarSize): AvatarSize {
    // Always use the size directly under the one requested
    switch (size) {
      case AvatarSize.S:
        return AvatarSize.XS;
      case AvatarSize.M:
        return AvatarSize.S;
      case AvatarSize.L:
        return AvatarSize.M;
      case AvatarSize.XL:
        return AvatarSize.L;
      case AvatarSize.HUGE:
        return AvatarSize.XL;
      default:
        throw new Error(`Invalid size request for closed group avatar: ${size}`);
    }
  }

  public render() {
    const { memberAvatars, size, onAvatarClick } = this.props;
    const avatarsDiameter = this.getClosedGroupAvatarsSize(size);

    const conv1 = memberAvatars.length > 0 ? memberAvatars[0] : undefined;
    const conv2 = memberAvatars.length > 1 ? memberAvatars[1] : undefined;
    const name1 = conv1?.name || conv1?.id || undefined;
    const name2 = conv2?.name || conv2?.id || undefined;

    // use the 2 first members as group avatars
    return (
      <div className="module-avatar__icon-closed">
        <Avatar
          avatarPath={conv1?.avatarPath}
          name={name1}
          size={avatarsDiameter}
          pubkey={conv1?.id}
          onAvatarClick={onAvatarClick}
        />
        <Avatar
          avatarPath={conv2?.avatarPath}
          name={name2}
          size={avatarsDiameter}
          pubkey={conv2?.id}
          onAvatarClick={onAvatarClick}
        />
      </div>
    );
  }
}
