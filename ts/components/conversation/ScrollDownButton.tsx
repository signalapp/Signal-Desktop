import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';

type Props = {
  count: number;
  conversationId: string;

  scrollDown: (conversationId: string) => void;

  i18n: LocalizerType;
};

export class ScrollDownButton extends React.Component<Props> {
  public render() {
    const { conversationId, count, i18n, scrollDown } = this.props;

    let altText = i18n('scrollDown');
    if (count > 1) {
      altText = i18n('messagesBelow');
    } else if (count === 1) {
      altText = i18n('messageBelow');
    }

    return (
      <div className="module-scroll-down">
        <button
          className={classNames(
            'module-scroll-down__button',
            count > 0 ? 'module-scroll-down__button--new-messages' : null
          )}
          onClick={() => {
            scrollDown(conversationId);
          }}
          title={altText}
        >
          <div className="module-scroll-down__icon" />
        </button>
      </div>
    );
  }
}
