import React from 'react';
import classNames from 'classnames';


interface Props {
  label: string;
  active: boolean;
}

interface State {
  active: boolean;
}

export class SessionRadio extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
    
    this.state = {
      active: this.props.active,
    }
  }

  public render() {
    const active = this.state.active;
    const { label } = this.props;

    
    return (
      <div className={classNames('session-radio', active && 'checked')}>
        <input type="radio" />
        <label>{ label } </label>
      </div>
    );
  }

  private clickHandler() {
    this.setState({
      active: !this.state.active,
    });
  }
}
