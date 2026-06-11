export default function BlurFade({ children, delay = 0, className = '' }) {
  // Round to an integer step — CSS only defines bf-1…bf-8; fractional
  // delays like bf-1.3 match no class and silently drop the stagger.
  const step = Math.min(Math.max(Math.round(delay), 0), 8);
  const delayClass = step === 0 ? '' : `bf-${step}`;
  return (
    <div className={`bf ${delayClass} ${className}`}>
      {children}
    </div>
  );
}
