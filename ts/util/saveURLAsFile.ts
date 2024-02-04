export const saveURLAsFile = ({
  filename,
  url,
  document,
}: {
  filename: string;
  url: string;
  document: Document;
}): void => {
  const anchorElement = document.createElement('a');
  anchorElement.href = url;
  anchorElement.download = filename;
  anchorElement.click();
};
