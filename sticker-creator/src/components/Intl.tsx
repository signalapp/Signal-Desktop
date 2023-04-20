// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import createDebug from 'debug';

import type {
  LocalizerType,
  RenderTextCallbackType,
  ReplacementValuesType,
} from '../types.d';
import { assert } from '../util/assert';

const debug = createDebug('signal:components:Intl');

export type IntlComponentsType =
  | undefined
  | ReplacementValuesType<React.ReactNode>;

export type Props = {
  /** The translation string id */
  id: string;
  i18n: LocalizerType;
  components?: IntlComponentsType;
  renderText?: RenderTextCallbackType;
};

const defaultRenderText: RenderTextCallbackType = ({ text, key }) => (
  <React.Fragment key={key}>{text}</React.Fragment>
);

export class Intl extends React.Component<Props> {
  public getComponent(
    index: number,
    placeholderName: string,
    key: number
  ): JSX.Element | null {
    const { id, components } = this.props;

    if (!components) {
      debug(
        `Error: Intl component prop not provided; Metadata: id '${id}', ` +
          `index ${index}, placeholder '${placeholderName}'`
      );
      return null;
    }

    if (Array.isArray(components)) {
      if (!components || !components.length || components.length <= index) {
        debug(
          `Error: Intl missing provided component for id '${id}', ` +
            `index ${index}`
        );

        return null;
      }

      return <React.Fragment key={key}>{components[index]}</React.Fragment>;
    }

    const value = components[placeholderName];
    if (!value) {
      debug(
        `Error: Intl missing provided component for id '${id}', ` +
          `placeholder '${placeholderName}'`
      );

      return null;
    }

    return <React.Fragment key={key}>{value}</React.Fragment>;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public override render() {
    const { components, id, i18n, renderText = defaultRenderText } = this.props;

    if (!id) {
      debug('Error: Intl id prop not provided');
      return null;
    }

    if (!i18n.isLegacyFormat(id)) {
      assert(
        !Array.isArray(components),
        `components cannot be an array for ICU message ${id}`
      );
      const intl = i18n.getIntl();
      return intl.formatMessage({ id }, components);
    }

    const text = i18n(id);
    const results: Array<
      string | JSX.Element | Array<string | JSX.Element> | null
    > = [];
    const FIND_REPLACEMENTS = /\$([^$]+)\$/g;

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
