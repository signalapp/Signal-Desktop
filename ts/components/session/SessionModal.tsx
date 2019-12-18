import React from 'react';
import classNames from 'classnames';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon/';

interface Props {
  title: string;
  body: any;
}

export class SessionModal extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { title } = this.props;

    return (
      <div className={classNames('session-modal')}>
        <div className="header">
          <div className="close">
            <SessionIconButton
              iconType={SessionIconType.Exit}
              iconSize={SessionIconSize.Small}
            />
          </div>
          <div className="title">{title}</div>
          <div className="icons">
            <SessionIconButton
              iconType={SessionIconType.Search}
              iconSize={SessionIconSize.Medium}
            />
            <SessionIconButton
              iconType={SessionIconType.AddUser}
              iconSize={SessionIconSize.Medium}
            />
          </div>
        </div>
      </div>
    );
  }
}
