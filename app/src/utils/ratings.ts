// Star graphics and their accessible names use half-star steps; sorting retains the source score.
export function roundRating(rating: unknown): number | null {
  return typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5
    ? Math.round(rating * 2) / 2
    : null;
}

export function ratingStars(rating: unknown): Array<0 | 0.5 | 1> {
  const rounded = roundRating(rating);
  return Array.from({ length: 5 }, (_, index) => rounded === null ? 0 : Math.min(1, Math.max(0, rounded - index)) as 0 | 0.5 | 1);
}

export function compareListingRatings(a: number | null, b: number | null, direction: 'asc' | 'desc'): number {
  // Missing scores stay last in either direction; callers break ties by name.
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return direction === 'asc' ? a - b : b - a;
}
