import React from 'react';
import classNames from 'classnames';

export enum SessionButtonType {
  Brand = 'brand',
  BrandOutline = 'brand-outline',
  Default = 'default',
  DefaultOutline = 'default-outline',
  Square = 'square',
  SquareOutline = 'square-outline',
  Simple = 'simple',
}

export enum SessionButtonColor {
  Green = 'green',
  White = 'white',
  Primary = 'primary',
  Secondary = 'secondary',
  Success = 'success',
  Danger = 'danger',
  Warning = 'warning',
}

interface Props {
  text: string;
  buttonType: SessionButtonType;
  buttonColor: SessionButtonColor;
  onClick: any;
}

export class SessionButton extends React.PureComponent<Props> {
  public static defaultProps = {
    buttonType: SessionButtonType.Default,
    buttonColor: SessionButtonColor.Primary,
    onClick: () => null,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    const { buttonType, buttonColor, text } = this.props;

    const buttonTypes = [];

    buttonTypes.push(buttonType);
    if (buttonType.includes('-outline')) {
      buttonTypes.push(buttonType.replace('-outline', ''));
    }

    return (
      <div
        className={classNames('session-button', ...buttonTypes, buttonColor)}
        role="button"
        onClick={this.clickHandler}
      >
        {text}
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
