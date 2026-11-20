/**
 * The brand's backdrop on black (spec 003, CA-03; spec 009, CA-10): ambient light, a fading grid
 * and a slow shine sweep. Shared by the desktop's brand panel and the phone's brand band, so the
 * look lives in one place. Decorative: hidden from screen readers; the sweep only moves when the
 * device allows motion (`motion-safe:`, spec 009, CA-12).
 */
const BrandOrnaments = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      data-ornament="light"
      className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_30%,rgba(255,255,255,0.10),transparent_70%),radial-gradient(45%_45%_at_90%_95%,rgba(161,161,170,0.14),transparent_70%)]"
    />
    <div
      data-ornament="grid"
      className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_35%,black_20%,transparent_75%)]"
    />
    <div
      data-ornament="shine"
      className="absolute -inset-y-1/4 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent motion-safe:animate-shine"
    />
  </div>
);

export default BrandOrnaments;
