import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props {
  searchString: string;
  onChange: any;
  placeholder: string;
}

export class SessionSearchInput extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
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
          placeholder={this.props.placeholder}
        />
      </div>
    );
  }
}
