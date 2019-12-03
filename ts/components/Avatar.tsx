import React from 'react';
import classNames from 'classnames';

import { getInitials } from '../util/getInitials';
import { LocalizerType } from '../types/Util';

export interface Props {
  avatarPath?: string;
  color?: string;
  conversationType: 'group' | 'direct';
  noteToSelf?: boolean;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  size: 28 | 52 | 80;

  onClick?: () => unknown;

  // Matches Popper's RefHandler type
  innerRef?: (ref: HTMLElement | null) => void;

  i18n: LocalizerType;
}

interface State {
  imageBroken: boolean;
  lastAvatarPath?: string;
}

export class Avatar extends React.Component<Props, State> {
  public handleImageErrorBound: () => void;

  public constructor(props: Props) {
    super(props);

    this.handleImageErrorBound = this.handleImageError.bind(this);

    this.state = {
      lastAvatarPath: props.avatarPath,
      imageBroken: false,
    };
  }

  public static getDerivedStateFromProps(props: Props, state: State): State {
    if (props.avatarPath !== state.lastAvatarPath) {
      return {
        ...state,
        lastAvatarPath: props.avatarPath,
        imageBroken: false,
      };
    }

    return state;
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

    if (!avatarPath || imageBroken) {
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
    const {
      conversationType,
      name,
      noteToSelf,
      profileName,
      size,
    } = this.props;

    const initials = getInitials(name || profileName);
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
    const {
      avatarPath,
      color,
      innerRef,
      noteToSelf,
      onClick,
      size,
    } = this.props;
    const { imageBroken } = this.state;

    const hasImage = !noteToSelf && avatarPath && !imageBroken;

    if (size !== 28 && size !== 52 && size !== 80) {
      throw new Error(`Size ${size} is not supported!`);
    }

    let contents;

    if (onClick) {
      contents = (
        <button className="module-avatar-button" onClick={onClick}>
          {hasImage ? this.renderImage() : this.renderNoImage()}
        </button>
      );
    } else {
      contents = hasImage ? this.renderImage() : this.renderNoImage();
    }

    return (
      <div
        className={classNames(
          'module-avatar',
          `module-avatar--${size}`,
          hasImage ? 'module-avatar--with-image' : 'module-avatar--no-image',
          !hasImage ? `module-avatar--${color}` : null
        )}
        ref={innerRef}
      >
        {contents}
      </div>
    );
  }
}
