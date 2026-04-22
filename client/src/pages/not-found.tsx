import { Link } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-zinc-800/20 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center">
        <div className="mb-8 relative group">
          <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full transition-all duration-500 group-hover:bg-red-500/30 group-hover:blur-2xl"></div>
          <AlertCircle className="relative h-24 w-24 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse" />
        </div>
        
        <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-zinc-100 to-zinc-500 mb-4 tracking-tighter">
          404
        </h1>
        
        <h2 className="text-2xl font-bold text-zinc-100 mb-3 tracking-tight">
          {t('Page Not Found')}
        </h2>

        <p className="text-base text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed">
          {t('The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/">
            <Button variant="default" size="lg" className="w-full sm:w-auto gap-2 bg-gradient-to-r from-zinc-100 to-zinc-300 text-zinc-900 border-0 hover:from-white hover:to-zinc-200 transform transition-transform hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.15)]">
              <Home className="h-4 w-4" />
              {t('Back to Home')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
