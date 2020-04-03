import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar } from '../Avatar';
import { PropsData as ConversationListItemPropsType } from '../ConversationListItem';

export enum SectionType {
  Profile,
  Message,
  Contact,
  Channel,
  Settings,
  Moon,
}

interface State {
  avatarPath: string;
}

interface Props {
  onSectionSelected: any;
  selectedSection: SectionType;
  conversations: Array<ConversationListItemPropsType> | undefined;
  unreadMessageCount: number;
  receivedFriendRequestCount: number;
}

export class ActionsPanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      avatarPath: '',
    };

    this.editProfileHandle = this.editProfileHandle.bind(this);
  }

  public componentDidMount() {
    // tslint:disable-next-line: no-backbone-get-set-outside-model
    const ourNumber = window.storage.get('primaryDevicePubKey');

    window.ConversationController.getOrCreateAndWait(ourNumber, 'private').then(
      (conversation: any) => {
        this.setState({
          avatarPath: conversation.getAvatarPath(),
        });
      }
    );
  }

  public Section = ({
    isSelected,
    onSelect,
    type,
    avatarPath,
    notificationCount,
  }: {
    isSelected: boolean;
    onSelect?: (event: SectionType) => void;
    type: SectionType;
    avatarPath?: string;
    avatarColor?: string;
    notificationCount?: number;
  }) => {
    const handleClick = onSelect
      ? () => {
          type === SectionType.Profile
            ? /* tslint:disable-next-line:no-void-expression */
              this.editProfileHandle()
            : /* tslint:disable-next-line:no-void-expression */
              onSelect(type);
        }
      : undefined;

    if (type === SectionType.Profile) {
      return (
        <Avatar
          avatarPath={avatarPath}
          conversationType="direct"
          i18n={window.i18n}
          // tslint:disable-next-line: no-backbone-get-set-outside-model
          phoneNumber={window.storage.get('primaryDevicePubKey')}
          size={28}
          onAvatarClick={handleClick}
        />
      );
    }

    let iconType: SessionIconType;
    switch (type) {
      case SectionType.Message:
        iconType = SessionIconType.ChatBubble;
        break;
      case SectionType.Contact:
        iconType = SessionIconType.Users;
        break;
      case SectionType.Channel:
        iconType = SessionIconType.Globe;
        break;
      case SectionType.Settings:
        iconType = SessionIconType.Gear;
        break;
      case SectionType.Moon:
        iconType = SessionIconType.Moon;
        break;

      default:
        iconType = SessionIconType.Moon;
    }
    if (!isSelected) {
      return (
        <SessionIconButton
          iconSize={SessionIconSize.Medium}
          iconType={iconType}
          notificationCount={notificationCount}
          onClick={handleClick}
        />
      );
    } else {
      return (
        <SessionIconButton
          iconSize={SessionIconSize.Medium}
          iconType={iconType}
          notificationCount={notificationCount}
          onClick={handleClick}
          isSelected={isSelected}
        />
      );
    }
  };

  public editProfileHandle() {
    window.showEditProfileDialog((avatar: any) => {
      this.setState({
        avatarPath: avatar,
      });
    });
  }

  public render(): JSX.Element {
    const {
      selectedSection,
      unreadMessageCount,
      receivedFriendRequestCount,
    } = this.props;

    const isProfilePageSelected = selectedSection === SectionType.Profile;
    const isMessagePageSelected = selectedSection === SectionType.Message;
    const isContactPageSelected = selectedSection === SectionType.Contact;
    const isChannelPageSelected = selectedSection === SectionType.Channel;
    const isSettingsPageSelected = selectedSection === SectionType.Settings;
    const isMoonPageSelected = selectedSection === SectionType.Moon;

    return (
      <div className="module-left-pane__sections-container">
        <this.Section
          type={SectionType.Profile}
          avatarPath={this.state.avatarPath}
          isSelected={isProfilePageSelected}
          onSelect={this.handleSectionSelect}
        />
        <this.Section
          type={SectionType.Message}
          isSelected={isMessagePageSelected}
          onSelect={this.handleSectionSelect}
          notificationCount={unreadMessageCount}
        />
        <this.Section
          type={SectionType.Channel}
          isSelected={isChannelPageSelected}
          onSelect={this.handleSectionSelect}
        />
        <this.Section
          type={SectionType.Contact}
          isSelected={isContactPageSelected}
          onSelect={this.handleSectionSelect}
          notificationCount={receivedFriendRequestCount}
        />
        <this.Section
          type={SectionType.Settings}
          isSelected={isSettingsPageSelected}
          onSelect={this.handleSectionSelect}
        />
        <this.Section
          type={SectionType.Moon}
          isSelected={isMoonPageSelected}
          onSelect={this.handleSectionSelect}
        />
      </div>
    );
  }

  private readonly handleSectionSelect = (section: SectionType): void => {
    this.props.onSectionSelected(section);
  };
}
