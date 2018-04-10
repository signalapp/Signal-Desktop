import linkTextInternal from 'link-text';


export const linkText = (value: string): string =>
  linkTextInternal(value, { target: '_blank' });

export const replaceLineBreaks = (value: string): string =>
  value.replace(/\r?\n/g, '<br>');

// NOTE: How can we use `lodash/fp` `compose` with type checking?
export const render = (value: string): string =>
  replaceLineBreaks(linkText(value));
