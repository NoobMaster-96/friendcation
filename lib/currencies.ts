/**
 * Currencies offered for expenses, grouped by continent for the picker.
 *
 * Money is handled as integers of each currency's ISO 4217 minor unit (cents,
 * paise; JPY and KRW have none) so splits add up exactly. Amounts are never
 * converted between currencies.
 */

export type Continent =
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Africa'
  | 'Oceania';

export type Currency = {
  code: string;
  symbol: string;
  name: string;
  /** ISO 4217 minor unit: 2 for most currencies, 0 for JPY, KRW… */
  decimals: number;
};

export type CurrencyGroup = { continent: Continent; currencies: Currency[] };

type Row = [code: string, symbol: string, name: string, decimals?: number];

const ROWS: [Continent, Row[]][] = [
  [
    'Asia',
    [
      ['INR', 'Rs.', 'Indian rupee'],
      ['CNY', 'CN¥', 'Chinese yuan'],
      ['JPY', '¥', 'Japanese yen', 0],
      ['KRW', '₩', 'South Korean won', 0],
      ['SGD', 'S$', 'Singapore dollar'],
      ['HKD', 'HK$', 'Hong Kong dollar'],
      ['THB', '฿', 'Thai baht'],
      ['IDR', 'Rp', 'Indonesian rupiah'],
      ['MYR', 'RM', 'Malaysian ringgit'],
      ['AED', 'AED', 'UAE dirham'],
    ],
  ],
  [
    'Europe',
    [
      ['EUR', '€', 'Euro'],
      ['GBP', '£', 'British pound'],
      ['CHF', 'CHF', 'Swiss franc'],
      ['SEK', 'kr', 'Swedish krona'],
      ['NOK', 'kr', 'Norwegian krone'],
      ['DKK', 'kr.', 'Danish krone'],
      ['PLN', 'zł', 'Polish złoty'],
      ['CZK', 'Kč', 'Czech koruna'],
      ['HUF', 'Ft', 'Hungarian forint'],
      ['TRY', '₺', 'Turkish lira'],
    ],
  ],
  [
    'North America',
    [
      ['USD', '$', 'US dollar'],
      ['CAD', 'C$', 'Canadian dollar'],
      ['MXN', 'MX$', 'Mexican peso'],
      ['CRC', '₡', 'Costa Rican colón'],
      ['DOP', 'RD$', 'Dominican peso'],
      ['GTQ', 'Q', 'Guatemalan quetzal'],
      ['JMD', 'J$', 'Jamaican dollar'],
      ['HNL', 'L', 'Honduran lempira'],
      ['TTD', 'TT$', 'Trinidad & Tobago dollar'],
      ['BSD', 'B$', 'Bahamian dollar'],
    ],
  ],
  [
    'South America',
    [
      ['BRL', 'R$', 'Brazilian real'],
      ['ARS', 'AR$', 'Argentine peso'],
      ['CLP', 'CL$', 'Chilean peso', 0],
      ['COP', 'CO$', 'Colombian peso'],
      ['PEN', 'S/', 'Peruvian sol'],
      ['UYU', '$U', 'Uruguayan peso'],
      ['PYG', '₲', 'Paraguayan guaraní', 0],
      ['BOB', 'Bs', 'Bolivian boliviano'],
      ['VES', 'Bs.S', 'Venezuelan bolívar'],
      ['GYD', 'G$', 'Guyanese dollar'],
    ],
  ],
  [
    'Africa',
    [
      ['ZAR', 'R', 'South African rand'],
      ['EGP', 'E£', 'Egyptian pound'],
      ['NGN', '₦', 'Nigerian naira'],
      ['KES', 'KSh', 'Kenyan shilling'],
      ['MAD', 'DH', 'Moroccan dirham'],
      ['GHS', 'GH₵', 'Ghanaian cedi'],
      ['TZS', 'TSh', 'Tanzanian shilling'],
      ['UGX', 'USh', 'Ugandan shilling', 0],
      ['ETB', 'Br', 'Ethiopian birr'],
      ['XOF', 'CFA', 'West African CFA franc', 0],
    ],
  ],
  [
    'Oceania',
    [
      ['AUD', 'A$', 'Australian dollar'],
      ['NZD', 'NZ$', 'New Zealand dollar'],
      ['FJD', 'FJ$', 'Fijian dollar'],
      ['PGK', 'K', 'Papua New Guinean kina'],
      ['XPF', '₣', 'CFP franc', 0],
      ['WST', 'WS$', 'Samoan tālā'],
      ['TOP', 'T$', 'Tongan paʻanga'],
      ['SBD', 'SI$', 'Solomon Islands dollar'],
      ['VUV', 'VT', 'Vanuatu vatu', 0],
    ],
  ],
];

export const CURRENCY_GROUPS: CurrencyGroup[] = ROWS.map(([continent, rows]) => ({
  continent,
  currencies: rows.map(([code, symbol, name, decimals = 2]) => ({ code, symbol, name, decimals })),
}));

export const CURRENCIES: Currency[] = CURRENCY_GROUPS.flatMap((g) => g.currencies);

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Unknown codes (not offered in the picker) still format sensibly: code as symbol, 2 decimals. */
export function getCurrency(code: string | null | undefined): Currency {
  const upper = (code || 'INR').toUpperCase();
  return BY_CODE.get(upper) ?? { code: upper, symbol: upper, name: upper, decimals: 2 };
}

// ============================================================
// Minor units
// ============================================================

export function toMinor(value: string | number, code: string): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 10 ** getCurrency(code).decimals) : 0;
}

export function fromMinor(minor: number, code: string): number {
  return minor / 10 ** getCurrency(code).decimals;
}

/** Plain editable value for an amount in minor units: "1234.50", "1234", "¥" → "1000". */
export function minorToInput(minor: number, code: string): string {
  const { decimals } = getCurrency(code);
  const factor = 10 ** decimals;
  return minor % factor ? (minor / factor).toFixed(decimals) : String(minor / factor);
}

/** Up to 12 whole digits (numeric(14,2)) — the database limit. */
const MAX_WHOLE_DIGITS = 12;

/** Keeps digits and, for currencies with minor units, one point and that many decimals. */
export function sanitizeAmountInput(text: string, code: string): string {
  const { decimals } = getCurrency(code);
  const [whole, ...rest] = text.replace(/[^0-9.]/g, '').split('.');
  const digits = whole.slice(0, MAX_WHOLE_DIGITS);
  if (decimals === 0 || rest.length === 0) return digits;
  return `${digits}.${rest.join('').slice(0, decimals)}`;
}

// ============================================================
// Formatting
// ============================================================

/** "1400", "1234.50" — no digit grouping; minor digits only when present (JPY never has any). */
export function formatAmount(amount: number, code = 'INR'): string {
  const { decimals } = getCurrency(code);
  const factor = 10 ** decimals;
  const minor = Math.round(Math.abs(amount) * factor);
  const whole = String(Math.floor(minor / factor));
  const fraction = minor % factor;
  return fraction ? `${whole}.${String(fraction).padStart(decimals, '0')}` : whole;
}

/** Word-like symbols get a space ("Rs. 1400", "CHF 50"); sign-like ones don't ("€450", "HK$20"). */
export function currencyPrefix(code: string): string {
  const { symbol } = getCurrency(code);
  return /[A-Za-z\u00C0-\u024F./]$/.test(symbol) ? `${symbol} ` : symbol;
}

/** Absolute amount with the currency's symbol: "€450", "Rs. 1400", "¥3000". */
export function formatMoney(amount: number, code = 'INR'): string {
  return currencyPrefix(code) + formatAmount(amount, code);
}

// ============================================================
// Picker search — by code or name, ignoring case and accents ("colon" finds colón)
// ============================================================

function fold(text: string): string {
  const lower = text.toLowerCase().replace(/ł/g, 'l').replace(/ʻ/g, '');
  try {
    return lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return lower;
  }
}

const SEARCH_KEYS = new Map(CURRENCIES.map((c) => [c.code, fold(`${c.code} ${c.name}`)]));

export function searchCurrencies(query: string): CurrencyGroup[] {
  const q = fold(query.trim());
  if (!q) return CURRENCY_GROUPS;
  return CURRENCY_GROUPS.map((g) => ({
    continent: g.continent,
    currencies: g.currencies.filter((c) => SEARCH_KEYS.get(c.code)!.includes(q)),
  })).filter((g) => g.currencies.length > 0);
}
