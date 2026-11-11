import {describe,it,expect} from 'vitest';
import {validLocale} from '../src/lib/locale';
import {catalog} from '../src/lib/translations';
import {execFileSync} from 'node:child_process';
describe('localisation',()=>{
 it('accepts only supported locales',()=>{expect(validLocale('ar')).toBe('ar');expect(validLocale('en')).toBe('en');expect(validLocale('xx')).toBe('fr');});
 it('provides Arabic and English for every catalog entry',()=>{for(const [source,row] of Object.entries(catalog)){expect(row.ar.trim(),source).not.toBe('');expect(row.en.trim(),source).not.toBe('');}});
 it('covers every declared static interface label',()=>{expect(()=>execFileSync(process.execPath,['scripts/check-translations.cjs'],{stdio:'pipe'})).not.toThrow();});
});
