import React from 'react';
import classNames from 'classnames';

import { getInitials } from '../util/getInitials';
import { LocalizerType } from '../types/Util';
import { AvatarPlaceHolder } from './AvatarPlaceHolder';

interface Props {
  avatarPath?: string;
  color?: string;
  conversationType: 'group' | 'direct';
  noteToSelf?: boolean;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  size: number;
  borderColor?: string;
  borderWidth?: number;
  i18n?: LocalizerType;
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
    // tslint:disable-next-line no-console
    console.log('Avatar: Image failed to load; failing over to placeholder');
    this.setState({
      imageBroken: true,
    });
  }

  public renderIdenticon() {
    const { phoneNumber, size, name, profileName } = this.props;

    if (!phoneNumber) {
      window.log.error('Empty phoneNumber for identicon');
      return <></>;
    }

    const userName = profileName || name;
    return (
      <AvatarPlaceHolder
        phoneNumber={phoneNumber}
        diameter={size}
        name={userName}
        colors={this.getAvatarColors()}
      />
    );
  }

  public renderImage() {
    const { avatarPath, name, phoneNumber, profileName } = this.props;
    const { imageBroken } = this.state;

    if (!avatarPath || imageBroken) {
      return null;
    }

    const title = `${name || phoneNumber}${
      !name && profileName ? ` ~${profileName}` : ''
    }`;

    return (
      <img
        onError={this.handleImageErrorBound}
        alt={window.i18n('contactAvatarAlt', [title])}
        src={avatarPath}
      />
    );
  }

  public renderNoImage() {
    const { conversationType, name, noteToSelf, size } = this.props;

    const initials = getInitials(name);
    const isGroup = conversationType === 'group';

    if (noteToSelf) {
      return (
        <div
          className={classNames(
            'module-avatar__icon',
            'module-avatar__icon--note-to-self',
            `module-avatar__icon--${size}`
          )}
        />
      );
    }

    if (!isGroup && initials) {
      return (
        <div
          className={classNames(
            'module-avatar__label',
            `module-avatar__label--${size}`
          )}
        >
          {initials}
        </div>
      );
    }

    return (
      <div
        className={classNames(
          'module-avatar__icon',
          `module-avatar__icon--${conversationType}`,
          `module-avatar__icon--${size}`
        )}
      />
    );
  }

  public render() {
    const { avatarPath, color, size, conversationType } = this.props;
    const { imageBroken } = this.state;

    // If it's a direct conversation then we must have an identicon
    const hasAvatar = avatarPath || conversationType === 'direct';
    const hasImage = hasAvatar && !imageBroken;

    if (
      size !== 28 &&
      size !== 36 &&
      size !== 48 &&
      size !== 80 &&
      size !== 300
    ) {
      throw new Error(`Size ${size} is not supported!`);
    }

    return (
      <div
        className={classNames(
          'module-avatar',
          `module-avatar--${size}`,
          hasImage ? 'module-avatar--with-image' : 'module-avatar--no-image',
          !hasImage ? `module-avatar--${color}` : null
        )}
        onClick={e => {
          this.onAvatarClickBound(e);
        }}
        role="button"
      >
        {hasImage ? this.renderAvatarOrIdenticon() : this.renderNoImage()}
      </div>
    );
  }

  private onAvatarClick(e: any) {
    if (this.props.onAvatarClick) {
      e.stopPropagation();
      this.props.onAvatarClick();
    }
  }

  private renderAvatarOrIdenticon() {
    const { avatarPath, conversationType } = this.props;

    // If it's a direct conversation then we must have an identicon
    const hasAvatar = avatarPath || conversationType === 'direct';

    return hasAvatar && avatarPath
      ? this.renderImage()
      : this.renderIdenticon();
  }

  private getAvatarColors(): Array<string> {
    // const theme = window.Events.getThemedSettings();
    // defined in session-android as `profile_picture_placeholder_colors`
    return ['#5ff8b0', '#26cdb9', '#f3c615', '#fcac5a'];
  }
}
