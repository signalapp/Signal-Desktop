import React from 'react';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';

export class SessionScrollButton extends React.PureComponent {
  constructor(props: any) {
    super(props);
  }

  public render() {
    return (
      <SessionIconButton
        iconType={SessionIconType.Chevron}
        iconSize={SessionIconSize.Huge}
        iconColor={'#FFFFFF'}
      />
    );
  }
}
