import React from 'react';

import { Localizer, RenderTextCallback } from '../types/Util';

type FullJSX = Array<JSX.Element | string> | JSX.Element | string;

interface Props {
  /** The translation string id */
  id: string;
  i18n: Localizer;
  components?: Array<FullJSX>;
  renderText?: RenderTextCallback;
}

export class Intl extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderText: ({ text }) => text,
  };

  public getComponent(index: number): FullJSX | null {
    const { id, components } = this.props;

    if (!components || !components.length || components.length <= index) {
      // tslint:disable-next-line no-console
      console.log(
        `Error: Intl missing provided components for id ${id}, index ${index}`
      );

      return null;
    }

    return components[index];
  }

  public render() {
    const { id, i18n, renderText } = this.props;

    const text = i18n(id);
    const results: Array<any> = [];
    const FIND_REPLACEMENTS = /\$[^$]+\$/g;

    // We have to do this, because renderText is not required in our Props object,
    //   but it is always provided via defaultProps.
    if (!renderText) {
      return;
    }

    let componentIndex = 0;
    let key = 0;
    let lastTextIndex = 0;
    let match = FIND_REPLACEMENTS.exec(text);

    if (!match) {
      return renderText({ text, key: 0 });
    }

    while (match) {
      if (lastTextIndex < match.index) {
        const textWithNoReplacements = text.slice(lastTextIndex, match.index);
        results.push(renderText({ text: textWithNoReplacements, key: key }));
        key += 1;
      }

      results.push(this.getComponent(componentIndex));
      componentIndex += 1;

      // @ts-ignore
      lastTextIndex = FIND_REPLACEMENTS.lastIndex;
      match = FIND_REPLACEMENTS.exec(text);
    }

    if (lastTextIndex < text.length) {
      results.push(renderText({ text: text.slice(lastTextIndex), key: key }));
      key += 1;
    }

    return results;
  }
}
