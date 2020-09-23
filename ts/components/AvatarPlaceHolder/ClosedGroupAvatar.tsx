import React from 'react';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import { ConversationAvatar } from '../session/usingClosedConversationDetails';

interface Props {
  size: number;
  memberAvatars: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
  i18n: LocalizerType;
}

export class ClosedGroupAvatar extends React.PureComponent<Props> {
  public getClosedGroupAvatarsSize(size: number) {
    // Always use the size directly under the one requested
    switch (size) {
      case 36:
        return 28;
      case 48:
        return 36;
      case 64:
        return 48;
      case 80:
        return 64;
      case 300:
        return 80;
      default:
        throw new Error(
          `Invalid size request for closed group avatar: ${size}`
        );
    }
  }

  public render() {
    const { memberAvatars, size } = this.props;
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
        />
        <Avatar
          avatarPath={conv2?.avatarPath}
          name={name2}
          size={avatarsDiameter}
          pubkey={conv2?.id}
        />
      </div>
    );
  }
}
