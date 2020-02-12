import React from 'react';
import classNames from 'classnames';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon/';
import { SessionButtonColor, SessionButtonType } from './SessionButton';

interface Props {
  title: string;
  onClose: any;
  onOk: any;
  showExitIcon?: boolean;
  showHeader?: boolean;
  headerReverse?: boolean;
  //Maximum of two icons or buttons in header
  headerIconButtons?: Array<{
    iconType: SessionIconType;
    iconRotation: number;
    onClick?: any;
  }>;
  headerButtons?: Array<{
    buttonType: SessionButtonType;
    buttonColor: SessionButtonColor;
    text: string;
    onClick?: any;
  }>;
}

interface State {
  isVisible: boolean;
}

export class SessionModal extends React.PureComponent<Props, State> {
  public static defaultProps = {
    showExitIcon: true,
    showHeader: true,
    headerReverse: false,
  };

  constructor(props: any) {
    super(props);
    this.state = {
      isVisible: true,
    };

    this.close = this.close.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const {
      title,
      headerIconButtons,
      showExitIcon,
      showHeader,
      headerReverse,
    } = this.props;
    const { isVisible } = this.state;

    console.log(this.props.children, "what is actually in here");


    return isVisible ? (
      <div className={'session-modal'}>
        {showHeader ? (
          <>
            <div
              className={classNames(
                'session-modal__header',
                headerReverse && 'reverse'
              )}
            >
              <div className="session-modal__header__close">
                {showExitIcon ? (
                  <SessionIconButton
                    iconType={SessionIconType.Exit}
                    iconSize={SessionIconSize.Small}
                    onClick={this.close}
                  />
                ) : null}
              </div>
              <div className="session-modal__header__title">{title}</div>
              <div className="session-modal__header__icons">
                {headerIconButtons
                  ? headerIconButtons.map((iconItem: any) => {
                      return (
                        <SessionIconButton
                          key={iconItem.iconType}
                          iconType={iconItem.iconType}
                          iconSize={SessionIconSize.Large}
                          iconRotation={iconItem.iconRotation}
                          onClick={iconItem.onClick}
                        />
                      );
                    })
                  : null}
              </div>
            </div>
          </>
        ) : null}

        <div className="session-modal__body">{this.props.children}</div>
      </div>
    ) : null;
  }

  public close() {
    this.setState({
      isVisible: false,
    });

    window.removeEventListener('keyup', this.onKeyUp);

    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  public onKeyUp(event: any) {
    switch (event.key) {
      case 'Esc':
      case 'Escape':
        this.close();
        break;
      default:
    }
  }
}
