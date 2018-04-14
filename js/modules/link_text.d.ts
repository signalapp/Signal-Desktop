declare namespace LinkText {
  type Attributes = {
    [key: string]: string;
  }
}

declare function linkText(value: string, attributes: LinkText.Attributes): string;

export = linkText;
