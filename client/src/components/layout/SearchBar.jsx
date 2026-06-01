import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [aiResults, setAiResults] = useState(null); // AI semantic results
  const [searching, setSearching] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    if (val.length < 2) { setResults([]); setAiResults(null); return; }

    // Normal text search
    setSearching(true);
    api.get('/search', { q: val })
      .then((d) => setResults(d.results || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));

    // AI semantic search (debounced, for natural language queries)
    const isNaturalQuery = val.length >= 6 || val.includes('?') || val.includes('？') || val.includes('什么') || val.includes('怎么') || val.includes('哪里');
    if (isNaturalQuery) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const apiKey = localStorage.getItem('deepseek_api_key');
        if (!apiKey) return;
        setAiSearching(true);
        api.post('/ai/search', { apiKey, query: val })
          .then((d) => {
            if (d?.matches?.length > 0) {
              setAiResults(d);
            } else {
              setAiResults(null);
            }
          })
          .catch(() => setAiResults(null))
          .finally(() => setAiSearching(false));
      }, 800);
    } else {
      setAiResults(null);
    }
  }

  function handleResultClick(result) {
    const parts = result.filePath.split('/').filter(Boolean);
    if (parts.length >= 3) {
      const subDir = parts[2];
      const subMatch = subDir.match(/^subsection-(\d+)-(\d+)-(\d+)-(.+)$/);
      if (subMatch) {
        const subId = `sub-${subMatch[1]}-${subMatch[2]}-${subMatch[3]}`;
        const partName = subMatch[4];
        navigate(`/learn/${encodeURIComponent(subId + '-part-' + partName)}`, { state: { partTitle: partName } });
      }
    }
    setOpen(false);
    setQuery('');
    setResults([]);
    setAiResults(null);
  }

  function handleAiResultClick(match) {
    // Navigate to modules page (can't resolve exact unitId from AI result alone)
    navigate('/modules');
    setOpen(false);
    setQuery('');
    setResults([]);
    setAiResults(null);
  }

  return (
    <>
      <button className="topbar__search-btn" onClick={() => setOpen(true)}>
        🔍
      </button>

      {open && (
        <div className="search-overlay">
          <div className="search-overlay__header">
            <input
              className="search-overlay__input"
              type="text"
              placeholder="搜索解剖知识点...（支持自然语言）"
              value={query}
              onChange={handleInput}
              autoFocus
            />
            <button className="btn btn--ghost btn--sm" onClick={() => { setOpen(false); setQuery(''); setResults([]); setAiResults(null); }}>
              取消
            </button>
          </div>
          <div className="search-overlay__body">
            {(searching || aiSearching) && query.length >= 2 && <div className="page-loading">搜索中...</div>}

            {/* AI semantic results */}
            {!aiSearching && aiResults && aiResults.matches?.length > 0 && (
              <div className="search-ai-section">
                <div className="search-ai-section__label">🤖 AI 理解你的意思：</div>
                {aiResults.matches.map((m, i) => (
                  <button key={`ai-${i}`} className="search-result search-result--ai" onClick={() => handleAiResultClick(m)}>
                    <div className="search-result__path">{m.title}</div>
                    <p className="search-result__snippet">{m.path} · 匹配度：{m.relevance}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Normal text results */}
            {!searching && results.map((r, i) => (
              <button key={i} className="search-result" onClick={() => handleResultClick(r)}>
                <div className="search-result__path">{r.headings.join(' › ')}</div>
                {r.matches.slice(0, 2).map((m, j) => (
                  <p key={j} className="search-result__snippet">...{m.text}...</p>
                ))}
              </button>
            ))}

            {!searching && !aiSearching && query.length >= 2 && results.length === 0 && !aiResults && (
              <div className="empty-hint">未找到相关内容，换个关键词试试？</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
