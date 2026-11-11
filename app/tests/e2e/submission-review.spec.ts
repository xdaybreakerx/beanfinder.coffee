import { expect, test } from '@playwright/test';
import roasters from '../../src/data/coffee-roasters.json' with { type: 'json' };
import reviewedData from '../../src/data/reviewed-places.json' with { type: 'json' };
import { googleReviewUrl } from '../../src/utils/googleReviewUrl';

const records = reviewedData as Array<{ businessId: string; address?: string | null; placeId?: string | null; rating?: number | null; source: { url: string } }>;

test('a review-only score keeps an online listing without a fabricated address or marker', async ({ page }) => {
  const business = roasters.find(item => {
    const reviews = records.filter(record => record.businessId === item.businessId);
    return !item.hasCafe && reviews.length && reviews.every(record => !record.address && !record.placeId) &&
      reviews.some(record => typeof record.rating === 'number');
  });
  test.skip(!business, 'No rating-only online business in this directory revision');
  const review = records.filter(record => record.businessId === business!.businessId)
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))[0];
  await page.route('https://www.googletagmanager.com/**', route => route.abort());
  await page.goto(`/roasters/?q=${encodeURIComponent(business!.Name)}`);
  const row = page.locator(`.roaster-row[data-business-id="${business!.businessId}"]:visible`);
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-rating', String(review.rating));
  await expect(row.locator('.online-only')).toBeVisible();
  await expect(row.locator('.map-pin, .location-disclosure')).toHaveCount(0);
  const reviewsLink = row.getByRole('link', { name: `View ${business!.Name} Google reviews (opens in a new tab)`, exact: true });
  await expect(reviewsLink).toHaveAttribute('href', googleReviewUrl(review.source.url)!);
  await expect(reviewsLink.getByRole('img')).toBeVisible();
});
