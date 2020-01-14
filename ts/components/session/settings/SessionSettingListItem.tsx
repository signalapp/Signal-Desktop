import React from 'react';
import { SessionToggle } from '../SessionToggle';
import { SessionButton, SessionButtonColor } from '../SessionButton';
import { SessionSettingType } from './SessionSettings';

interface Props {
  title: string;
  description?: string;
  type: SessionSettingType;
  value: any;
  options?: Array<any>;
  onClick?: any;
  buttonText?: string;
  buttonColor?: SessionButtonColor;
}

export class SessionSettingListItem extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    this.state = {};

    this.handleClick = this.handleClick.bind(this);
  }

  public render(): JSX.Element {
    const {
      title,
      description,
      type,
      value,
      buttonText,
      buttonColor,
    } = this.props;

    return (
      <div className="session-settings-item">
        <div className="session-settings-item__info">
          <div className="session-settings-item__title">{title}</div>

          {description && (
            <div className="session-settings-item__description">
              {description}
            </div>
          )}
        </div>

        {type === SessionSettingType.Toggle && (
          <div className="session-sessings-item__selection">
            <SessionToggle active={Boolean(value)} onClick={this.handleClick} />
          </div>
        )}

        {type === SessionSettingType.Button && (
          <SessionButton
            text={buttonText}
            buttonColor={buttonColor}
            onClick={this.handleClick}
          />
        )}
      </div>
    );
  }

  private handleClick() {
    this.props.onClick && this.props.onClick();
  }
}
