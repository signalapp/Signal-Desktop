import React from 'react';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import { ConversationAttributes } from '../../../js/models/conversations';

interface Props {
  size: number;
  conversations: Array<ConversationAttributes>;
  i18n: LocalizerType;
}

export class ClosedGroupAvatar extends React.PureComponent<Props> {
  public render() {
    const { conversations, size } = this.props;
    // FIXME audric render grey circle for missing avatar
    if (conversations.length < 2) {
      const conv = conversations[0];
      const name = conv.name || conv.id;
      return (
        <Avatar
          avatarPath={conv.avatarPath}
          name={name}
          size={size}
          pubkey={conv.id}
        />
      );
    } else if (conversations.length > 1) {
      // in a closed group avatar, each visible avatar member size is 2/3 of the group avatar in size
      // Always use the size directly under the one requested
      let avatarsDiameter = 0;
      switch (size) {
        case 36: {
          avatarsDiameter = 28;
          break;
        }
        case 48: {
          avatarsDiameter = 36;
          break;
        }
        case 64: {
          avatarsDiameter = 48;
          break;
        }
        case 80: {
          avatarsDiameter = 64;
          break;
        }
        case 300: {
          avatarsDiameter = 80;
          break;
        }
        default:
          throw new Error(
            `Invalid size request for closed group avatar: ${size}`
          );
      }
      const conv1 = conversations[0];
      const conv2 = conversations[1];
      const name1 = conv1.name || conv1.id;
      const name2 = conv2.name || conv2.id;

      // use the 2 first members as group avatars
      return (
        <div className="module-avatar__icon-closed">
          <Avatar
            avatarPath={conv1.avatarPath}
            name={name1}
            size={avatarsDiameter}
            pubkey={conv1.id}
          />
          <Avatar
            avatarPath={conv2.avatarPath}
            name={name2}
            size={avatarsDiameter}
            pubkey={conv2.id}
          />
        </div>
      );
    } else {
      return <></>;
    }
  }
}
