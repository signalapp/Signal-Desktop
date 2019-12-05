import React from 'react';
import classNames from 'classnames';

//import { LocalizerType } from '../../types/Util';

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
  Danger = 'danger',
  Warning = 'warning',
}

interface Props {
  //i18n: LocalizerType;
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

    return (
      <div
        className={classNames('session-button', buttonType, buttonColor)}
        role="button"
        onClick={e => {
          this.clickHandler(e);
        }}
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
