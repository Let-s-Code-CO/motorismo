type SparkleProps = { className?: string; delay?: string; size?: number };

/** Four-point star, like the sparkles on the logo. Decorative. */
const Sparkle = ({ className = '', delay = '0s', size = 16 }: SparkleProps) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`motion-safe:animate-twinkle ${className}`}
    style={{ animationDelay: delay }}
  >
    <path
      fill="currentColor"
      d="M12 0c.6 5.6 2.4 9.4 12 12-9.6 2.6-11.4 6.4-12 12-.6-5.6-2.4-9.4-12-12C9.6 9.4 11.4 5.6 12 0z"
    />
  </svg>
);

export default Sparkle;
