import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar } from '../Avatar';
import { PropsData as ConversationListItemPropsType } from '../ConversationListItem';
import { createOrUpdateItem, getItemById } from '../../../js/modules/data';

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
}

export class ActionsPanel extends React.Component<Props, State> {
  private ourConversation: any;
  constructor(props: Props) {
    super(props);
    this.state = {
      avatarPath: '',
    };

    this.editProfileHandle = this.editProfileHandle.bind(this);
    this.refreshAvatarCallback = this.refreshAvatarCallback.bind(this);
  }

  public componentDidMount() {
    // tslint:disable-next-line: no-backbone-get-set-outside-model
    const ourNumber = window.storage.get('primaryDevicePubKey');

    window.ConversationController.getOrCreateAndWait(ourNumber, 'private').then(
      (conversation: any) => {
        this.setState({
          avatarPath: conversation.getAvatarPath(),
        });
        // When our primary device updates its avatar, we will need for a message sync to know about that.
        // Once we get the avatar update, we need to refresh this react component.
        // So we listen to changes on our profile avatar and use the updated avatarPath (done on message received).
        this.ourConversation = conversation;

        this.ourConversation.on(
          'change',
          () => {
            this.refreshAvatarCallback(this.ourConversation);
          },
          'refreshAvatarCallback'
        );

        void this.showLightThemeDialogIfNeeded();
      }
    );
  }

  public async showLightThemeDialogIfNeeded() {
    const currentTheme = window.Events.getThemeSetting(); // defaults to light on new registration
    if (currentTheme !== 'light') {
      const message = 'Light Mode';
      const messageSub =
        'Whoops, who left the lights on?</br></br>\
        That’s right, Session has a spiffy new light mode! Take the fresh new color palette for a spin — it’s now the default mode.</br></br>\
        Want to go back to the dark side? Just tap the moon symbol in the lower left corner of the app to switch modes.';
      const hasSeenLightMode = await getItemById('hasSeenLightModeDialog');

      if (hasSeenLightMode?.value === true) {
        // if hasSeen is set and true, we have nothing to do
        return;
      }
      // force light them right now, then ask for permission
      await window.Events.setThemeSetting('light');
      window.confirmationDialog({
        message,
        messageSub,
        resolve: async () => {
          const data = {
            id: 'hasSeenLightModeDialog',
            value: true,
          };
          void createOrUpdateItem(data);
        },
        okTheme: 'default primary',
        hideCancel: true,
        sessionIcon: SessionIconType.Sun,
        iconSize: SessionIconSize.Max,
      });
    }
  }

  public refreshAvatarCallback(conversation: any) {
    if (conversation.changed?.profileAvatar) {
      this.setState({
        avatarPath: conversation.getAvatarPath(),
      });
    }
  }

  public componentWillUnmount() {
    if (this.ourConversation) {
      this.ourConversation.off('change', null, 'refreshAvatarCallback');
    }
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
          /* tslint:disable:no-void-expression */
          if (type === SectionType.Profile) {
            this.editProfileHandle();
          } else if (type === SectionType.Moon) {
            window.toggleTheme();
          } else {
            onSelect(type);
          }
          /* tslint:enable:no-void-expression */
        }
      : undefined;

    if (type === SectionType.Profile) {
      const pubkey = window.storage.get('primaryDevicePubKey');
      const userName = window.getOurDisplayName() || pubkey;
      return (
        <Avatar
          avatarPath={avatarPath}
          size={28}
          onAvatarClick={handleClick}
          name={userName}
          pubkey={pubkey}
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

    return (
      <SessionIconButton
        iconSize={SessionIconSize.Medium}
        iconType={iconType}
        notificationCount={notificationCount}
        onClick={handleClick}
        isSelected={isSelected}
      />
    );
  };

  public editProfileHandle() {
    window.showEditProfileDialog((avatar: any) => {
      this.setState({
        avatarPath: avatar,
      });
    });
  }

  public render(): JSX.Element {
    const { selectedSection, unreadMessageCount } = this.props;

    const isProfilePageSelected = selectedSection === SectionType.Profile;
    const isMessagePageSelected = selectedSection === SectionType.Message;
    const isContactPageSelected = selectedSection === SectionType.Contact;
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
          type={SectionType.Contact}
          isSelected={isContactPageSelected}
          onSelect={this.handleSectionSelect}
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
