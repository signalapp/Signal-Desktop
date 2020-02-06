import React from 'react';

interface Props {
  label: string;
  value: string;
  active: boolean;
  group?: string;
  onClick: any;
}

interface State {
  active: boolean;
}

export class SessionRadio extends React.PureComponent<Props, State> {
  public static defaultProps = {
    onClick: () => null,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);

    this.state = {
      active: this.props.active,
    };
  }

  public render() {
    const active = this.state.active;
    const { label, group, value } = this.props;

    return (
      <div className="session-radio">
        <input
          type="radio"
          name={group || ''}
          value={value}
          defaultChecked={active}
          aria-checked={active}
          onClick={this.clickHandler}
        />
        <label>{label} </label>
      </div>
    );
  }

  private clickHandler(e: any) {
    if (this.props.onClick) {
      e.stopPropagation();
      this.props.onClick();

      this.setState({
        active: !this.state.active,
      });
    }
  }
}
