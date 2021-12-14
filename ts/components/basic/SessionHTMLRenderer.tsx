import React from 'react';
import DOMPurify from 'dompurify';

interface ReceivedProps {
  html: string;
  tag?: string;
  key?: any;
  className?: string;
}

// Needed because of https://github.com/microsoft/tslint-microsoft-contrib/issues/339
type Props = ReceivedProps;

export const SessionHtmlRenderer: React.SFC<Props> = ({ tag = 'div', key, html, className }) => {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['script'],
  });

  return React.createElement(tag, {
    key,
    className,
    // tslint:disable-next-line: react-no-dangerous-html
    dangerouslySetInnerHTML: { __html: clean },
  });
};
