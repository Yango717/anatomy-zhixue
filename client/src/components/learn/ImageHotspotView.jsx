export default function ImageHotspotView({ image, hotspots, activeFlashcardId, onHotspotClick }) {
  if (!image) return null;

  function handleDotClick(cardId) {
    onHotspotClick(cardId);
  }

  const imgSrc = image.src;
  // If relative path, no need to modify — served from the unit's content directory

  return (
    <div className="hotspot-container">
      <img
        className="hotspot-container__image"
        src={imgSrc}
        alt={image.alt || ''}
        draggable={false}
      />
      {hotspots.map((spot) => {
        const isActive = spot.id === activeFlashcardId;
        return (
          <button
            key={spot.id}
            className={`hotspot-dot ${isActive ? 'hotspot-dot--active' : ''}`}
            style={{ left: `${spot.hotspot.x}%`, top: `${spot.hotspot.y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              handleDotClick(spot.id);
            }}
            aria-label={`查看 ${spot.front}`}
          >
            {spot.number}
          </button>
        );
      })}
    </div>
  );
}
