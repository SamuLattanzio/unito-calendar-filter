// Subject identity is the exact trimmed UniTo `nome`, as used by calendar.js.
export const MAX_BODY_BYTES = 65536;
export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'mode,selectedSubjects' ||
      !['all', 'selected'].includes(value.mode) || !Array.isArray(value.selectedSubjects) ||
      value.selectedSubjects.length > 300 ||
      value.selectedSubjects.some(s => typeof s !== 'string' || !s.length || s.length > 500 || s.trim() !== s || /[\u0000-\u001f\u007f]/u.test(s)) ||
      new Set(value.selectedSubjects).size !== value.selectedSubjects.length ||
      (value.mode === 'all' && value.selectedSubjects.length !== 0)) throw new Error('Preferenze non valide.');
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_BODY_BYTES) throw new Error('Preferenze troppo grandi.');
  return {mode: value.mode, selectedSubjects: [...value.selectedSubjects]};
}
export function fromSelection(selected) {
  return validatePreferences({mode: selected === null ? 'all' : 'selected', selectedSubjects: selected === null ? [] : [...selected]});
}
export function toSelection(value) {
  const valid = validatePreferences(value);
  return valid.mode === 'all' ? null : valid.selectedSubjects;
}
export function fingerprint(value) {
  return JSON.stringify([value.mode, [...value.selectedSubjects].sort()]);
}
