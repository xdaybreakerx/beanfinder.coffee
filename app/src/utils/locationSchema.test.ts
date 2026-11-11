import { describe, expect, it } from 'vitest';
import template from '../../../PR-submission-template.json';
import { validateLocations } from './locationSchema';

const business = { businessId: 'biz-template-fixture' };
const location = {
  ...template, businessId: business.businessId, locationId: 'loc-template-fixture', Name: 'Template Coffee',
  state: 'VIC', address: '10 Coffee Street, Melbourne VIC 3000, Australia',
  placeId: null, latitude: null, longitude: null, rating: null,
  source: { url: 'https://coffee.example/locations', reviewedAt: '2026-10-01T00:00:00Z' },
};
const validate = (fields = {}) => validateLocations([], [{ ...location, ...fields }], [business]).reviewed[0];

describe('submission location review form', () => {
  it('accepts the filled template with unknown optional values and leaves its input unchanged', () => {
    const normalized = validate();
    expect(normalized).toMatchObject({ rating: null, address: location.address });
    expect(normalized).not.toHaveProperty('placeId');
    expect(normalized).not.toHaveProperty('latitude');
    expect(normalized).not.toHaveProperty('longitude');
    expect(location.placeId).toBeNull();
  });

  it('accepts a rating independently of cafe access, coordinates or a Google place ID', () => {
    expect(validate({ hasCafe: false, rating: 4.8 })).toMatchObject({ hasCafe: false, rating: 4.8 });
  });

  it('allows an unknown address when a confirmed place ID identifies the rated branch', () => {
    const normalized = validate({ address: null, placeId: 'confirmed-place', rating: 4.8 });
    expect(normalized).toMatchObject({ placeId: 'confirmed-place', rating: 4.8 });
    expect(normalized).not.toHaveProperty('address');
  });

  it('accepts a sourced static marker and rating together', () => {
    expect(validate({ placeId: 'confirmed-place', latitude: -37.81, longitude: 144.96, rating: 4.8 }))
      .toMatchObject({ placeId: 'confirmed-place', latitude: -37.81, longitude: 144.96, rating: 4.8 });
  });

  it.each([0, -1, 5.1, '4.8', NaN, Infinity])('rejects an invalid manual rating: %s', rating => {
    expect(() => validate({ rating })).toThrow('rating');
  });

  it.each([
    { latitude: -37.8 },
    { longitude: 145 },
    { latitude: -37.8, longitude: 145, placeId: null },
    { latitude: 91, longitude: 145, placeId: 'confirmed-place' },
    { latitude: -37.8, longitude: 181, placeId: 'confirmed-place' },
    { latitude: '-37.8', longitude: 145, placeId: 'confirmed-place' },
    { latitude: NaN, longitude: 145, placeId: 'confirmed-place' },
  ])('rejects incomplete or invalid marker coordinates: %j', fields => {
    expect(() => validate(fields)).toThrow('map markers');
  });

  it('still rejects unknown identities, duplicate places, missing sources and raw provider metadata', () => {
    for (const fields of [{ businessId: 'biz-missing' }, { source: null }, { provider: 'google-maps' }, { address: undefined }]) {
      expect(() => validate(fields)).toThrow();
    }
    expect(() => validateLocations([], [
      { ...location, placeId: 'duplicate' }, { ...location, locationId: 'loc-another', placeId: 'duplicate' },
    ], [business])).toThrow();
  });
});
