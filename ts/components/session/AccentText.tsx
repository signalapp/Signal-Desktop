import React from 'react';

import { LocalizerType } from '../../types/Util';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';

interface Props {
  i18n: LocalizerType;
  showSubtitle?: boolean;
}
export class AccentText extends React.PureComponent<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { showSubtitle, i18n } = this.props;


    return (
      <div className="session-content-accent-text">
        <div className="session-content-accent-text title">
          <SessionHtmlRenderer html={i18n('beginYourSession')} />
        </div>
        {showSubtitle ? (
          <div className="session-content-accent-text subtitle">
            <SessionHtmlRenderer html={i18n('ensuringPeaceOfMind...')} />
          </div>
        ) : (
            ''
          )}
      </div>
    );
  }
}
