import React from 'react';
import classNames from 'classnames';

import { Props, SessionIcon } from './SessionIcon';

export class SessionIconButton extends React.PureComponent<Props> {
  public static defaultProps = SessionIcon.defaultProps;

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    return (
      <div
        className={classNames(
          'session-icon-button',
          this.props.iconSize,
          this.props.iconPadded ? 'padded' : ''
        )}
        role="button"
        onClick={e => {
          this.clickHandler(e);
        }}
      >
        <SessionIcon
          iconType={this.props.iconType}
          iconSize={this.props.iconSize}
          iconColor={this.props.iconSize}
          iconRotation={this.props.iconRotation}
          onClick={this.props.onClick}
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
