import { describe, expect, it } from 'vitest';
import { ratingStars, roundRating } from './ratings';

describe('rating stars', () => {
  it.each([[0, 0], [0.24, 0], [0.25, 0.5], [1, 1], [3.24, 3], [3.25, 3.5], [4.2, 4], [4.4, 4.5], [4.7, 4.5], [4.24, 4], [4.25, 4.5], [4.6, 4.5], [4.74, 4.5], [4.75, 5], [5, 5]])('rounds %s to %s', (score, rounded) => {
    expect(roundRating(score)).toBe(rounded);
  });
  it('renders a true half star without rounding every star independently', () => {
    expect(ratingStars(4.6)).toEqual([1, 1, 1, 1, 0.5]);
    expect(ratingStars(3.25)).toEqual([1, 1, 1, 0.5, 0]);
    expect(ratingStars(4.75)).toEqual([1, 1, 1, 1, 1]);
    expect(ratingStars(0)).toEqual([0, 0, 0, 0, 0]);
  });
  it.each([null, undefined, '', '4.5', -1, 5.1, NaN, Infinity])('does not turn invalid or missing ratings into a zero score: %s', score => {
    expect(roundRating(score)).toBeNull();
  });
});
