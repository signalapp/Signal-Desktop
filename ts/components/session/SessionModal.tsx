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

  private node: HTMLDivElement | null;

  constructor(props: any) {
    super(props);
    this.state = {
      isVisible: true,
    };

    this.close = this.close.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.node = null;

    window.addEventListener('keyup', this.onKeyUp);
  }

  public componentDidMount() {
    document.addEventListener('mousedown', this.handleClick, false);
  }

  public componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClick, false);
  }

  public handleClick = (e: any) => {
    if (this.node && this.node.contains(e.target)) {
      return;
    }

    this.close();
  };

  public render() {
    const {
      title,
      headerIconButtons,
      showExitIcon,
      showHeader,
      headerReverse,
    } = this.props;
    const { isVisible } = this.state;

    return isVisible ? (
      <div ref={node => (this.node = node)} className={'session-modal'}>
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
    document.removeEventListener('mousedown', this.handleClick, false);

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
