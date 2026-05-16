export default function AuroraBackground({ children, className = '', style = {} }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#020817',
        ...style,
      }}
    >
      {/* Aurora blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '15%', left: '20%',
          width: '480px', height: '480px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.55) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'aurora-1 14s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '50%', right: '10%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(88,86,214,0.50) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'aurora-2 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '40%',
          width: '360px', height: '360px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'aurora-3 22s ease-in-out infinite',
        }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
