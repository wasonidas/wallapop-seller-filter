export const DEFAULT_PREFERENCES = Object.freeze({
  enabled: true,
  minimumReviews: 5,
  verifiedOnly: false,
  showUnchecked: false,
});

export function normalizePreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: source.enabled !== false,
    minimumReviews:
      Number.isSafeInteger(source.minimumReviews) &&
      source.minimumReviews >= 0 && source.minimumReviews <= 999999
        ? source.minimumReviews
        : DEFAULT_PREFERENCES.minimumReviews,
    verifiedOnly: source.verifiedOnly === true,
    showUnchecked: source.showUnchecked === true,
  };
}

/**
 * reviewCount: entero >= 0 | null; verified: boolean | null.
 * Un dato ausente o sin evidencia conserva el estado «unknown».
 * enabled y showUnchecked son políticas de visibilidad, aplicadas aparte.
 */
export function evaluateSeller(seller, preferences) {
  const options = normalizePreferences(preferences);
  const value = seller && typeof seller === 'object' ? seller : {};
  const exclusions = [];
  const missing = [];

  if (!Number.isSafeInteger(value.reviewCount) || value.reviewCount < 0) {
    missing.push('reviews_unknown');
  } else if (value.reviewCount < options.minimumReviews) {
    exclusions.push('too_few_reviews');
  }
  if (options.verifiedOnly) {
    if (value.verified === false) exclusions.push('not_verified');
    else if (value.verified !== true) missing.push('verification_unknown');
  }

  if (exclusions.length) return { status: 'exclude', reasons: exclusions };
  if (missing.length) return { status: 'unknown', reasons: missing };
  return { status: 'match', reasons: [] };
}

export function shouldKeepSeller(seller, preferences) {
  const options = normalizePreferences(preferences);
  if (!options.enabled) return true;
  const { status } = evaluateSeller(seller, options);
  return status === 'match' || (status === 'unknown' && options.showUnchecked);
}
