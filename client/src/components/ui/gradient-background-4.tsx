import { cn } from '@/lib/utils';

type GradientBackgroundProps = Omit<React.ComponentProps<'div'>, 'ref'>;

/**
 * Subtle radial gradient backdrop — a soft indigo glow descending from the
 * top-center. Designed as a full-bleed background layer for internal slides
 * (estimate + presentation non-cover screens). Translucent indigo (#6366f136)
 * over whatever sits behind it, so it tints any dark slide bg without hiding it.
 *
 * Pointer-events-none so it never intercepts clicks/swipes.
 */
export function GradientBackground({ className, ...props }: GradientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        // Light + dark variants kept from the source. Site is dark by default,
        // so the dark indigo glow is what renders in practice.
        '[background:radial-gradient(125%_125%_at_50%_-80%,#c7d2fe_40%,transparent_100%)]',
        'dark:[background:radial-gradient(125%_125%_at_50%_-80%,#6366f136_40%,transparent_100%)]',
        className,
      )}
      {...props}
    />
  );
}
