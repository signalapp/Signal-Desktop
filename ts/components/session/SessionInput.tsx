import React from 'react';

import { LocalizerType } from '../../types/Util';
import classNames from 'classnames';

interface Props {
  i18n: LocalizerType;
  label: string;
  type: string;
  value?: string;
  placeholder: string;
  enableShowHide?: boolean;
  onValueChanged?: any;
}

interface State {
  inputValue: string;
  forceShow: boolean;
}

export class SessionInput extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.updateInputValue = this.updateInputValue.bind(this);

    this.state = {
      inputValue: '',
      forceShow: false,
    };
  }

  public render() {
    const { placeholder, type, label, value, enableShowHide } = this.props;
    const { inputValue, forceShow } = this.state;

    const correctType = forceShow ? 'text' : type;

    return (
      <div className="session-input-with-label-container">
        <label
          htmlFor="session-input-floating-label"
          className={classNames(
            inputValue !== ''
              ? 'session-input-with-label-container filled'
              : 'session-input-with-label-container'
          )}
        >
          {label}
        </label>
        <input
          id="session-input-floating-label"
          type={correctType}
          placeholder={placeholder}
          value={value}
          onChange={e => {
            this.updateInputValue(e);
          }}
        />
        <button
          onClick={() => {
            this.setState({
              forceShow: !this.state.forceShow,
            });
          }}
          className={classNames(enableShowHide ? '' : 'hidden')}
        >
          SHOW
        </button>
        <hr />
      </div>
    );
  }

  private updateInputValue(e: any) {
    e.preventDefault();
    this.setState({
      inputValue: e.target.value,
    });

    if (this.props.onValueChanged) {
      this.props.onValueChanged(e.target.value);
    }
  }
}
