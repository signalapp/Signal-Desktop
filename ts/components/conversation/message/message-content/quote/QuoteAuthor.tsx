import classNames from 'classnames';
import React = require('react');
import { ContactName } from '../../../ContactName';
import { PubKey } from '../../../../../session/types';

type QuoteAuthorProps = {
  author: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  showPubkeyForAuthor?: boolean;
};

export const QuoteAuthor = (props: QuoteAuthorProps) => {
  const { authorProfileName, author, authorName, isFromMe, isIncoming } = props;

  return (
    <div
      className={classNames(
        'module-quote__primary__author',
        isIncoming ? 'module-quote__primary__author--incoming' : null
      )}
    >
      {isFromMe ? (
        window.i18n('you')
      ) : (
        <ContactName
          pubkey={PubKey.shorten(author)}
          name={authorName}
          profileName={authorProfileName}
          compact={true}
          shouldShowPubkey={Boolean(props.showPubkeyForAuthor)}
        />
      )}
    </div>
  );
};
