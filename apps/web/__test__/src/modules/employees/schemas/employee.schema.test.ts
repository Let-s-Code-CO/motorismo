/**
 * employeeSchema — the employee form, checked before anything is sent (spec 007, HU-02).
 *
 * Guards:
 * - CA-08: a full name (up to 120 characters), a document type and number, and a commission are
 *   required; the phone is optional but must be a Colombian mobile; the commission is a whole
 *   percentage from 0 to 100 (RN-06). Every problem is reported at once, next to its field.
 * - CA-09 / RN-04: the document is kept without dots, spaces or hyphens: «1.020.304.050» is
 *   1020304050. A cédula (CC), a cédula de extranjería (CE) and a PPT have digits only (3 to 15);
 *   a passport may have letters (5 to 20), kept in upper case.
 * - The Server Action parses the form's output again: numbers are accepted as they are.
 */
import { employeeSchema } from '@web/modules/employees/schemas/employee.schema';

const input = (overrides: Record<string, unknown> = {}) => ({
  full_name: 'Elkin Estrada',
  document_type: 'cc',
  document_number: '1.020.304.050',
  phone: '300 111 2233',
  commission_pct: '35',
  ...overrides,
});

const issuesOf = (value: unknown) => {
  const result = employeeSchema.safeParse(value);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

describe('employeeSchema', () => {
  it('normalises the document, the phone and the commission (CA-07, CA-09)', () => {
    expect(employeeSchema.parse(input())).toEqual({
      full_name: 'Elkin Estrada',
      document_type: 'cc',
      document_number: '1020304050',
      phone: '3001112233',
      commission_pct: 35,
    });
  });

  it('keeps a passport number with its letters, in upper case (RN-04)', () => {
    expect(
      employeeSchema.parse(input({ document_type: 'passport', document_number: 'ab 12345' }))
    ).toMatchObject({ document_number: 'AB12345' });
  });

  it('accepts no phone, and its own output again (numbers and null)', () => {
    const parsed = employeeSchema.parse(input({ phone: '' }));

    expect(parsed.phone).toBeNull();
    expect(employeeSchema.parse(parsed)).toEqual(parsed);
  });

  it('reports every missing field at once (CA-08)', () => {
    expect(
      issuesOf({
        full_name: ' ',
        document_type: '',
        document_number: ' . ',
        phone: '',
        commission_pct: '',
      })
    ).toEqual({
      full_name: 'fullNameRequired',
      document_type: 'documentTypeRequired',
      document_number: 'documentRequired',
      commission_pct: 'commissionRequired',
    });
  });

  it.each([
    ['cc', 'AB1234', 'letters in a cédula'],
    ['ce', '12', 'fewer than 3 digits'],
    ['ppt', '1234567890123456', 'more than 15 digits'],
    ['passport', 'AB1', 'fewer than 5 characters in a passport'],
  ])('refuses a %s «%s» (%s) (CA-08)', (type, number) => {
    expect(issuesOf(input({ document_type: type, document_number: number }))).toEqual({
      document_number: 'documentInvalid',
    });
  });

  it('refuses a phone that is not a Colombian mobile (CA-08)', () => {
    expect(issuesOf(input({ phone: '601 555 1234' }))).toEqual({ phone: 'phoneInvalid' });
  });

  it.each(['-1', '101', '12,5', '12.5', 'mucho'])(
    'refuses «%s» as a commission (CA-08, RN-06)',
    (commission) => {
      expect(issuesOf(input({ commission_pct: commission }))).toEqual({
        commission_pct: 'commissionInvalid',
      });
    }
  );

  it('accepts the limits of the commission: 0 and 100 (RN-06)', () => {
    expect(issuesOf(input({ commission_pct: '0' }))).toEqual({});
    expect(issuesOf(input({ commission_pct: '100' }))).toEqual({});
  });

  it('refuses a name longer than 120 characters (CA-08)', () => {
    expect(issuesOf(input({ full_name: 'x'.repeat(121) }))).toEqual({
      full_name: 'fullNameTooLong',
    });
  });
});
