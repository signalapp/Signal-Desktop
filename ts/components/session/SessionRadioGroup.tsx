import React from 'react';

import { SessionRadio } from './SessionRadio';

interface Props {
  initalItem: string;
  items: Array<any>;
  group: string;
  onClick?: any;
}

interface State {
  activeItem: string;
}

export class SessionRadioGroup extends React.PureComponent<Props, State> {
  public static defaultProps = {
    onClick: () => null,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);

    this.state = {
      activeItem: this.props.initalItem,
    };
  }

  public render() {
    const { items, group } = this.props;

    return (
      <div className="session-radio-group">
        <fieldset id={group}>
          {items.map(item => {
            const itemIsActive = item.value === this.state.activeItem;

            return (
              <SessionRadio
                key={item.value}
                label={item.label}
                active={itemIsActive}
                value={item.value}
                group={group}
                onClick={this.clickHandler}
              />
            );
          })}
        </fieldset>
      </div>
    );
  }

  private clickHandler() {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }
}
