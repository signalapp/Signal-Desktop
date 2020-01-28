import React from 'react';

interface Props {
  placeholder?: string;
  text?: string;
  editable?: boolean;
  onChange?: any;
}

export class SessionIdEditable extends React.PureComponent<Props> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  public constructor(props: Props) {
    super(props);
    this.inputRef = React.createRef();
  }

  public componentWillUnmount() {
    //FIXME ugly hack to empty the content editable div used on enter session ID
    window.Session.emptyContentEditableDivs();
  }

  public focus() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  public render() {
    const { placeholder, editable, onChange, text } = this.props;

    return (
      <div
        ref={this.inputRef}
        className="session-id-editable"
        placeholder={placeholder}
        contentEditable={editable}
        onInput={(e: any) => {
          if (editable) {
            onChange(e);
          }
        }}
      >
        {text}
      </div>
    );
  }
}
