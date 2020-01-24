import React from 'react';

import { SessionIconButton, SessionIconType, SessionIconSize } from './icon';

interface Props {
  count: number,
}

export class SessionScrollButton extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    console.log(`My count is: ${this.props.count}`);

    return (
        <SessionIconButton
            iconType={SessionIconType.Chevron}
            iconSize={SessionIconSize.Huge}
            iconColor={"#FFFFFF"}
        />
    );
  }
}
