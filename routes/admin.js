const router = require('express').Router();
const User = require('../models/User');
const Game = require('../models/Game');
const Question = require('../models/Question');
const { auth, adminOnly } = require('../middleware/auth');
const { wrap, httpError, validateQuestion } = require('../utils/helpers');

router.use(auth, adminOnly);

router.get(
  '/stats',
  wrap(async (req, res) => {
    const [users, games, won, byStatus, byLevel] = await Promise.all([
      User.countDocuments(),
      Game.countDocuments({ status: { $ne: 'active' } }),
      Game.countDocuments({ status: 'won' }),
      Question.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Question.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$level', n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const q = { approved: 0, pending: 0, rejected: 0 };
    byStatus.forEach((s) => (q[s._id] = s.n));
    res.json({ users, games, won, questions: q, byLevel: byLevel.map((l) => ({ level: l._id, count: l.n })) });
  })
);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/questions',
  wrap(async (req, res) => {
    const { status, level, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);

    const filter = {};
    if (['approved', 'pending', 'rejected'].includes(status)) filter.status = status;
    if (level) filter.level = Number(level);
    if (q) filter.text = new RegExp(escapeRegex(String(q)), 'i');

    const [items, total] = await Promise.all([
      Question.find(filter)
        .populate('createdBy', 'name email')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit),
      Question.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

router.post(
  '/questions',
  wrap(async (req, res) => {
    const { error, data } = validateQuestion(req.body);
    if (error) throw httpError(400, error);
    const q = await Question.create({ ...data, status: 'approved', createdBy: req.user.id });
    res.status(201).json({ question: q });
  })
);

router.put(
  '/questions/:id',
  wrap(async (req, res) => {
    const { error, data } = validateQuestion(req.body);
    if (error) throw httpError(400, error);
    const q = await Question.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!q) throw httpError(404, 'Question not found');
    res.json({ question: q });
  })
);

router.patch(
  '/questions/:id/status',
  wrap(async (req, res) => {
    const { status } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(status)) throw httpError(400, 'Invalid status');
    const q = await Question.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!q) throw httpError(404, 'Question not found');
    res.json({ question: q });
  })
);

router.delete(
  '/questions/:id',
  wrap(async (req, res) => {
    const q = await Question.findByIdAndDelete(req.params.id);
    if (!q) throw httpError(404, 'Question not found');
    res.json({ message: 'Question deleted' });
  })
);

router.get(
  '/users',
  wrap(async (req, res) => {
    const users = await User.find().sort('-createdAt').limit(200);
    const stats = await Game.aggregate([
      { $match: { status: { $ne: 'active' } } },
      { $group: { _id: '$user', games: { $sum: 1 }, best: { $max: '$winnings' } } },
    ]);
    const map = Object.fromEntries(stats.map((s) => [String(s._id), s]));
    res.json({
      items: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        joined: u.createdAt,
        games: map[String(u._id)]?.games || 0,
        best: map[String(u._id)]?.best || 0,
      })),
    });
  })
);

module.exports = router;
