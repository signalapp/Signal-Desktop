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
    const { conversations, size, i18n } = this.props;

    if (conversations.length === 1) {
      const conv = conversations[0];
      return (
        <Avatar
          avatarPath={conv.avatarPath}
          noteToSelf={conv.isMe}
          conversationType="direct"
          i18n={i18n}
          name={name}
          phoneNumber={conv.id}
          profileName={conv.name}
          size={size}
          isPublic={false}
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
        case 80: {
          avatarsDiameter = 48;
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
      // use the 2 first members as group avatars
      return (
        <div className="module-avatar__icon-closed">
          <Avatar
            avatarPath={conv1.avatarPath}
            noteToSelf={conv1.isMe}
            conversationType="direct"
            i18n={i18n}
            name={name}
            phoneNumber={conv1.id}
            profileName={conv1.name}
            size={avatarsDiameter}
            isPublic={false}
          />
          <Avatar
            avatarPath={conv2.avatarPath}
            noteToSelf={conv2.isMe}
            conversationType="direct"
            i18n={i18n}
            name={name}
            phoneNumber={conv2.id}
            profileName={conv2.name}
            size={avatarsDiameter}
            isPublic={false}
          />
        </div>
      );
    } else {
      return <></>;
    }
  }
}
