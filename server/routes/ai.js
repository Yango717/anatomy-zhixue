const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// Streaming AI chat
router.post('/chat', async (req, res) => {
  try {
    const { apiKey, unitId, scene, messages, currentPage, userProfile } = req.body;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_API_KEY', message: '请先配置DeepSeek API Key' },
        timestamp: new Date().toISOString(),
      });
    }

    // Save user profile if provided (Layer 2 memory)
    if (userProfile && Object.keys(userProfile).length > 0) {
      aiService.saveUserProfile(1, userProfile);
    }

    await aiService.streamChat(
      apiKey, unitId || '', scene || 'learn', messages || [], res,
      { currentPage: currentPage || null }
    );
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

// Save user profile (Layer 2 memory)
router.post('/profile', async (req, res) => {
  try {
    const { profile } = req.body;
    if (!profile) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_PROFILE', message: '请提供用户偏好数据' },
        timestamp: new Date().toISOString(),
      });
    }
    aiService.saveUserProfile(1, profile);
    res.json({ success: true, data: { saved: true }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'PROFILE_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// AI semantic search
router.post('/search', async (req, res) => {
  try {
    const { apiKey, query } = req.body;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_API_KEY', message: '请先配置DeepSeek API Key' },
        timestamp: new Date().toISOString(),
      });
    }
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: '请提供有效的搜索内容' },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await aiService.aiSearch(apiKey, query.trim());
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// Proactive check — what should 学姐 say on her own?
router.get('/proactive', async (req, res) => {
  try {
    const apiKey = req.query.apiKey || req.body?.apiKey;
    if (!apiKey) {
      return res.json({ success: true, data: { triggers: [], message: null } });
    }
    const message = await aiService.generateProactiveMessage(apiKey);
    const context = aiService.getProactiveContext(1);
    res.json({ success: true, data: { message, triggers: context.triggers, context: context.context } });
  } catch (err) {
    res.json({ success: true, data: { triggers: [], message: null } });
  }
});

// Get recent chat history (Layer 0 memory)
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = aiService.getRecentChatHistory(1, limit);
    res.json({ success: true, data: { messages: history }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'HISTORY_ERROR', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
