import { I18nManager } from 'react-native';

export const DEFAULT_CURRENCY = 'JOD';
export const EN_LOCALE = 'en-JO';
export const AR_LOCALE = 'ar-JO';

type CurrencyFormatOptions = {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  fallbackSymbol?: string;
  isRTL?: boolean;
  useEnglishNumerals?: boolean; // Force English numerals even in Arabic
};

/**
 * Convert Arabic/Eastern numerals (٠-٩) to English/Western numerals (0-9)
 */
export const toEnglishNumerals = (str: string): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const englishNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = str;
  arabicNumerals.forEach((arabic, index) => {
    result = result.replace(new RegExp(arabic, 'g'), englishNumerals[index]);
  });
  return result;
};

const formatterCache = new Map<string, Intl.NumberFormat | null>();

const getFormatter = (
  locale: string,
  currency: string,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  currencyDisplay: Required<CurrencyFormatOptions>['currencyDisplay'] = 'narrowSymbol'
) => {
  const cacheKey = `${locale}|${currency}|${minimumFractionDigits}|${maximumFractionDigits}|${currencyDisplay}`;
  if (!formatterCache.has(cacheKey)) {
    try {
      formatterCache.set(
        cacheKey,
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits,
          maximumFractionDigits,
          currencyDisplay
        })
      );
    } catch (error) {
      console.warn('[currency] Intl.NumberFormat unavailable, using fallback formatting.', error);
      formatterCache.set(cacheKey, null);
    }
  }

  return formatterCache.get(cacheKey);
};

const getFallbackSymbol = (locale: string, explicitSymbol?: string) => {
  if (explicitSymbol) return explicitSymbol;
  return locale.startsWith('ar') ? 'د.ا.‏' : 'JD';
};

const formatWithFallback = (
  value: number,
  locale: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  fallbackSymbol?: string
) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = safeValue.toFixed(Math.max(minimumFractionDigits, 0));
  const symbol = getFallbackSymbol(locale, fallbackSymbol);

  if (locale.startsWith('ar')) {
    return `${symbol} ${formatted}`;
  }

  return `${symbol} ${formatted}`;
};

export const formatCurrency = (
  value: unknown,
  options: CurrencyFormatOptions = {}
) => {
  const {
    locale: providedLocale,
    currency = DEFAULT_CURRENCY,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    currencyDisplay = 'narrowSymbol',
    fallbackSymbol,
    isRTL,
    useEnglishNumerals = true // Default to English numerals for consistency
  } = options;

  // ALWAYS use English locale for number formatting to ensure consistent numerals
  // Only use Arabic locale for currency symbol positioning
  const locale = useEnglishNumerals ? EN_LOCALE : (providedLocale || (isRTL ?? I18nManager.isRTL ? AR_LOCALE : EN_LOCALE));

  const numericValue = typeof value === 'string' ? Number(value) : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  const formatter = getFormatter(locale, currency, minimumFractionDigits, maximumFractionDigits, currencyDisplay);
  if (formatter) {
    try {
      let formatted = formatter.format(safeValue);
      
      // Convert any Arabic numerals to English for consistency
      if (useEnglishNumerals) {
        formatted = toEnglishNumerals(formatted);
      }
      
      return formatted;
    } catch (error) {
      console.warn('[currency] Failed to format via Intl, using fallback.', error);
    }
  }

  let fallbackFormatted = formatWithFallback(safeValue, locale, minimumFractionDigits, maximumFractionDigits, fallbackSymbol);
  
  // Convert any Arabic numerals to English for consistency
  if (useEnglishNumerals) {
    fallbackFormatted = toEnglishNumerals(fallbackFormatted);
  }
  
  return fallbackFormatted;
};

export const formatCurrencyWithoutSymbol = (
  value: unknown,
  options: Omit<CurrencyFormatOptions, 'currencyDisplay' | 'fallbackSymbol'> = {}
) => {
  const formatted = formatCurrency(value, { ...options, currencyDisplay: 'code' });
  return formatted.replace(/[^\d.,\-]+/g, '').trim();
};

/**
 * Format a plain number (not currency) with English numerals
 * Use this for quantities, IDs, counts, etc.
 */
export const formatNumber = (
  value: unknown,
  options: { decimals?: number; useEnglishNumerals?: boolean } = {}
): string => {
  const { decimals = 0, useEnglishNumerals = true } = options;
  
  const numericValue = typeof value === 'string' ? Number(value) : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  
  let formatted = decimals > 0 
    ? safeValue.toFixed(decimals)
    : Math.round(safeValue).toString();
  
  // Convert any Arabic numerals to English for consistency
  if (useEnglishNumerals) {
    formatted = toEnglishNumerals(formatted);
  }
  
  return formatted;
};
