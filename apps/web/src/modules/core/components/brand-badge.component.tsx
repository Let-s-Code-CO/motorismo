import Image from 'next/image';

type BrandBadgeProps = {
  size: number;
  alt: string;
  priority?: boolean;
};

/** The logo on a dark metallic disc, as on the business Instagram profile. */
const BrandBadge = ({ size, alt, priority = false }: BrandBadgeProps) => (
  <div
    className="grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_38%,#b4b4b4_0%,#7a7a7a_38%,#3f3f3f_72%,#262626_100%)] shadow-lg ring-1 ring-white/10"
    style={{ width: size, height: size }}
  >
    {/* The artwork's visual weight sits low (sparkles on top): nudge it up to look centred. */}
    <Image
      className="-translate-y-[6%]"
      src="/logo.png"
      alt={alt}
      width={Math.round(size * 0.68)}
      height={Math.round(size * 0.68)}
      priority={priority}
    />
  </div>
);

export default BrandBadge;
