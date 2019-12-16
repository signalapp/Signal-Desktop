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
  description?: string;
  type?: SessionToastType;
  id?: string;
  fadeToast: any;
  closeToast: any;
}

export class SessionToast extends React.PureComponent<Props> {
  public static defaultProps = {
    id: '',
  };
  
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { title, description, type } = this.props;

    const toastType = type ? type : SessionToastType.Info;
    const toastDesc = description ? description : '';

    let toastIcon;
    switch (type) {
      case SessionToastType.Info:
        toastIcon = SessionIconType.Info;
        break;
      case SessionToastType.Success:
        toastIcon = SessionIconType.Check;
        break;
      case SessionToastType.Error:
        toastIcon = SessionIconType.Error;
        break;
      case SessionToastType.Warning:
        toastIcon = SessionIconType.Warning;
        break;
      default:
        toastIcon = SessionIconType.Info;
    }

    return (
      <div className={classNames('session-toast', toastType)}>
        <div className="toast-icon">
          <SessionIcon iconType={toastIcon} iconSize={toastDesc ? SessionIconSize.Large : SessionIconSize.Medium } />
        </div>
        <div className="toast-info">
          <div className="toast-info-container">
            <h3 className="title">{title}</h3>
            <p className="description">{toastDesc}</p>
          </div>
        </div>

        <div className="toast-close">
          <SessionIconButton
            iconType={SessionIconType.Exit}
            iconSize={SessionIconSize.Small}
            onClick={this.props.closeToast}
          />
        </div>
      </div>
    );
  }
}
