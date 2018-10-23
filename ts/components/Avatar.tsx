import React from 'react';
import classNames from 'classnames';

import { getInitials } from '../util/getInitials';
import { Localizer } from '../types/Util';

interface Props {
  avatarPath?: string;
  color?: string;
  conversationType: 'group' | 'direct';
  i18n: Localizer;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  size: number;
}

interface State {
  imageBroken: boolean;
}

export class Avatar extends React.Component<Props, State> {
  public handleImageErrorBound: () => void;

  public constructor(props: Props) {
    super(props);

    this.handleImageErrorBound = this.handleImageError.bind(this);

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

  public renderImage() {
    const { avatarPath, i18n, name, phoneNumber, profileName } = this.props;
    const { imageBroken } = this.state;
    const hasImage = avatarPath && !imageBroken;

    if (!hasImage) {
      return null;
    }

    const title = `${name || phoneNumber}${
      !name && profileName ? ` ~${profileName}` : ''
    }`;

    return (
      <img
        onError={this.handleImageErrorBound}
        alt={i18n('contactAvatarAlt', [title])}
        src={avatarPath}
      />
    );
  }

  public renderNoImage() {
    const { conversationType, name, size } = this.props;

    const initials = getInitials(name);
    const isGroup = conversationType === 'group';

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
    const { avatarPath, color, size } = this.props;
    const { imageBroken } = this.state;

    const hasImage = avatarPath && !imageBroken;

    if (size !== 28 && size !== 36 && size !== 48 && size !== 80) {
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
      >
        {hasImage ? this.renderImage() : this.renderNoImage()}
      </div>
    );
  }
}
