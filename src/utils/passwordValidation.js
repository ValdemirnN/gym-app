// Regras de senha usadas tanto no cadastro quanto na redefinição de senha.
// Mantidas num único lugar para não haver divergência entre as telas.

export const PASSWORD_RULES = [
  { key: 'length', label: 'No mínimo 7 caracteres', test: (pwd) => (pwd || '').length >= 7 },
  { key: 'uppercase', label: 'Uma letra maiúscula', test: (pwd) => /[A-Z]/.test(pwd || '') },
  { key: 'number', label: 'Um número', test: (pwd) => /[0-9]/.test(pwd || '') },
  {
    key: 'special',
    label: 'Um caractere especial (ex: ! @ # $ % &)',
    test: (pwd) => /[^A-Za-z0-9]/.test(pwd || ''),
  },
];

// Retorna as regras que AINDA NÃO foram atendidas.
export function getUnmetPasswordRules(password) {
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

export function isPasswordValid(password) {
  return getUnmetPasswordRules(password).length === 0;
}
