const ONE_DAY = 24 * 60 * 60 * 1000;

export function isLinkPreviewDateValid(value: unknown): value is number {
  const maximumLinkPreviewDate = Date.now() + ONE_DAY;
  return (
    typeof value === 'number' &&
    value !== 0 &&
    Number.isFinite(value) &&
    value < maximumLinkPreviewDate
  );
}
