import React from 'react';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

interface Props {
  onClick?: () => any;
  show?: boolean;
}

export class SessionScrollButton extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    return (
      <>
        {this.props.show && (
          <div className="session-scroll-button">
            <SessionIconButton
              iconType={SessionIconType.Chevron}
              iconSize={SessionIconSize.Huge}
              iconColor={'#FFFFFF'}
              onClick={this.props.onClick}
            />
          </div>
        )}
      </>
    );
  }
}
