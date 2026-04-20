import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { EstimateServiceItem } from '@shared/schema';

// Shape returned by GET /api/estimates/slug/:slug (accessCode redacted, hasAccessCode added)
interface PublicEstimate {
  id: number;
  clientName: string;
  slug: string;
  note: string | null;
  services: EstimateServiceItem[];
  createdAt: string | null;
  hasAccessCode: boolean;
}

function LoadingScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Proposal not found</p>
        <h1 className="text-white text-3xl font-semibold">This link may have expired or been removed.</h1>
        <p className="text-zinc-400 text-sm">Contact Skale Club for a new proposal link.</p>
      </div>
    </div>
  );
}

function AccessCodeGate({ estimateId, onUnlock }: { estimateId: number; onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { mutate: verify, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/estimates/${estimateId}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) throw new Error('Incorrect code');
      if (!res.ok) throw new Error('Verification failed');
    },
    onSuccess: () => onUnlock(),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6">
        <p className="text-zinc-400 text-sm uppercase tracking-widest">Skale Club</p>
        <h1 className="text-white text-3xl font-semibold text-center">Enter access code</h1>
        <Input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          className="bg-zinc-900 border-zinc-700 text-white text-center w-full"
          onKeyDown={(e) => e.key === 'Enter' && code && !isPending && verify()}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          onClick={() => verify()}
          disabled={isPending || !code}
          className="w-full"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Unlock Proposal
        </Button>
      </div>
    </div>
  );
}

export default function EstimateViewer() {
  const { slug } = useParams<{ slug: string }>();
  const hasTrackedView = useRef(false);

  const { data, isLoading } = useQuery<PublicEstimate>({
    queryKey: [`/api/estimates/slug/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const { mutate: trackView } = useMutation({
    mutationFn: async () => {
      await fetch(`/api/estimates/${data!.id}/view`, { method: 'POST' });
    },
  });

  useEffect(() => {
    if (data && (!data.hasAccessCode || isUnlocked) && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackView();
    }
  }, [data, isUnlocked]);

  useEffect(() => {
    if (!data) return;
    const totalSections = 2 + data.services.length + 1;
    const refs = sectionRefs.current.slice(0, totalSections);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = refs.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.5 }
    );

    refs.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [data, isUnlocked]);

  if (isLoading) return <LoadingScreen />;
  if (!data) return <NotFoundScreen />;
  if (data.hasAccessCode && !isUnlocked) {
    return <AccessCodeGate estimateId={data.id} onUnlock={() => setIsUnlocked(true)} />;
  }

  const allSections = [
    'cover',
    'intro',
    ...data.services.map((_, i) => `service-${i}`),
    'closing',
  ];

  const contentAnimation = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
    viewport: { once: true },
  };

  const gradientOverlay = (
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
  );

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-zinc-950 text-white">
      {/* Navigation dots */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
        {allSections.map((_, i) => (
          <button
            key={i}
            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
            aria-label={`Go to section ${i + 1}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className={cn(
              'rounded-full transition-all duration-200',
              activeIndex === i
                ? 'w-3 h-3 bg-white scale-125'
                : 'w-2 h-2 bg-white/30 hover:bg-white/60'
            )} />
          </button>
        ))}
      </div>

      {/* Section 1 — Cover (EST-14) */}
      <section
        ref={(el) => { sectionRefs.current[0] = el; }}
        className="h-screen w-full snap-start relative flex items-center justify-center"
      >
        {gradientOverlay}
        <motion.div
          {...contentAnimation}
          className="relative z-10 text-center px-8 max-w-xl mx-auto w-full"
        >
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Proposal for</p>
          <h1 className="text-5xl font-semibold text-white leading-tight">{data.clientName}</h1>
          <p className="text-zinc-400 text-sm mt-6">Skale Club</p>
        </motion.div>
      </section>

      {/* Section 2 — Introduction (EST-15) */}
      <section
        ref={(el) => { sectionRefs.current[1] = el; }}
        className="h-screen w-full snap-start relative flex items-center justify-center"
      >
        {gradientOverlay}
        <motion.div
          {...contentAnimation}
          className="relative z-10 px-8 max-w-xl mx-auto w-full"
        >
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">About Skale Club</p>
          <h2 className="text-3xl font-semibold text-white mb-6">We help businesses grow smarter.</h2>
          <p className="text-base text-zinc-400 leading-relaxed">
            Skale Club is a digital marketing and sales agency helping businesses automate growth, close more deals, and deliver standout client experiences.
          </p>
        </motion.div>
      </section>

      {/* Service Sections (EST-16) */}
      {data.services.map((service, i) => (
        <section
          key={i}
          ref={(el) => { sectionRefs.current[2 + i] = el; }}
          className="h-screen w-full snap-start relative flex items-center justify-center"
        >
          {gradientOverlay}
          <motion.div
            {...contentAnimation}
            className="relative z-10 px-8 max-w-xl mx-auto w-full"
          >
            <p className="text-zinc-400 text-sm uppercase tracking-widest mb-2">
              Service {i + 1} of {data.services.length}
            </p>
            <h2 className="text-3xl font-semibold text-white mb-2">{service.title}</h2>
            <p className="text-base text-zinc-400 leading-relaxed mb-6">{service.description}</p>
            <p className="text-3xl font-semibold text-white mb-6">{service.price}</p>
            {service.features.length > 0 && (
              <ul className="space-y-2 mt-4">
                {service.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-zinc-500 shrink-0">–</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </section>
      ))}

      {/* Closing Section (EST-17) */}
      <section
        ref={(el) => { sectionRefs.current[2 + data.services.length] = el; }}
        className="h-screen w-full snap-start relative flex items-center justify-center"
      >
        {gradientOverlay}
        <motion.div
          {...contentAnimation}
          className="relative z-10 text-center px-8 max-w-xl mx-auto w-full"
        >
          <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Skale Club</p>
          <h2 className="text-3xl font-semibold text-white mb-4">Let's build something great together.</h2>
          <p className="text-sm text-zinc-400">Reach out to discuss next steps.</p>
        </motion.div>
      </section>
    </div>
  );
}
