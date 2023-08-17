// Refactored from
// https://stackoverflow.com/questions/2685911/is-there-a-way-to-round-numbers-into-a-reader-friendly-format-e-g-1-1k

const abbreviations = ['k', 'm', 'b', 't'];

export function abbreviateNumber(number: number, decimals: number = 2): string {
  let result = String(number);
  const d = 10 ** decimals;

  // Go through the array backwards, so we do the largest first
  for (let i = abbreviations.length - 1; i >= 0; i--) {
    // Convert array index to "1000", "1000000", etc
    const size = 10 ** ((i + 1) * 3);

    // If the number is bigger or equal do the abbreviation
    if (size <= number) {
      // Here, we multiply by decimals, round, and then divide by decimals.
      // This gives us nice rounding to a particular decimal place.
      let n = Math.round((number * d) / size) / d;

      // Handle special case where we round up to the next abbreviation
      if (n === 1000 && i < abbreviations.length - 1) {
        n = 1;
        i++;
      }

      result = String(n) + abbreviations[i];
      break;
    }
  }

  return result;
}
