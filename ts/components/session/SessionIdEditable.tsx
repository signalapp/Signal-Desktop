import React from 'react';

interface Props {
  placeholder?: string;
  text?: string;
  editable?: boolean;
  onChange?: any;
  onPressEnter?: any;
}

export class SessionIdEditable extends React.PureComponent<Props> {
  private readonly inputRef: any;

  public constructor(props: Props) {
    super(props);
    this.inputRef = React.createRef();
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public focus() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  public render() {
    const { placeholder, editable, text } = this.props;

    return (
      <div className="session-id-editable">
        <textarea
          className="session-id-editable-textarea"
          ref={this.inputRef}
          placeholder={placeholder}
          disabled={!editable}
          spellCheck={false}
          onKeyDown={this.handleKeyDown}
          onChange={this.handleChange}
          value={text}
        />
      </div>
    );
  }

  private handleChange(e: any) {
    const { editable, onChange } = this.props;
    if (editable) {
      onChange(e.target.value);
    }
  }

  private handleKeyDown(e: any) {
    const { editable, onPressEnter } = this.props;
    if (editable && e.keyCode === 13) {
      e.preventDefault();
      // tslint:disable-next-line: no-unused-expression
      onPressEnter && onPressEnter();
    }
  }
}
