/**
 * initialsOf — the letters an avatar shows when there is no photo (spec 002, CA-30), which are
 * also the visible text of the phone's account button (spec 009, CA-04).
 *
 * Guards:
 * - The button's accessible name must contain what it shows (WCAG 2.5.3, axe
 *   `label-content-name-mismatch`), so the avatar and the name use this one function.
 * - First letter of the first two words, upper case; accents kept; extra spaces ignored.
 */
import { initialsOf } from '@web/modules/auth/utils/initials.utils';

describe('initialsOf', () => {
  it('takes the first letter of the first two words, in upper case', () => {
    expect(initialsOf('Carlos Díaz')).toBe('CD');
    expect(initialsOf('sebastián pulido gómez')).toBe('SP');
  });

  it('keeps accented letters as they are', () => {
    expect(initialsOf('Óscar Ñáñez')).toBe('ÓÑ');
  });

  it('gives one letter for a single word, and ignores extra spaces', () => {
    expect(initialsOf('  Camila  ')).toBe('C');
    expect(initialsOf('Ana   María')).toBe('AM');
  });

  it('gives nothing for an empty name', () => {
    expect(initialsOf('   ')).toBe('');
  });
});
