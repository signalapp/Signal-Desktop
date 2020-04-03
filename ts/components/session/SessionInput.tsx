import React from 'react';

import classNames from 'classnames';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props {
  label: string;
  error?: string;
  type: string;
  value?: string;
  placeholder: string;
  maxLength?: number;
  enableShowHide?: boolean;
  onValueChanged?: any;
  onEnterPressed?: any;
}

interface State {
  inputValue: string;
  forceShow: boolean;
}

export class SessionInput extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);

    this.updateInputValue = this.updateInputValue.bind(this);
    this.renderShowHideButton = this.renderShowHideButton.bind(this);

    this.state = {
      inputValue: '',
      forceShow: false,
    };
  }

  public render() {
    const {
      placeholder,
      type,
      value,
      maxLength,
      enableShowHide,
      error,
    } = this.props;
    const { forceShow } = this.state;

    const correctType = forceShow ? 'text' : type;

    return (
      <div className="session-input-with-label-container">
        {error ? this.renderError() : this.renderLabel()}
        <input
          id="session-input-floating-label"
          type={correctType}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          onChange={e => {
            this.updateInputValue(e);
          }}
          className={classNames(
            enableShowHide ? 'session-input-floating-label-show-hide' : ''
          )}
          onKeyPress={event => {
            event.persist();
            if (event.key === 'Enter' && this.props.onEnterPressed) {
              this.props.onEnterPressed();
            }
          }}
        />

        {enableShowHide && this.renderShowHideButton()}

        <hr />
      </div>
    );
  }

  private renderLabel() {
    const { inputValue } = this.state;
    const { label } = this.props;

    return (
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
    );
  }

  private renderError() {
    const { error } = this.props;

    return (
      <label
        htmlFor="session-input-floating-label"
        className={classNames(
          'session-input-with-label-container filled error'
        )}
      >
        {error}
      </label>
    );
  }

  private renderShowHideButton() {
    return (
      <SessionIconButton
        iconType={SessionIconType.Eye}
        iconSize={SessionIconSize.Medium}
        iconPadded={false}
        onClick={() => {
          this.setState({
            forceShow: !this.state.forceShow,
          });
        }}
      />
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
