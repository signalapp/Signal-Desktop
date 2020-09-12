import * as React from 'react';
import classNames from 'classnames';

import { getInitials } from '../util/getInitials';
import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

export type Props = {
  avatarPath?: string;
  color?: ColorType;

  conversationType: 'group' | 'direct';
  noteToSelf?: boolean;
  title: string;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  size: 28 | 32 | 52 | 80 | 112;

  onClick?: () => unknown;

  // Matches Popper's RefHandler type
  innerRef?: React.Ref<HTMLDivElement>;

  i18n: LocalizerType;
} & Pick<React.HTMLProps<HTMLDivElement>, 'className'>;

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

  public handleImageError(): void {
    window.log.info(
      'Avatar: Image failed to load; failing over to placeholder'
    );
    this.setState({
      imageBroken: true,
    });
  }

  public renderImage(): JSX.Element | null {
    const { avatarPath, i18n, title } = this.props;
    const { imageBroken } = this.state;

    if (!avatarPath || imageBroken) {
      return null;
    }

    return (
      <img
        onError={this.handleImageErrorBound}
        alt={i18n('contactAvatarAlt', [title])}
        src={avatarPath}
      />
    );
  }

  public renderNoImage(): JSX.Element {
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

  public render(): JSX.Element {
    const {
      avatarPath,
      color,
      innerRef,
      noteToSelf,
      onClick,
      size,
      className,
    } = this.props;
    const { imageBroken } = this.state;

    const hasImage = !noteToSelf && avatarPath && !imageBroken;

    if (![28, 32, 52, 80, 112].includes(size)) {
      throw new Error(`Size ${size} is not supported!`);
    }

    let contents;

    if (onClick) {
      contents = (
        <button
          type="button"
          className="module-avatar-button"
          onClick={onClick}
        >
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
          !hasImage ? `module-avatar--${color}` : null,
          className
        )}
        ref={innerRef}
      >
        {contents}
      </div>
    );
  }
}
