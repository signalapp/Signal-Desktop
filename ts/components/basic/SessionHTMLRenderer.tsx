import DOMPurify from 'dompurify';
import { createElement } from 'react';

type ReceivedProps = {
  html: string;
  tag?: string;
  key?: any;
  className?: string;
};

export const SessionHtmlRenderer = ({ tag = 'div', key, html, className }: ReceivedProps) => {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['script'],
  });

  return createElement(tag, {
    key,
    className,

    dangerouslySetInnerHTML: { __html: clean },
  });
};
