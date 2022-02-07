import React from 'react';
import { RenderTextCallbackType } from '../../types/Util';

type Props = {
  text: string;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonNewLine: RenderTextCallbackType;
};

export const AddNewLines = (props: Props) => {
  const { text, renderNonNewLine } = props;
  const rendered = renderNonNewLine({ text, key: 0 });
  if (typeof rendered === 'string') {
    return <>{rendered}</>;
  }
  return rendered;
};
