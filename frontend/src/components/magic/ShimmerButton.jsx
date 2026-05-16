export default function ShimmerButton({ children, onClick, disabled, type = 'button', style = {} }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="shimmer-btn"
      style={style}
    >
      {children}
    </button>
  );
}
