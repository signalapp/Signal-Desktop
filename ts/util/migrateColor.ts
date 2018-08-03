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
  | 'blue'
  | 'cyan'
  | 'deep_orange'
  | 'grey'
  | 'green'
  | 'indigo'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal';

export function migrateColor(color: OldColor): NewColor {
  switch (color) {
    // These colors no longer exist
    case 'brown':
      return 'red';

    case 'deep_purple':
      return 'purple';

    case 'light_blue':
      return 'blue';

    case 'blue_grey':
      return 'cyan';

    case 'light_green':
    case 'lime':
      return 'green';

    case 'orange':
    case 'amber':
    case 'yellow':
      return 'deep_orange';

    // These can stay as they are
    case 'blue':
    case 'cyan':
    case 'deep_orange':
    case 'green':
    case 'grey':
    case 'indigo':
    case 'pink':
    case 'purple':
    case 'red':
    case 'teal':
      return color;

    // Can uncomment this to ensure that we've covered all potential cases
    // default:
    //   throw missingCaseError(color);

    default:
      return 'grey';
  }
}
