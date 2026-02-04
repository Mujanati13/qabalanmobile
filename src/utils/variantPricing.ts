import { ProductVariant } from '../services/apiService';

export type VariantPriceBehavior = 'add' | 'override';

const parseVariantNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 0;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const interpretPriceBehavior = (
  behavior?: ProductVariant['price_behavior'] | null
): VariantPriceBehavior => (behavior === 'override' ? 'override' : 'add');

export const computeVariantPriceFromBase = (
  basePrice: number,
  variant?: ProductVariant | null
): {
  unitPrice: number;
  additionAmount: number;
  behavior: VariantPriceBehavior;
  overrideApplied: boolean;
} => {
  const safeBase = Number.isFinite(basePrice) ? basePrice : 0;

  if (!variant) {
    return {
      unitPrice: safeBase,
      additionAmount: 0,
      behavior: 'add',
      overrideApplied: false,
    };
  }

  const behavior = interpretPriceBehavior(variant.price_behavior);
  const modifier = parseVariantNumber(variant.price_modifier);
  const explicitPrice = parseVariantNumber(variant.price);

  if (behavior === 'override') {
    const overrideSource = explicitPrice > 0 ? explicitPrice : modifier;
    const overridePrice = overrideSource > 0 ? overrideSource : safeBase + modifier;

    return {
      unitPrice: overridePrice,
      additionAmount: overridePrice - safeBase,
      behavior,
      overrideApplied: true,
    };
  }

  const hasModifier = Number.isFinite(modifier) && modifier !== 0;
  const additionSource = hasModifier ? modifier : explicitPrice;
  const additionAmount = Number.isFinite(additionSource) ? additionSource : 0;

  return {
    unitPrice: safeBase + additionAmount,
    additionAmount,
    behavior,
    overrideApplied: false,
  };
};

export const sortVariantsForDisplay = (variants: ProductVariant[]): ProductVariant[] => {
  return [...variants].sort((a, b) => {
    const behaviorA = interpretPriceBehavior(a.price_behavior);
    const behaviorB = interpretPriceBehavior(b.price_behavior);

    if (behaviorA !== behaviorB) {
      return behaviorA === 'override' ? -1 : 1;
    }

    const priorityA = a.override_priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.override_priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const labelA = (a.variant_value || a.title_en || a.title_ar || '').toString().toLowerCase();
    const labelB = (b.variant_value || b.title_en || b.title_ar || '').toString().toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;

    return (a.id || 0) - (b.id || 0);
  });
};

export const normalizeVariantPricingMetadata = (
  variant: ProductVariant
): ProductVariant => {
  const behavior = interpretPriceBehavior(variant.price_behavior);
  const rawPriority = variant.override_priority;
  const parsedPriority = rawPriority === null || rawPriority === undefined
    ? null
    : Number(rawPriority);

  return {
    ...variant,
    price_behavior: behavior,
    override_priority: Number.isFinite(parsedPriority) ? parsedPriority : null,
  };
};
