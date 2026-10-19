const router = require('express').Router();
const Game = require('../models/Game');
const Question = require('../models/Question');
const { auth } = require('../middleware/auth');
const { wrap, httpError, shuffle } = require('../utils/helpers');
const { LEVELS, SAFE_LEVELS, QUESTION_TIME_SECONDS, safeAmount } = require('../config/levels');

// Public: ladder configuration.
router.get('/config', (req, res) =>
  res.json({ levels: LEVELS, safeLevels: SAFE_LEVELS, timer: QUESTION_TIME_SECONDS })
);

// Public: top players by best winnings.
router.get(
  '/leaderboard',
  wrap(async (req, res) => {
    const rows = await Game.aggregate([
      { $match: { status: { $ne: 'active' } } },
      { $group: { _id: '$user', best: { $max: '$winnings' }, games: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } } } },
      { $sort: { best: -1, games: 1 } },
      { $limit: 20 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $project: { _id: 0, name: '$u.name', best: 1, games: 1, wins: 1 } },
    ]);
    res.json({ items: rows });
  })
);

// Picks a random approved question for a level; falls back to the nearest level.
const pickQuestion = async (level, used) => {
  const base = { status: 'approved', _id: { $nin: used } };
  let found = await Question.aggregate([{ $match: { ...base, level } }, { $sample: { size: 1 } }]);
  if (!found.length) {
    found = await Question.aggregate([
      { $match: base },
      { $addFields: { d: { $abs: { $subtract: ['$level', level] } } } },
      { $sort: { d: 1 } },
      { $limit: 5 },
      { $sample: { size: 1 } },
    ]);
  }
  return found[0] || null;
};

// What the player is allowed to see. The correct answer is never included here.
const view = (game, q) => ({
  id: game._id,
  status: game.status,
  level: game.level,
  winnings: game.winnings,
  lifelines: game.lifelines,
  hidden: game.hidden,
  hints: { poll: game.hints?.poll || null, phone: game.hints?.phone?.answer != null ? game.hints.phone : null },
  question: q ? { id: q._id, text: q.text, options: q.options, category: q.category } : null,
});

const loadActive = async (req) => {
  const game = await Game.findOne({ _id: req.params.id, user: req.user.id, status: 'active' }).populate('question');
  if (!game) throw httpError(404, 'This game is no longer active');
  return game;
};

const finish = (game, status, winnings) => {
  game.status = status;
  game.winnings = winnings;
  game.endedAt = new Date();
  game.question = undefined;
};

router.get(
  '/active',
  auth,
  wrap(async (req, res) => {
    const game = await Game.findOne({ user: req.user.id, status: 'active' }).populate('question');
    res.json({ game: game ? view(game, game.question) : null });
  })
);

router.post(
  '/start',
  auth,
  wrap(async (req, res) => {
    // Close any game left open so a player only ever has one active game.
    await Game.updateMany({ user: req.user.id, status: 'active' }, { status: 'quit', endedAt: new Date() });

    const first = await pickQuestion(1, []);
    if (!first) throw httpError(503, 'No questions are available yet. Please check back soon.');

    const game = await Game.create({ user: req.user.id, level: 1, question: first._id, usedQuestions: [first._id] });
    res.status(201).json({ game: view(game, first) });
  })
);

router.post(
  '/:id/answer',
  auth,
  wrap(async (req, res) => {
    const game = await loadActive(req);
    const q = game.question;
    const choice = Number(req.body.choice); // -1 means the timer ran out
    const correct = choice === q.correctIndex;

    await Question.updateOne({ _id: q._id }, { $inc: { timesAsked: 1, timesCorrect: correct ? 1 : 0 } });

    if (!correct) {
      finish(game, 'lost', safeAmount(game.level));
      await game.save();
      return res.json({ correct: false, timedOut: choice === -1, correctIndex: q.correctIndex, game: view(game, null) });
    }

    game.winnings = LEVELS[game.level - 1];

    if (game.level >= LEVELS.length) {
      finish(game, 'won', game.winnings);
      await game.save();
      return res.json({ correct: true, correctIndex: q.correctIndex, game: view(game, null) });
    }

    const next = await pickQuestion(game.level + 1, game.usedQuestions);
    if (!next) {
      // Ran out of questions: end the game gracefully with what the player has earned.
      finish(game, 'quit', game.winnings);
      await game.save();
      return res.json({ correct: true, correctIndex: q.correctIndex, game: view(game, null) });
    }

    game.level += 1;
    game.question = next._id;
    game.usedQuestions.push(next._id);
    game.hidden = [];
    game.set('hints', {});
    await game.save();
    res.json({ correct: true, correctIndex: q.correctIndex, game: view(game, next) });
  })
);

// Builds a believable audience poll; accuracy drops as questions get harder.
const buildPoll = (visible, correct, level) => {
  const accuracy = Math.max(35, 90 - (level - 1) * 5 + Math.round(Math.random() * 8 - 4));
  const out = [0, 0, 0, 0];
  const wrong = visible.filter((i) => i !== correct);
  out[correct] = accuracy;
  let rest = 100 - accuracy;
  wrong.forEach((w, i) => {
    const share = i === wrong.length - 1 ? rest : Math.round(Math.random() * rest);
    out[w] = share;
    rest -= share;
  });
  return out;
};

router.post(
  '/:id/lifeline',
  auth,
  wrap(async (req, res) => {
    const type = req.body.type;
    if (!['fifty', 'poll', 'phone', 'flip'].includes(type)) throw httpError(400, 'Unknown lifeline');
    const game = await loadActive(req);
    if (game.lifelines[type]) throw httpError(400, 'You have already used this lifeline');

    const q = game.question;
    const visible = [0, 1, 2, 3].filter((i) => !game.hidden.includes(i));

    if (type === 'fifty') {
      const wrong = shuffle([0, 1, 2, 3].filter((i) => i !== q.correctIndex));
      game.hidden = wrong.slice(0, 2);
    } else if (type === 'poll') {
      game.set('hints.poll', buildPoll(visible, q.correctIndex, game.level));
    } else if (type === 'phone') {
      const confidence = Math.max(40, 96 - (game.level - 1) * 6);
      const knows = Math.random() * 100 < confidence + 8;
      const wrongVisible = visible.filter((i) => i !== q.correctIndex);
      const answer = knows ? q.correctIndex : wrongVisible[Math.floor(Math.random() * wrongVisible.length)];
      game.set('hints.phone', { answer, confidence });
    } else {
      const next = await pickQuestion(game.level, game.usedQuestions);
      if (!next) throw httpError(400, 'No replacement question is available right now');
      game.question = next._id;
      game.usedQuestions.push(next._id);
      game.hidden = [];
      game.set('hints', {});
      game.lifelines[type] = true;
      await game.save();
      return res.json({ game: view(game, next) });
    }

    game.lifelines[type] = true;
    await game.save();
    res.json({ game: view(game, q) });
  })
);

router.post(
  '/:id/quit',
  auth,
  wrap(async (req, res) => {
    const game = await loadActive(req);
    const q = game.question;
    finish(game, 'quit', game.winnings);
    await game.save();
    res.json({ correctIndex: q.correctIndex, game: view(game, null) });
  })
);

router.get(
  '/history',
  auth,
  wrap(async (req, res) => {
    const items = await Game.find({ user: req.user.id, status: { $ne: 'active' } })
      .sort('-createdAt')
      .limit(20)
      .select('status level winnings createdAt');
    res.json({ items });
  })
);

module.exports = router;
