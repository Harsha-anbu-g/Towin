export default function BlurFade({ children, delay = 0, className = '' }) {
  const delayClass = delay === 0 ? '' : `bf-${Math.min(delay, 8)}`;
  return (
    <div className={`bf ${delayClass} ${className}`}>
      {children}
    </div>
  );
}
