export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;

export type ReplacementValuesType = {
  [key: string]: string;
};

export type LocalizerType = (
  key: string,
  values?: Array<string> | ReplacementValuesType
) => string;
