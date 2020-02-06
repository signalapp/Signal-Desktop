export type RenderTextCallbackType = (
  options: {
    text: string;
    key: number;
    isGroup?: boolean;
    convoId?: string;
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

export enum Colors {
  OFFLINE = '#3d3e44',
  OFFLINE_LIGHT = '#cccece',
  ONLINE = '#00f782',
}
