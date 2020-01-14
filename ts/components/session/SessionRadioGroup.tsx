import React from 'react';
import classNames from 'classnames';

interface Props {
  activeItem: Number;
}

interface State {
  activeItem: Number;
}

export class SessionRadioGroup extends React.PureComponent<Props, State> {
  public static defaultProps = {
    onClick: () => null,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    return (
      <div
        className='session-radio-group'
        onClick={this.clickHandler}
      >
        <label className="radio-container">Four
            <input type="checkbox"/>>
            <span className="radio-checkmark"></span>
        </label>
      </div>
    );
  }

  private clickHandler(e: any) {
    return;
  }
}
