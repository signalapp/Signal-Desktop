import React from 'react';

import { SessionHtmlRenderer } from './SessionHTMLRenderer';

interface Props {
  showSubtitle?: boolean;
}
export class AccentText extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { showSubtitle } = this.props;

    return (
      <div className="session-content-accent-text">
        <div className="session-content-accent-text title">
          <SessionHtmlRenderer html={window.i18n('beginYourSession')} />
        </div>
        {showSubtitle && (
          <div className="session-content-accent-text subtitle">
            <SessionHtmlRenderer html={window.i18n('ensuringPeaceOfMind...')} />
          </div>
        )}
      </div>
    );
  }
}
