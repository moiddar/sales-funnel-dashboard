import { InfoTooltip } from './InfoTooltip';

interface StorySectionProps {
  heading: string;
  description?: string;
  tooltip?: { definition: string; why: string };
  children: React.ReactNode;
}

export function StorySection({ heading, description, tooltip, children }: StorySectionProps) {
  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-brand flex items-center gap-1.5">
          {heading}
          {tooltip && <InfoTooltip tooltip={tooltip} />}
        </h2>
        {description && (
          <p className="text-sm text-brand/60 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
