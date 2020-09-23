import React from 'react';
import classNames from 'classnames';

import { AvatarPlaceHolder, ClosedGroupAvatar } from './AvatarPlaceHolder';
import { ConversationAvatar } from './session/usingClosedConversationDetails';

interface Props {
  avatarPath?: string;
  name?: string; // display name, profileName or phoneNumber, whatever is set first
  pubkey?: string;
  size: number;
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
  onAvatarClick?: () => void;
}

interface State {
  imageBroken: boolean;
}

export class Avatar extends React.PureComponent<Props, State> {
  public handleImageErrorBound: () => void;
  public onAvatarClickBound: (e: any) => void;

  public constructor(props: Props) {
    super(props);

    this.handleImageErrorBound = this.handleImageError.bind(this);
    this.onAvatarClickBound = this.onAvatarClick.bind(this);

    this.state = {
      imageBroken: false,
    };
  }

  public handleImageError() {
    window.log.warn(
      'Avatar: Image failed to load; failing over to placeholder'
    );
    this.setState({
      imageBroken: true,
    });
  }

  public renderIdenticon() {
    const { size, name, pubkey } = this.props;

    const userName = name || '0';

    return (
      <AvatarPlaceHolder
        diameter={size}
        name={userName}
        pubkey={pubkey}
        colors={this.getAvatarColors()}
        borderColor={this.getAvatarBorderColor()}
      />
    );
  }

  public renderImage() {
    const { avatarPath, name } = this.props;
    const { imageBroken } = this.state;

    if (!avatarPath || imageBroken) {
      return null;
    }

    return (
      <img
        onError={this.handleImageErrorBound}
        alt={window.i18n('contactAvatarAlt', [name])}
        src={avatarPath}
      />
    );
  }

  public renderNoImage() {
    const { memberAvatars, size } = this.props;
    // if no image but we have conversations set for the group, renders group members avatars
    if (memberAvatars) {
      return (
        <ClosedGroupAvatar
          size={size}
          memberAvatars={memberAvatars}
          i18n={window.i18n}
        />
      );
    }

    return this.renderIdenticon();
  }

  public render() {
    const { avatarPath, size, memberAvatars } = this.props;
    const { imageBroken } = this.state;
    const isClosedGroupAvatar = memberAvatars && memberAvatars.length;
    const hasImage = avatarPath && !imageBroken && !isClosedGroupAvatar;

    if (
      size !== 28 &&
      size !== 36 &&
      size !== 48 &&
      size !== 64 &&
      size !== 80 &&
      size !== 300
    ) {
      throw new Error(`Size ${size} is not supported!`);
    }
    const isClickable = !!this.props.onAvatarClick;

    return (
      <div
        className={classNames(
          'module-avatar',
          `module-avatar--${size}`,
          hasImage ? 'module-avatar--with-image' : 'module-avatar--no-image',
          isClickable && 'module-avatar-clickable'
        )}
        onClick={e => {
          this.onAvatarClickBound(e);
        }}
        role="button"
      >
        {hasImage ? this.renderImage() : this.renderNoImage()}
      </div>
    );
  }

  private onAvatarClick(e: any) {
    if (this.props.onAvatarClick) {
      e.stopPropagation();
      this.props.onAvatarClick();
    }
  }

  private getAvatarColors(): Array<string> {
    // const theme = window.Events.getThemedSettings();
    // defined in session-android as `profile_picture_placeholder_colors`
    return ['#5ff8b0', '#26cdb9', '#f3c615', '#fcac5a'];
  }

  private getAvatarBorderColor(): string {
    return '#00000059'; // borderAvatarColor in themes.scss
  }
}
