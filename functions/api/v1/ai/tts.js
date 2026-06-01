// Cloudflare Pages Function — proxy TTS to Doubao V3
export async function onRequestPost(context) {
  const { request } = context;

  try {
    const { text, ttsKey, ttsAppId } = await request.json();

    if (!ttsKey || !text) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing ttsKey or text' },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const speaker = ttsAppId || 'zh_female_xiaohe_uranus_bigtts';
    const reqid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Clean markdown before TTS
    const cleanText = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.+?\)/g, '')
      .replace(/[*_~`#\[\](){}>|\\]/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim()
      .replace(/\s+/g, ' ');

    const doubaoRes = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': ttsKey,
        'X-Api-Resource-Id': 'seed-tts-2.0',
        'X-Api-Request-Id': reqid,
      },
      body: JSON.stringify({
        user: { uid: 'anatomy_student' },
        req_params: {
          text: cleanText,
          speaker,
          audio_params: { format: 'mp3', sample_rate: 24000 },
          reqid,
        },
      }),
    });

    if (!doubaoRes.ok) {
      const errText = await doubaoRes.text();
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'TTS_API_ERROR', message: `Doubao: ${doubaoRes.status}` },
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const raw = await doubaoRes.text();
    const lines = raw.split('\n').filter((l) => l.trim());
    let audioBase64 = '';
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.data) audioBase64 += json.data;
      } catch {}
    }

    if (!audioBase64) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'TTS_EMPTY', message: 'No audio returned' },
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      data: { audio: audioBase64, format: 'mp3' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'TTS_ERROR', message: err.message },
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
