// STUB: Type definitions for credit-card-type (payments feature removed)
declare module 'credit-card-type' {
  export type CreditCardType = {
    niceType: string;
    type: string;
    patterns: number[];
    gaps: number[];
    lengths: number[];
    code: {
      name: string;
      size: number;
    };
  };

  export default function creditCardType(cardNumber: string): CreditCardType[];
}
