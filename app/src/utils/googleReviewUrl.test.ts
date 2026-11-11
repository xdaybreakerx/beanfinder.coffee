import { describe, expect, it } from 'vitest';
import { googleReviewUrl } from './googleReviewUrl';

const review = '#lrd=0x2a32a2fb3471435f:0xd4dcbc0e8f299a74,1,,,,';
describe('specific Google review links', () => {
  it('retains the supplied review target while removing search tracking parameters', () => {
    expect(googleReviewUrl(`https://www.google.com/search?q=bean+junction+&hl=en&sca_esv=tracking${review}`))
      .toBe(`https://www.google.com/search?q=bean+junction${review}`);
  });
  it('also accepts direct Google listing links without treating a CID as a Places API ID', () => {
    expect(googleReviewUrl('https://www.google.com/maps?cid=15338341201634499188&tracking=remove'))
      .toBe('https://www.google.com/maps?cid=15338341201634499188');
  });
  it.each([
    'https://maps.app.goo.gl/ExampleBusinessLink',
    'https://goo.gl/maps/ExampleBusinessLink',
    'https://www.google.com/maps/place/Bean+Junction/data=listing',
  ])('accepts a business-specific Maps or shared link: %s', url => {
    expect(googleReviewUrl(`${url}?tracking=remove`)).toBe(url);
  });
  it.each([
    'https://www.google.com/search?q=bean+junction',
    'https://www.beanjunction.coffee/',
    `https://google.com.evil.example/search?q=bean+junction${review}`,
    `http://www.google.com/search?q=bean+junction${review}`,
    `https://user:password@www.google.com/search?q=bean+junction${review}`,
    'https://www.google.com/maps?cid=not-an-id',
    'javascript:alert(1)', null,
  ])('does not identify a rating from a generic or unsafe link: %s', url => {
    expect(googleReviewUrl(url)).toBeUndefined();
  });
});
