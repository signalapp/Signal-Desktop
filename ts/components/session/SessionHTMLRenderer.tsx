import React from 'react';
import DOMPurify from 'dompurify';

interface ReceivedProps {
  html: string;
  tag?: string;
  key?: any;
}

type Props = ReceivedProps;

export const SessionHtmlRenderer: React.SFC<Props> = ({
  tag = 'div',
  key,
  html,
}) => {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['style', 'script'],
  });

  return React.createElement(tag, {
    key,
    dangerouslySetInnerHTML: { __html: clean },
  });
};
