import React from 'react';
import classNames from 'classnames';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon/';

interface Props {
  title: string;
  onClose: any;
  onOk: any;
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
    const { title, headerIconButtons } = this.props;
    const { isVisible } = this.state;

    return isVisible ? (
        <div className={classNames('session-modal')}>
          <div className="session-modal__header">
            <div className="session-modal__header__close">
              <SessionIconButton
                iconType={SessionIconType.Exit}
                iconSize={SessionIconSize.Small}
                onClick={this.close}
              />
            </div>
            <div className="session-modal__header__title">{title}</div>
            <div className="session-modal__header__icons">
              { headerIconButtons ? headerIconButtons.map((iconItem: any) => {
                return (
                  <SessionIconButton
                    iconType={iconItem.type}
                    iconSize={SessionIconSize.Medium}
                  />
                )
                }) : null
              }
            </div>
          </div>

          <div className="session-modal__body">
            {this.props.children}
          </div>
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

  public onKeyUp(event: any){
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
