export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;

export type LocalizerType = (key: string, values?: Array<string>) => string;

export type ColorType =
  | 'red'
  | 'deep_orange'
  | 'brown'
  | 'pink'
  | 'purple'
  | 'indigo'
  | 'blue'
  | 'teal'
  | 'green'
  | 'light_green'
  | 'blue_grey'
  | 'grey'
  | 'ultramarine'
  | 'signal-blue';
