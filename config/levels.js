// Prize ladder (in rupees). Question N is worth LEVELS[N-1].
const LEVELS = [
  1000, 2000, 3000, 5000, 10000, 20000, 40000, 80000, 160000, 320000, 500000,
];

// Level numbers (1-based) that act as guaranteed checkpoints.
const SAFE_LEVELS = [5, 9];

const QUESTION_TIME_SECONDS = 45;

// Amount a player keeps when they answer question `level` wrongly.
const safeAmount = (level) => {
  const reached = SAFE_LEVELS.filter((s) => s < level);
  if (!reached.length) return 0;
  return LEVELS[Math.max(...reached) - 1];
};

module.exports = { LEVELS, SAFE_LEVELS, QUESTION_TIME_SECONDS, safeAmount };
