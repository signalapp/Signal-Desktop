import React from 'react';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon/';

interface Props {
  title: string;
  onClose: any;
  onOk: any;
  showExitIcon?: boolean;
  showHeader?: boolean;
  //Maximum of two icons in header
  headerIconButtons?: Array<{
    type: SessionIconType;
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
    const { title, headerIconButtons, showExitIcon, showHeader } = this.props;
    const { isVisible } = this.state;

    return isVisible ? (
      <div className={'session-modal'}>
        {showHeader ? (
          <>
            <div className="session-modal__header">
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
                          key={iconItem.type}
                          iconType={iconItem.type}
                          iconSize={SessionIconSize.Medium}
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
    this.props.onClose();
  }

  public onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.props.onOk();
        break;
      case 'Esc':
      case 'Escape':
        this.close();
        break;
      default:
    }
  }
}
