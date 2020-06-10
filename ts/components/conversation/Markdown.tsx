import React from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

interface Props {
  text: string;
}

export class Markdown extends React.Component<Props> {
  public render() {
    const { text } = this.props;

    const md = new MarkdownIt({
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(lang, str).value;
        }

        return ''; // use external default escaping
      },
    });

    return <div dangerouslySetInnerHTML={{ __html: md.render(text) }} />;
  }
}
