type SkeletonProps = { className?: string };

/**
 * One shape of a loading screen (spec 011, HU-01): a neutral block in the theme's colours (CA-04),
 * softly pulsing only when the device allows motion (RN-03). Decorative on its own: the screen
 * says «Cargando…» once (CA-03).
 */
const Skeleton = ({ className = '' }: SkeletonProps) => (
  <span
    data-shape
    className={`block rounded-medium bg-default-200 motion-safe:animate-pulse ${className}`}
  />
);

export default Skeleton;
