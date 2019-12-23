import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props {
  searchString: string;
  onChange: any;
  handleNavigation?: any;
  placeholder: string;
}

export class SessionSearchInput extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public render() {
    const { searchString } = this.props;

    return (
      <div className="session-search-input">
        <SessionIconButton
          iconSize={SessionIconSize.Medium}
          iconType={SessionIconType.Search}
        />
        <input
          value={searchString}
          onChange={e => this.props.onChange(e.target.value)}
          onKeyDown={this.handleKeyDown}
          placeholder={this.props.placeholder}
        />
      </div>
    );
  }

  public handleKeyDown(e: any) {
    if (e.keyCode === 38 || e.keyCode === 40 || e.key === 'Enter') {
      // Up or Bottom arrow pressed
      if (this.props.handleNavigation) {
        e.stopPropagation();
        this.props.handleNavigation(e);
      }
    }
  }
}
