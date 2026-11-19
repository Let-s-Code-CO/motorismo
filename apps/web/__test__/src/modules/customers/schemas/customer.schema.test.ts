/**
 * Customer schemas (spec 004).
 *
 * myProfileSchema — what a customer may change about themselves (HU-03): name (required,
 * ≤ 120 characters) and an optional Colombian mobile (RN-03), stored as 10 digits; an empty phone
 * removes it. The email is not part of it (RN-10). Errors are message KEYS under
 * `customers.validation`.
 */
import { myProfileSchema } from '@web/modules/customers/schemas/customer.schema';

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => (result.error?.issues ?? []).map(({ path, message }) => [path.join('.'), message]);

describe('myProfileSchema', () => {
  it('accepts a name and a phone, trimming the name and normalising the phone (CA-13)', () => {
    expect(
      myProfileSchema.parse({ full_name: '  José Pérez ', phone: '+57 311 222 3344' })
    ).toEqual({
      full_name: 'José Pérez',
      phone: '3112223344',
    });
  });

  it('turns an empty phone into null, so saving removes it', () => {
    expect(myProfileSchema.parse({ full_name: 'José', phone: ' ' })).toEqual({
      full_name: 'José',
      phone: null,
    });
  });

  it('rejects an empty name and an invalid phone, each on its field (CA-14)', () => {
    expect(issuesOf(myProfileSchema.safeParse({ full_name: '', phone: '6012345678' }))).toEqual([
      ['full_name', 'fullNameRequired'],
      ['phone', 'phoneInvalid'],
    ]);
  });

  it('ignores any email sent along: the customer cannot change it (RN-10)', () => {
    expect(
      myProfileSchema.parse({ full_name: 'José', phone: '', email: 'otro@correo.test' })
    ).not.toHaveProperty('email');
  });
});
