// import { missingCaseError } from './missingCaseError';

type OldColor =
  | 'amber'
  | 'blue'
  | 'blue_grey'
  | 'brown'
  | 'cyan'
  | 'deep_orange'
  | 'deep_purple'
  | 'green'
  | 'grey'
  | 'indigo'
  | 'lime'
  | 'light_blue'
  | 'light_green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

type NewColor =
  | 'red'
  | 'deep_orange'
  | 'brown'
  | 'pink'
  | 'purple'
  | 'indigo'
  | 'blue'
  | 'teal'
  | 'green'
  | 'light_green'
  | 'blue_grey'
  | 'grey';

export function migrateColor(color: OldColor): NewColor {
  switch (color) {
    // These colors no longer exist
    case 'orange':
    case 'amber':
      return 'deep_orange';

    case 'yellow':
      return 'brown';

    case 'deep_purple':
      return 'purple';

    case 'light_blue':
      return 'blue';

    case 'cyan':
      return 'teal';

    case 'lime':
      return 'light_green';

    // These can stay as they are
    case 'red':
    case 'deep_orange':
    case 'brown':
    case 'pink':
    case 'purple':
    case 'indigo':
    case 'blue':
    case 'teal':
    case 'green':
    case 'light_green':
    case 'blue_grey':
    case 'grey':
      return color;

    // Can uncomment this to ensure that we've covered all potential cases
    // default:
    //   throw missingCaseError(color);

    default:
      return 'grey';
  }
}
