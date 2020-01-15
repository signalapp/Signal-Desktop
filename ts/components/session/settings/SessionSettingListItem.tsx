import React from 'react';
import classNames from 'classnames';

import { SessionToggle } from '../SessionToggle';
import { SessionButton } from '../SessionButton';
import { SessionSettingType } from './SessionSettings';

import { SessionRadioGroup } from '../SessionRadioGroup';

interface Props {
  title: string;
  description?: string;
  type: SessionSettingType;
  value: any;
  options?: Array<any>;
  onClick?: any;
  content: any;
}

export class SessionSettingListItem extends React.Component<Props> {
  public static defaultProps = {
    inline: true,
  }
  
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
      content,
    } = this.props;

    const inline = ![SessionSettingType.Options, SessionSettingType.Slider].includes(type);

    return (
      <div className={classNames('session-settings-item', inline && 'inline')}>
        <div className='session-settings-item__info'>
          <div className='session-settings-item__title'>{title}</div>

          {description && (
            <div className="session-settings-item__description">
              {description}
            </div>
          )}
        </div>

        <div className="session-settings-item__content">
          {type === SessionSettingType.Toggle && (
            <div className="session-sessings-item__selection">
              <SessionToggle active={Boolean(value)} onClick={this.handleClick} />
            </div>
          )}

          {type === SessionSettingType.Button && (
            <SessionButton
              text={content.buttonText}
              buttonColor={content.buttonColor}
              onClick={this.handleClick}
            />
          )}

          {type === SessionSettingType.Options && (
            <SessionRadioGroup
              initalItem={content.options.initalItem}
              group={content.options.group}
              items={content.options.items}
              onClick={this.handleClick}
            />
          )}
        </div>
      </div>
    );
  }

  private handleClick() {
    this.props.onClick && this.props.onClick();
  }
}
