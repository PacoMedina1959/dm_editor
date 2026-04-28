export default function OrientacionNorteMapa() {
  return (
    <div
      aria-label="Orientación del mapa: norte"
      title="Norte del tablero"
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 5,
        width: 86,
        height: 86,
        pointerEvents: 'none',
        border: '1px solid rgba(148, 163, 184, 0.55)',
        borderRadius: 999,
        background: 'rgba(2, 6, 23, 0.72)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        color: '#e2e8f0',
      }}
    >
      <svg viewBox="0 0 86 86" width="86" height="86" role="img" aria-hidden="true">
        <line x1="43" y1="43" x2="63" y2="23" stroke="rgba(250, 204, 21, 0.95)" strokeWidth="4" strokeLinecap="round" />
        <polygon points="63,23 53,27 59,33" fill="rgba(250, 204, 21, 0.95)" />
        <line x1="43" y1="43" x2="23" y2="63" stroke="rgba(148, 163, 184, 0.65)" strokeWidth="2" strokeLinecap="round" />
        <line x1="43" y1="43" x2="63" y2="63" stroke="rgba(148, 163, 184, 0.65)" strokeWidth="2" strokeLinecap="round" />
        <line x1="43" y1="43" x2="23" y2="23" stroke="rgba(148, 163, 184, 0.65)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="43" cy="43" r="4" fill="#e2e8f0" />
        <text x="68" y="20" fill="#facc15" fontSize="15" fontWeight="700" textAnchor="middle">N</text>
        <text x="71" y="70" fill="#cbd5e1" fontSize="11" fontWeight="700" textAnchor="middle">E</text>
        <text x="17" y="70" fill="#cbd5e1" fontSize="11" fontWeight="700" textAnchor="middle">S</text>
        <text x="16" y="20" fill="#cbd5e1" fontSize="11" fontWeight="700" textAnchor="middle">O</text>
      </svg>
    </div>
  )
}
