export type RenderTextCallback = (
  options: {
    text: string;
    key: number;
  }
) => JSX.Element;

export type Localizer = (key: string, values?: Array<string>) => string;
