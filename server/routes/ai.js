const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// Streaming AI chat
router.post('/chat', async (req, res) => {
  try {
    const { apiKey, unitId, scene, messages } = req.body;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_API_KEY', message: '请先配置DeepSeek API Key' },
        timestamp: new Date().toISOString(),
      });
    }
    await aiService.streamChat(apiKey, unitId || '', scene || 'learn', messages || [], res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'AI_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// Generate quiz questions
router.post('/generate-quiz', async (req, res) => {
  try {
    const { apiKey, unitId, count } = req.body;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_API_KEY', message: '请先配置DeepSeek API Key' },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await aiService.generateQuiz(apiKey, unitId || '', count || 3);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// Generate review report
router.post('/review-report', async (req, res) => {
  try {
    const { apiKey, unitId } = req.body;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_API_KEY', message: '请先配置DeepSeek API Key' },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await aiService.generateReviewReport(apiKey, unitId || '');
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// Generate today's recommendation
router.post('/today-recommend', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_API_KEY', message: '请先配置DeepSeek API Key' },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await aiService.generateTodayRecommend(apiKey);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// Text-to-Speech (Doubao)
router.post('/tts', async (req, res) => {
  try {
    const { text, ttsKey, ttsAppId } = req.body;
    if (!ttsKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_TTS_KEY', message: '请先配置豆包TTS Key' },
        timestamp: new Date().toISOString(),
      });
    }
    if (!text) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_TEXT', message: '请提供要合成的文本' },
        timestamp: new Date().toISOString(),
      });
    }
    const audioBase64 = await aiService.doubaoTTS(ttsKey, ttsAppId || 'anatomy_flash', text);
    res.json({ success: true, data: { audio: audioBase64, format: 'mp3' }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'TTS_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
