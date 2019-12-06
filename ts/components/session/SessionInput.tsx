import React from 'react';

import { LocalizerType } from '../../types/Util';
import classNames from 'classnames';

interface Props {
  i18n: LocalizerType;
  label: string;
  type: string;
  placeholder: string;
  enableShowHide?: boolean;
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
    const { placeholder, type, label, enableShowHide } = this.props;
    const { inputValue, forceShow } = this.state;

    const correctType = forceShow ? 'text' : type;

    return (
      <div className="input-with-label-container">
        <label
          htmlFor="floatField"
          className={classNames(
            inputValue !== ''
              ? 'input-with-label-container filled'
              : 'input-with-label-container'
          )}
        >
          {label}
        </label>
        <input
          id="floatField"
          type={correctType}
          placeholder={placeholder}
          value={inputValue}
          onBlur={e => {
            this.updateInputValue(e);
          }}
          onChange={e => {
            this.updateInputValue(e);
          }}
        />
        <button
          onClick={() =>
            this.setState({
              forceShow: !this.state.forceShow,
            })
          }
          className={classNames(enableShowHide ? '' : '')}
        >
          SHOW
        </button>
        <hr />
      </div>
    );
  }

  private updateInputValue(e: any) {
    this.setState({
      inputValue: e.target.value,
    });

    e.preventDefault();
  }
}
