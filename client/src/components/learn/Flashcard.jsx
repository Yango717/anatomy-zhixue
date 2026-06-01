import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Flashcard({ card, isFlipped, onFlip }) {
  return (
    <div className="flashcard" onClick={onFlip}>
      <div className={`flashcard__inner ${isFlipped ? 'flashcard__inner--flipped' : ''}`}>
        {/* 正面：编号 + 结构名 */}
        <div className="flashcard__face flashcard__face--front">
          <span className="flashcard__number">{card.number}</span>
          <h3 className="flashcard__name">{card.front}</h3>
          <p className="flashcard__hint">点击翻转查看详情</p>
        </div>

        {/* 反面：详细内容 */}
        <div className="flashcard__face flashcard__face--back">
          <h4 className="flashcard__title">{card.back.title}</h4>
          <div className="flashcard__detail">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {card.back.detail}
            </ReactMarkdown>
          </div>
          {card.back.clinical && (
            <div className="flashcard__extra flashcard__extra--clinical">
              <span className="flashcard__label">临床</span>
              <p>{card.back.clinical}</p>
            </div>
          )}
          {card.back.mnemonic && (
            <div className="flashcard__extra flashcard__extra--mnemonic">
              <span className="flashcard__label">口诀</span>
              <p>{card.back.mnemonic}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
