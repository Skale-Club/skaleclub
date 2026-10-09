import type { ReactNode } from 'react';
import { ArrowLeft, FileSignature, Inbox, PenLine } from 'lucide-react';

/** Shared field styling for the admin auth forms (login, signup). */
export const AUTH_LABEL = 'text-sm font-medium text-fog-200';
export const AUTH_INPUT =
  'h-12 rounded-xl border-white/10 bg-navy-900 pl-11 text-base text-fog-50 placeholder:text-fog-400/60 transition-colors hover:border-white/20 focus:border-cta focus-visible:ring-2 focus-visible:ring-cta/30 focus-visible:ring-offset-0';
export const AUTH_INPUT_ICON =
  'pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-400 transition-colors group-focus-within:text-cta-soft';
export const AUTH_SECONDARY_BUTTON =
  'h-12 w-full rounded-full border border-white/15 bg-white/[0.04] text-base font-semibold text-fog-50 hover:bg-white/[0.08]';

const CAPABILITIES = [
  { icon: Inbox, title: 'Every lead in one place', body: 'Forms, chat and calls, scored and routed as they land.' },
  { icon: FileSignature, title: 'Estimates that close', body: 'Quotes and presentations clients can review and approve.' },
  { icon: PenLine, title: 'Content that ranks', body: 'Blog, portfolio and pages, with SEO built in.' },
];

interface BrandLockupProps {
  logoUrl?: string | null;
  companyName: string;
}

function BrandLockup({ logoUrl, companyName }: BrandLockupProps) {
  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        // The light wordmark the landing-page nav uses on the same navy.
        <img src={logoUrl} alt={companyName} className="h-12 w-auto object-contain" />
      ) : (
        <span className="text-lg font-semibold tracking-[-0.02em] text-fog-50">{companyName}</span>
      )}
      <span aria-hidden="true" className="h-5 w-px bg-white/15" />
      <span className="text-sm text-fog-400">Admin</span>
    </div>
  );
}

export function AuthEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-cta-soft">
      <span aria-hidden="true" className="h-px w-8 bg-cta-soft/60" />
      {children}
    </p>
  );
}

interface AuthHeadingProps {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

/** Eyebrow, display title and lead paragraph at the top of the form panel. */
export function AuthHeading({ eyebrow, title, description }: AuthHeadingProps) {
  return (
    <div className="mb-10">
      <AuthEyebrow>{eyebrow}</AuthEyebrow>
      <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.04em] text-fog-50">{title}</h1>
      {description && <p className="mt-3 text-base leading-relaxed text-fog-400">{description}</p>}
    </div>
  );
}

interface AuthLayoutProps extends BrandLockupProps {
  children: ReactNode;
  onBack: () => void;
}

/**
 * Split layout for the admin auth screens, in the landing page's language: an
 * editorial panel on the left (navy-900 under the 40px hairline grid, eyebrow,
 * tight display headline, capability list) and a steel-700 form panel on the
 * right, the same band contrast the home page uses between sections. Below
 * `lg` the editorial panel drops away and the form panel carries the lockup.
 */
export function AuthLayout({ children, logoUrl, companyName, onBack }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-navy-900 pattern-grid-dark font-sans text-fog-50 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Editorial panel */}
      <section className="relative hidden overflow-hidden border-r border-white/10 px-14 py-12 lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full opacity-60 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(81,115,214,0.35) 0%, transparent 65%)' }}
        />

        <div className="relative">
          <BrandLockup logoUrl={logoUrl} companyName={companyName} />
        </div>

        <div className="relative max-w-[560px]">
          <AuthEyebrow>Admin dashboard</AuthEyebrow>
          <h2 className="mt-6 text-[3.5rem] font-semibold leading-[0.98] tracking-[-0.04em] text-fog-50">
            Your whole business.
            <br />
            <span className="text-fog-400">One dashboard.</span>
          </h2>
          <p className="mt-6 max-w-[460px] text-lg leading-relaxed text-fog-300">
            Leads, estimates, content and integrations, managed from the same place your website runs on.
          </p>

          <ul className="mt-12 space-y-6">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Icon className="h-[18px] w-[18px] text-cta-soft" />
                </span>
                <span>
                  <span className="block font-semibold text-fog-50">{title}</span>
                  <span className="mt-0.5 block text-sm text-fog-400">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-fog-400">
          © {new Date().getFullYear()} {companyName}
        </p>
      </section>

      {/* Form panel */}
      <section className="relative flex min-h-screen flex-col bg-steel-700 px-6 py-10 sm:px-10 lg:min-h-0">
        <div className="flex items-center justify-between gap-4">
          <div className="lg:hidden">
            <BrandLockup logoUrl={logoUrl} companyName={companyName} />
          </div>
          <button
            type="button"
            onClick={onBack}
            className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-fog-400 transition-colors hover:text-fog-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </section>
    </main>
  );
}
