// Tool requirements:
//   - Feed it a set of regular expressions with descriptions as to what the risks are
//   - Feed it also a set of exceptions
//   - It would tell us if there were any new matches that didn't already have exceptions
//
// Rules:
// {
//   "name": "rule-name",
//   "expression": "^regex-as-string$",
//   "reason": "Reason that this expression is dangerous"
// }
//
// Categories of reasons - low to high risk:
//   "falseMatch"
//   "testCode"
//   "exampleCode"
//   "otherUtilityCode"
//   "regexMatchedSafeCode"
//   "notExercisedByOurApp"
//   "ruleNeeded"
//   "usageTrusted"
//
// Exceptions:
// [{
//   "rule": "rule-name",
//   "path": "path/to/filename.js",
//   "lineNumber": 45,
//   "reasonCategory": "<category from list above>",
//   "updated": "2018-09-08T00:21:13.180Z",
//   "reasonDetail": "<Optional additional information about why this is okay>"
// }]
//
// When the tool finds issues it outputs them in exception format to make it easy to add
//   to the exceptions.json file

export const REASONS = [
  'falseMatch',
  'testCode',
  'exampleCode',
  'otherUtilityCode',
  'regexMatchedSafeCode',
  'notExercisedByOurApp',
  'ruleNeeded',
  'usageTrusted',
];

export type RuleType = {
  name: string;
  expression: string | null;
  reason: string;
  regex: RegExp;
  excludedModules: Array<string> | null;
};

export type ExceptionType = {
  rule: string;
  path: string;
  line?: string;
  lineNumber: number;
  reasonCategory: string;
  updated: string;
  reasonDetail: string;
};
