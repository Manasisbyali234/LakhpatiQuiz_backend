const { LEVELS } = require('../config/levels');

// Wrap async route handlers so errors reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (status, message) => Object.assign(new Error(message), { status });

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Validates and normalises a question payload (used by admin + user submissions).
const validateQuestion = (body) => {
  const text = String(body.text || '').trim();
  const options = Array.isArray(body.options) ? body.options.map((o) => String(o || '').trim()) : [];
  const correctIndex = Number(body.correctIndex);
  const level = Number(body.level || 1);
  const category = String(body.category || 'General Knowledge').trim().slice(0, 40);

  if (text.length < 5) return { error: 'Question must be at least 5 characters' };
  if (text.length > 300) return { error: 'Question must be 300 characters or fewer' };
  if (options.length !== 4 || options.some((o) => !o)) return { error: 'Provide exactly 4 options' };
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return { error: 'Options must all be different' };
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3)
    return { error: 'Choose the correct option' };
  if (!Number.isInteger(level) || level < 1 || level > LEVELS.length)
    return { error: `Level must be between 1 and ${LEVELS.length}` };

  return { data: { text, options, correctIndex, level, category } };
};

module.exports = { wrap, httpError, shuffle, validateQuestion };
