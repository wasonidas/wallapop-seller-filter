import { evaluateSeller } from './filter.js';

// Cada anuncio pertenece a una sola categoría. «Procesado» incluye intentos
// fallidos y datos desconocidos; no equivale a una coincidencia comprobada.
export function summarizeResults(results, preferences) {
  const counts = { total: 0, match: 0, excluded: 0, pending: 0, unchecked: 0,
    unknown: 0, errors: 0, identityUnknown: 0, unprocessed: 0, processed: 0 };
  for (const result of results) {
    counts.total++;
    if (!result || result.status === 'unprocessed') counts.unchecked++;
    else if (result.status === 'pending') counts.pending++;
    else if (result.status === 'error') counts.errors++;
    else if (result.status === 'checked') {
      const evaluation = evaluateSeller(result.seller, preferences);
      if (evaluation.status === 'match') counts.match++;
      else if (evaluation.status === 'exclude') counts.excluded++;
      else {
        counts.unknown++;
        if (evaluation.reasons.includes('verification_unknown')) counts.identityUnknown++;
      }
    } else counts.unknown++;
  }
  counts.unprocessed = counts.unchecked;
  counts.processed = counts.total - counts.unchecked - counts.pending;
  return counts;
}
