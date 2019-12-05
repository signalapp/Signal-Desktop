import React from 'react';
import classNames from 'classnames';

export enum SessionIconButtonTypes {
  'exit' = 'exit',
  'search' = 'search',
  'back' = 'back',
  'attachment' = 'attachment',
  'emoji' = 'emoji',
  'favorite' = 'favorite',
  'group' = 'group',
  'menu' = 'menu',
  'message' = 'message',
  'microphone' = 'microphone',
  'network' = 'network',
  'options' = 'options',
  'theme' = 'theme',
}

export enum SessionIconButtonSizes {
  'small' = 'small',
  'medium' = 'medium',
  'large' = 'large',
}

interface Props {
  iconType: SessionIconButtonTypes;
  iconSize: SessionIconButtonSizes;
  onClick: any;
}

export class SessionIconButton extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    const { iconType, iconSize } = this.props;

    const iconPath = `./images/session/icon-${iconType}.svg`;

    return (
      <div
        className={classNames(
          'session-icon-button',
          iconType === SessionIconButtonTypes.exit ? 'exit' : '',
          iconType === SessionIconButtonTypes.search ? 'search' : '',
          iconType === SessionIconButtonTypes.back ? 'back' : '',
          iconSize === SessionIconButtonSizes.small ? 'small' : '',
          iconSize === SessionIconButtonSizes.medium ? 'medium' : '',
          iconSize === SessionIconButtonSizes.large ? 'large' : ''
        )}
        role="button"
        onClick={e => {
          this.clickHandler(e);
        }}
      >
        <img src={iconPath} alt="Icon Button" />
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
