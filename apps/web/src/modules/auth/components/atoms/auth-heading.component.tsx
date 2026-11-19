/** Title + supporting text at the top of every auth page. */
const AuthHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-8 flex flex-col gap-1.5">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    {subtitle && <p className="text-sm text-default-500">{subtitle}</p>}
  </div>
);

export default AuthHeading;
