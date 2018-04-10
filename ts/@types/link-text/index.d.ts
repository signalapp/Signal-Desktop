declare module 'link-text' {
  type Attributes = {
    [key: string]: string;
  }
  export default function (value: string, attributes: Attributes): string
}
