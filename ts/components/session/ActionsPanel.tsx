import React from 'react';
import { connect } from 'react-redux';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar } from '../Avatar';
import { removeItemById } from '../../../js/modules/data';
import { darkTheme, lightTheme } from '../../state/ducks/SessionTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { mapDispatchToProps } from '../../state/actions';
import { ConversationType } from '../../state/ducks/conversations';
import { noop } from 'lodash';
// tslint:disable-next-line: no-import-side-effect no-submodule-imports

export enum SectionType {
  Profile,
  Message,
  Contact,
  Channel,
  Settings,
  Moon,
}

interface Props {
  onSectionSelected: any;
  selectedSection: SectionType;
  unreadMessageCount: number;
  ourPrimaryConversation: ConversationType;
  applyTheme?: any;
}

class ActionsPanelPrivate extends React.Component<Props> {
  constructor(props: Props) {
    super(props);

    this.editProfileHandle = this.editProfileHandle.bind(this);
    // we consider people had the time to upgrade, so remove this id from the db
    // it was used to display a dialog when we added the light mode auto-enabled
    void removeItemById('hasSeenLightModeDialog');
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
    notificationCount?: number;
  }) => {
    const handleClick = onSelect
      ? () => {
          /* tslint:disable:no-void-expression */
          if (type === SectionType.Profile) {
            this.editProfileHandle();
          } else if (type === SectionType.Moon) {
            const theme = window.Events.getThemeSetting();
            const updatedTheme = theme === 'dark' ? 'light' : 'dark';
            window.setTheme(updatedTheme);

            const newThemeObject =
              updatedTheme === 'dark' ? darkTheme : lightTheme;
            this.props.applyTheme(newThemeObject);
          } else {
            onSelect(type);
          }
          /* tslint:enable:no-void-expression */
        }
      : undefined;

    if (type === SectionType.Profile) {
      const ourPrimary = window.storage.get('primaryDevicePubKey');
      const conversation = window.ConversationController.getOrThrow(ourPrimary);
      const profile = conversation.getLokiProfile();
      const userName = (profile && profile.displayName) || ourPrimary;
      return (
        <Avatar
          avatarPath={avatarPath}
          size={28}
          onAvatarClick={handleClick}
          name={userName}
          pubkey={ourPrimary}
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
    window.showEditProfileDialog(noop);
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
          avatarPath={this.props.ourPrimaryConversation.avatarPath}
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

        <SessionToastContainer />
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

const smart = connect(null, mapDispatchToProps);

export const ActionsPanel = smart(ActionsPanelPrivate);
