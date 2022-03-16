// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType, RenderTextCallbackType } from '../types/Util';
import type { ReplacementValuesType } from '../types/I18N';
import * as log from '../logging/log';

export type FullJSXType = Array<JSX.Element | string> | JSX.Element | string;
export type IntlComponentsType =
  | undefined
  | Array<FullJSXType>
  | ReplacementValuesType<FullJSXType>;

export type Props = {
  /** The translation string id */
  id: string;
  i18n: LocalizerType;
  components?: IntlComponentsType;
  renderText?: RenderTextCallbackType;
};

export class Intl extends React.Component<Props> {
  public static defaultProps: Partial<Props> = {
    renderText: ({ text, key }) => (
      <React.Fragment key={key}>{text}</React.Fragment>
    ),
  };

  public getComponent(
    index: number,
    placeholderName: string,
    key: number
  ): FullJSXType | null {
    const { id, components } = this.props;

    if (!components) {
      log.error(
        `Error: Intl component prop not provided; Metadata: id '${id}', index ${index}, placeholder '${placeholderName}'`
      );
      return null;
    }

    if (Array.isArray(components)) {
      if (!components || !components.length || components.length <= index) {
        log.error(
          `Error: Intl missing provided component for id '${id}', index ${index}`
        );

        return null;
      }

      return <React.Fragment key={key}>{components[index]}</React.Fragment>;
    }

    const value = components[placeholderName];
    if (!value) {
      log.error(
        `Error: Intl missing provided component for id '${id}', placeholder '${placeholderName}'`
      );

      return null;
    }

    return <React.Fragment key={key}>{value}</React.Fragment>;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public override render() {
    const { components, id, i18n, renderText } = this.props;

    if (!id) {
      log.error('Error: Intl id prop not provided');
      return null;
    }

    const text = i18n(id);
    const results: Array<
      string | JSX.Element | Array<string | JSX.Element> | null
    > = [];
    const FIND_REPLACEMENTS = /\$([^$]+)\$/g;

    // We have to do this, because renderText is not required in our Props object,
    //   but it is always provided via defaultProps.
    if (!renderText) {
      return null;
    }

    if (Array.isArray(components) && components.length > 1) {
      throw new Error(
        'Array syntax is not supported with more than one placeholder'
      );
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
        results.push(renderText({ text: textWithNoReplacements, key }));
        key += 1;
      }

      const placeholderName = match[1];
      results.push(this.getComponent(componentIndex, placeholderName, key));
      componentIndex += 1;
      key += 1;

      lastTextIndex = FIND_REPLACEMENTS.lastIndex;
      match = FIND_REPLACEMENTS.exec(text);
    }

    if (lastTextIndex < text.length) {
      results.push(renderText({ text: text.slice(lastTextIndex), key }));
      key += 1;
    }

    return results;
  }
}
