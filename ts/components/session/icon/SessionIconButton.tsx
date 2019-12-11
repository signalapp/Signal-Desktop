import React from 'react';
import classNames from 'classnames';

import { Props, SessionIcon } from '../icon';

interface SProps extends Props {
  onClick: any;
}

export class SessionIconButton extends React.PureComponent<SProps> {
  public static readonly extendedDefaults = {
    onClick: () => null,
  };
  public static readonlydefaultProps = {
    ...SessionIcon.defaultProps,
    ...SessionIconButton.extendedDefaults,
  };

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
