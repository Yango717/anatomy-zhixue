const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('../server/config');

const countdownRouter = require('../server/routes/countdown');
const contentRouter = require('../server/routes/content');
const progressRouter = require('../server/routes/progress');
const learningRouter = require('../server/routes/learning');
const quizRouter = require('../server/routes/quiz');
const testRouter = require('../server/routes/test');
const errorbookRouter = require('../server/routes/errorbook');
const recommendRouter = require('../server/routes/recommend');
const practiceRouter = require('../server/routes/practice');
const motionRouter = require('../server/routes/motion');
const resetRouter = require('../server/routes/reset');
const analyticsRouter = require('../server/routes/analytics');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/v1/countdown', countdownRouter);
app.use('/api/v1', contentRouter);
app.use('/api/v1/progress', progressRouter);
app.use('/api/v1/learning', learningRouter);
app.use('/api/v1', quizRouter);
app.use('/api/v1', testRouter);
app.use('/api/v1', errorbookRouter);
app.use('/api/v1', recommendRouter);
app.use('/api/v1', practiceRouter);
app.use('/api/v1/motion', motionRouter);
app.use('/api/v1/reset', resetRouter);
app.use('/api/v1', analyticsRouter);

app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, timestamp: new Date().toISOString() });
});

module.exports = app;
