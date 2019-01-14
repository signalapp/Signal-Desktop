export type RenderTextCallbackType = (
  options: {
    text: string;
    key: number;
  }
) => JSX.Element | string;

export type LocalizerType = (key: string, values?: Array<string>) => string;

export type ColorType =
  | 'gray'
  | 'blue'
  | 'cyan'
  | 'deep_orange'
  | 'green'
  | 'indigo'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal';
