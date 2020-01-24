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
  id?: string;
  type?: SessionToastType;
  icon?: SessionIconType;
  description?: string;
  closeToast: any;
}

export class SessionToast extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { title, description, type, icon } = this.props;

    const toastType = type ? type : SessionToastType.Info;
    const toastDesc = description ? description : '';
    const toastIconSize = toastDesc
      ? SessionIconSize.Huge
      : SessionIconSize.Medium;

    // Set a custom icon or allow the theme to define the icon
    let toastIcon = icon || undefined;
    if (!toastIcon) {
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
    }

    return (
      <div className={classNames('session-toast', toastType)}>
        <div className="toast-icon">
          <SessionIcon iconType={toastIcon} iconSize={toastIconSize} />
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
