import { describe, expect, it } from 'vitest';

import { validatePasswordChange } from './password-rules';

const ok = { current: 'SenhaAtual1', next: 'NovaSenha123', confirm: 'NovaSenha123' };

describe('validatePasswordChange', () => {
  it('aceita senha nova forte, diferente da atual e confirmada', () => {
    expect(validatePasswordChange(ok)).toEqual({});
  });

  it('exige a senha atual', () => {
    expect(validatePasswordChange({ ...ok, current: '' }).current).toBeDefined();
  });

  it('exige 8 caracteres, com letras e números', () => {
    expect(validatePasswordChange({ ...ok, next: 'Ab1', confirm: 'Ab1' }).next).toBeDefined();
    expect(validatePasswordChange({ ...ok, next: 'somenteletras', confirm: 'somenteletras' }).next).toBeDefined();
    expect(validatePasswordChange({ ...ok, next: '1234567890', confirm: '1234567890' }).next).toBeDefined();
    expect(validatePasswordChange({ ...ok, next: 'abcdefg1', confirm: 'abcdefg1' }).next).toBeUndefined();
  });

  it('recusa nova senha igual à atual', () => {
    expect(validatePasswordChange({ current: 'Mesma1234', next: 'Mesma1234', confirm: 'Mesma1234' }).next).toContain('diferente');
  });

  it('exige que a confirmação seja igual', () => {
    expect(validatePasswordChange({ ...ok, confirm: 'Outra12345' }).confirm).toBeDefined();
  });
});
