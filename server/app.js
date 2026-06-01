const express = require('express');
const cors = require('cors');
const path = require('path');

const countdownRouter = require('./routes/countdown');
const contentRouter = require('./routes/content');
const progressRouter = require('./routes/progress');
const learningRouter = require('./routes/learning');
const quizRouter = require('./routes/quiz');
const testRouter = require('./routes/test');
const errorbookRouter = require('./routes/errorbook');
const recommendRouter = require('./routes/recommend');
const practiceRouter = require('./routes/practice');
const aiRouter = require('./routes/ai');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/v1/countdown', countdownRouter);
app.use('/api/v1', contentRouter);
app.use('/api/v1/progress', progressRouter);
app.use('/api/v1/learning', learningRouter);
app.use('/api/v1', quizRouter);
app.use('/api/v1', testRouter);
app.use('/api/v1', errorbookRouter);
app.use('/api/v1', recommendRouter);
app.use('/api/v1', practiceRouter);
app.use('/api/v1/ai', aiRouter);

app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, timestamp: new Date().toISOString() });
});

// Serve static frontend in production
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

module.exports = app;
