import React from 'react';
import {
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from './session/icon';
import { Avatar } from './Avatar';

enum SectionType {
  Profile,
  Message,
  People,
  Globe,
  Settings,
  Moon,
}

interface State {
  selectedSection: SectionType;
  avatarPath: string;
}

const Section = ({
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
        onSelect(type);
      }
    : undefined;

  if (type === SectionType.Profile) {
    if (!isSelected) {
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
    } else {
      return (
        <Avatar
          avatarPath={avatarPath}
          conversationType="direct"
          i18n={window.i18n}
          // tslint:disable-next-line: no-backbone-get-set-outside-model
          phoneNumber={window.storage.get('primaryDevicePubKey')}
          size={28}
          onAvatarClick={handleClick}
          borderColor={'#fff'}
        />
      );
    }
  }

  let iconType: SessionIconType;
  switch (type) {
    case SectionType.Message:
      iconType = SessionIconType.Reply;
      break;
    case SectionType.People:
      iconType = SessionIconType.Users;
      break;
    case SectionType.Globe:
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

export class LeftPaneSections extends React.Component<{}, State> {
  constructor() {
    super({});
    this.state = {
      avatarPath: '',
      selectedSection: SectionType.Message,
    };
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

  public render(): JSX.Element {
    const isProfileSelected =
      this.state.selectedSection === SectionType.Profile;
    const isMessageSelected =
      this.state.selectedSection === SectionType.Message;
    const isPeopleSelected = this.state.selectedSection === SectionType.People;
    const isGlobeSelected = this.state.selectedSection === SectionType.Globe;
    const isSettingsSelected =
      this.state.selectedSection === SectionType.Settings;
    const isMoonSelected = this.state.selectedSection === SectionType.Moon;

    return (
      <div className="module-left-pane__sections-container">
        <Section
          type={SectionType.Profile}
          avatarPath={this.state.avatarPath}
          isSelected={isProfileSelected}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Message}
          isSelected={isMessageSelected}
          onSelect={this.handleSectionSelect}
          notificationCount={0}
        />
        <Section
          type={SectionType.People}
          isSelected={isPeopleSelected}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Globe}
          isSelected={isGlobeSelected}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Settings}
          isSelected={isSettingsSelected}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Moon}
          isSelected={isMoonSelected}
          onSelect={this.handleSectionSelect}
        />
      </div>
    );
  }

  private readonly handleSectionSelect = (section: SectionType): void => {
    this.setState({ selectedSection: section });
  };
}
