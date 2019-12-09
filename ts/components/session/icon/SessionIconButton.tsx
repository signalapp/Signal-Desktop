import React from 'react';
import classNames from 'classnames';

import { Props, SessionIcon } from '../icon';

export class SessionIconButton extends React.PureComponent<Props> {
  public static defaultProps = SessionIcon.defaultProps;

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    const {
      iconType,
      iconSize,
      iconColor,
      iconRotation,
      iconPadded,
      onClick,
    } = this.props;

    return (
      <div
        className={classNames(
          'session-icon-button',
          iconSize,
          iconPadded ? 'padded' : ''
        )}
        role="button"
        onClick={e => {
          this.clickHandler(e);
        }}
      >
        <SessionIcon
          iconType={iconType}
          iconSize={iconSize}
          iconColor={iconColor}
          iconRotation={iconRotation}
          onClick={onClick}
        />
      </div>
    );
  }

  private clickHandler(e: any) {
    if (this.props.onClick) {
      e.stopPropagation();
      this.props.onClick();
    }
  }
}
