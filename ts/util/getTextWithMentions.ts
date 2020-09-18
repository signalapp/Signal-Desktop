import { BodyRangesType } from '../types/Util';

export function getTextWithMentions(
  bodyRanges: BodyRangesType,
  text: string
): string {
  return bodyRanges.reduce((str, range) => {
    const textBegin = str.substr(0, range.start);
    const textEnd = str.substr(range.start + range.length, str.length);
    return `${textBegin}@${range.replacementText}${textEnd}`;
  }, text);
}
