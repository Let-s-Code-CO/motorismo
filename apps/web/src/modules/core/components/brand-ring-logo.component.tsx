import BrandBadge from '@web/modules/core/components/brand-badge.component';
import Sparkle from '@web/modules/core/components/sparkle.component';

type BrandRingLogoProps = {
  /** Diameter of the logo itself, in px. */
  size: number;
  alt: string;
  priority?: boolean;
};

/**
 * The logo on its metallic ring, with a glow and sparkles around it (spec 003; spec 009, CA-10).
 * The glow and the sparkles are decorative; the logo carries `alt`.
 */
const BrandRingLogo = ({ size, alt, priority = false }: BrandRingLogoProps) => {
  // The sparkles scale with the logo: the desktop panel's were drawn for 148 px.
  const scale = size / 148;
  return (
    <div className="relative w-fit">
      <div
        aria-hidden
        data-ornament="glow"
        className="absolute -inset-10 rounded-full bg-white/10 blur-3xl"
      />
      <div className="relative rounded-full bg-[conic-gradient(from_210deg,#f4f4f5,#52525b,#d4d4d8,#27272a,#e4e4e7,#52525b,#f4f4f5)] p-[3px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
        <div className="rounded-full bg-zinc-950 p-1.5">
          <BrandBadge size={size} alt={alt} priority={priority} />
        </div>
      </div>
      <span aria-hidden data-ornament="sparkles">
        <Sparkle
          className="absolute -top-3 right-2 text-white"
          size={Math.round(22 * Math.max(scale, 0.7))}
        />
        <Sparkle
          className="absolute top-1/2 -right-8 text-zinc-300"
          size={Math.round(14 * Math.max(scale, 0.7))}
          delay="1.1s"
        />
        <Sparkle
          className="absolute -bottom-2 left-4 text-zinc-400"
          size={Math.round(12 * Math.max(scale, 0.7))}
          delay="2s"
        />
      </span>
    </div>
  );
};

export default BrandRingLogo;
