import React from 'react';
import classNames from 'classnames';

import {
  SessionIcon,
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from './icon/';

export enum SessionToastType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

interface Props {
  title: string;
  description: string;
  type: SessionToastType;
}

export class SessionToast extends React.PureComponent<Props> {
  public static defaultProps = {
    description: '',
    type: SessionToastType.Info,
  };

  constructor(props: any) {
    super(props);
  }

  public render() {
    const { title, description, type } = this.props;

    let toastIcon;
    switch (type) {
      case SessionToastType.Info:
        toastIcon = SessionIconType.Eye;
        break;
      case SessionToastType.Success:
        toastIcon = SessionIconType.Check;
        break;
      case SessionToastType.Error:
        toastIcon = SessionIconType.Search;
        break;
      case SessionToastType.Warning:
        toastIcon = SessionIconType.Globe;
        break;
      default:
        toastIcon = SessionIconType.Globe;
    }

    return (
      <div className={classNames('session-toast', type)}>
        <div className="toast-icon">
          <SessionIcon iconType={toastIcon} iconSize={SessionIconSize.Large} />
        </div>
        <div className="toast-info">
          <div className="toast-info-container">
            <h3 className="title">{title}</h3>
            <p className="description">{description}</p>
          </div>
        </div>

        <div className="toast-close">
          <SessionIconButton
            iconType={SessionIconType.Exit}
            iconSize={SessionIconSize.Small}
            onClick={this.closeToast}
          />
        </div>
      </div>
    );
  }

  public closeToast() {
    return;
  }
}
