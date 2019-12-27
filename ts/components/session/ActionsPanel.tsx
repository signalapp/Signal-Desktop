import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar } from '../Avatar';

export enum SectionType {
  Profile,
  Message,
  People,
  Globe,
  Settings,
  Moon,
}

interface State {
  avatarPath: string;
}

interface Props {
  onSectionSelected: any;
  selectedSection: SectionType;
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
      iconType = SessionIconType.ChatBubble;
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

export class ActionsPanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      avatarPath: '',
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
    const { selectedSection } = this.props;

    return (
      <div className="module-left-pane__sections-container">
        <Section
          type={SectionType.Profile}
          avatarPath={this.state.avatarPath}
          isSelected={selectedSection === SectionType.Profile}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Message}
          isSelected={selectedSection === SectionType.Message}
          onSelect={this.handleSectionSelect}
          notificationCount={0}
        />
        <Section
          type={SectionType.People}
          isSelected={selectedSection === SectionType.People}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Globe}
          isSelected={selectedSection === SectionType.Globe}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Settings}
          isSelected={selectedSection === SectionType.Settings}
          onSelect={this.handleSectionSelect}
        />
        <Section
          type={SectionType.Moon}
          isSelected={selectedSection === SectionType.Moon}
          onSelect={this.handleSectionSelect}
        />
      </div>
    );
  }

  private readonly handleSectionSelect = (section: SectionType): void => {
    this.props.onSectionSelected(section);
  };
}
