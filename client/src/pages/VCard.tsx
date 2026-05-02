import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Download,
  Share2,
  Phone,
  Mail,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Facebook,
  Send,
  ExternalLink,
  QrCode,
} from "lucide-react";
import QRCode from "react-qr-code";
import { downloadVCard } from "@/lib/vcard";
import { Loader2 } from '@/components/ui/loader';
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { VCard as VCardType, CompanySettings } from "@shared/schema";

import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-5 h-5" />,
  linkedin: <Linkedin className="w-5 h-5" />,
  twitter: <Twitter className="w-5 h-5" />,
  x: <Twitter className="w-5 h-5" />,
  youtube: <Youtube className="w-5 h-5" />,
  facebook: <Facebook className="w-5 h-5" />,
  telegram: <Send className="w-5 h-5" />,
};

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  return iconMap[p] || <ExternalLink className="w-5 h-5" />;
};

export default function VCard() {
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();
  const hasTrackedView = useRef(false);

  const { data: contactData, isLoading, error } = useQuery<VCardType>({
    queryKey: [`/api/vcards/${username}`],
    enabled: !!username,
  });

  // Track view on page load
  const { mutate: trackViewMutation } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vcards/${username}/view`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to track view');
      return res.json();
    },
    onSuccess: () => {
      console.log('VCard view tracked');
    },
    onError: (err) => {
      console.error('Failed to track view:', err);
    }
  });

  // Track download
  const { mutate: trackDownloadMutation } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vcards/${username}/download`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to track download');
      return res.json();
    },
    onSuccess: () => {
      console.log('VCard download tracked');
    },
    onError: (err) => {
      console.error('Failed to track download:', err);
    }
  });

  useEffect(() => {
    if (contactData) {
      document.title = `${contactData.organization || "VCard"} | ${contactData.firstName} ${contactData.lastName}`;
    }
  }, [contactData]);

  // Trigger view tracking only once per component mount
  useEffect(() => {
    if (username && contactData && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackViewMutation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, contactData]);

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  if (!username) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-[#0f1014]">VCard Not Found (Invalid URL).</div>;
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-[#0f1014]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error || !contactData || !contactData.isActive) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-[#0f1014]">VCard "{username}" not found or inactive.</div>;
  }

  const handleSaveContact = async () => {
    // Download the vCard first
    downloadVCard({
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      organization: contactData.organization,
      title: contactData.title,
      cellPhone: contactData.cellPhone,
      email: contactData.email,
      url: contactData.url,
      note: contactData.bio,
    }, `${contactData.firstName}_${contactData.lastName}.vcf`);
    // Track download after successful download initiation
    trackDownloadMutation();
    toast({ title: "Contact Saved", description: "vCard has been downloaded to your device." });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${contactData!.firstName} ${contactData!.lastName} - ${contactData!.title || ''}`,
          text: contactData!.bio || '',
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link Copied", description: "Link has been copied to clipboard!" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-white flex justify-center relative overflow-hidden font-sans">
      {/* Immersive background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#000]" />
        {/* Colorful blobs */}
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[50%] bg-blue-500/30 rounded-[100%] filter blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[50%] bg-blue-600/20 rounded-[100%] filter blur-[100px]" />
        {/* Dark noise/glass overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" />
      </div>

      <motion.div
        className="w-full max-w-[380px] z-10 px-4 py-8 flex flex-col gap-4"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* A. Header Profile Card */}
        <Card className="p-3 bg-white rounded-xl border-none shadow-xl flex items-center justify-between gap-2">
          <div className="flex flex-col flex-1 pl-1">
            <h1 className="text-[#0f172a] text-xl font-bold tracking-tight leading-tight">
              {contactData.firstName} {contactData.lastName}
            </h1>
            {contactData.organization && (
              <p className="text-gray-500 text-xs mt-1 font-medium line-clamp-2">
                {contactData.organization}
              </p>
            )}
            {companySettings?.logoIcon && (
              <Link href="/">
                <a className="block mt-2 hover:opacity-100 transition-opacity w-fit">
                  <img
                    src={companySettings.logoIcon}
                    alt="Favicon"
                    className="w-8 h-8 object-contain opacity-90"
                  />
                </a>
              </Link>
            )}
          </div>
          <div className="w-44 h-32 rounded-xl border-2 border-gray-50 shadow-sm shrink-0 overflow-hidden">
            {contactData.avatarUrl ? (
              <img src={contactData.avatarUrl} alt={contactData.firstName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                {contactData.firstName[0]}
              </div>
            )}
          </div>
        </Card>

        {/* B. Action Buttons (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* 1. Salvar Contacto (Glassmorphism orange accent) */}
          <button
            onClick={handleSaveContact}
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-2xl border border-white/30 hover:from-white/30 hover:to-white/10 transition-all text-white shadow-[0_8px_32px_rgba(0,0,0,0.1)] relative overflow-hidden group"
          >
            {/* Subtle gloss reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Download className="w-5 h-5 relative z-10" />
            <span className="text-[10px] font-bold uppercase tracking-wider relative z-10">Save Contact</span>
          </button>

          {/* 2. Compartilhar */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-white hover:bg-gray-50 transition-all text-blue-600 shadow-lg"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]">Share</span>
          </button>

          {/* 3. Ligar */}
          <a
            href={contactData.cellPhone ? `tel:${contactData.cellPhone.replace(/\D/g, "").startsWith("1") ? "+" + contactData.cellPhone.replace(/\D/g, "") : "+1" + contactData.cellPhone.replace(/\D/g, "")}` : "#"}
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-white hover:bg-gray-50 transition-all text-blue-600 shadow-lg"
            onClick={(e) => !contactData.cellPhone && e.preventDefault()}
          >
            <Phone className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]">Call</span>
          </a>

          {/* 4. Email */}
          <a
            href={`mailto:${contactData.email}`}
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-white hover:bg-gray-50 transition-all text-blue-600 shadow-lg"
          >
            <Mail className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]">Email</span>
          </a>
        </div>

        {/* C. About Section */}
        {contactData.bio && (
          <Card className="p-6 bg-white rounded-xl border-none shadow-xl mt-2">
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {contactData.bio}
            </p>
          </Card>
        )}

        {/* D. Special Offer / Coupon Card */}
        {contactData.couponCode && contactData.couponAmount && (
          <Card className="bg-blue-600 rounded-xl border-none shadow-xl overflow-hidden mt-2 relative">
            <div className="flex items-stretch min-h-[100px]">
              {/* Left side QR */}
              <div className="bg-white p-3 flex items-center justify-center w-[100px] shrink-0">
                <QrCode className="w-16 h-16 text-black" />
              </div>

              {/* Dashed separator */}
              <div className="w-0 border-r-2 border-dashed border-white/40 my-2 shadow-[1px_0_0_rgba(1,0,0,0.1)]"></div>

              {/* Right side Offer Details */}
              <div className="flex-1 p-4 flex flex-col justify-center relative overflow-hidden">
                <p className="text-blue-100 text-xs font-bold mb-1 uppercase tracking-wide opacity-90">
                  Discount Coupon
                </p>
                <h3 className="text-white text-xl font-black mb-2 leading-none">
                  {contactData.couponAmount}
                </h3>
                <div className="bg-white/20 px-3 py-1.5 rounded-lg inline-block self-start border border-white/30 backdrop-blur-sm">
                  <span className="text-white font-bold tracking-widest">{contactData.couponCode}</span>
                </div>
                <p className="text-[10px] text-blue-200 mt-2 uppercase font-medium tracking-wider">
                  Limited Time Offer
                </p>

                {/* Decorative background shapes */}
                <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
                <div className="absolute -right-2 -top-2 w-12 h-12 rounded-full border-[6px] border-white/5 pointer-events-none" />
              </div>
            </div>
          </Card>
        )}

        {/* E. Dynamic QR Code Section */}
        <Card className="p-5 bg-white rounded-xl border-none shadow-[15px_15px_20px_rgba(0,0,0,0.15)] mt-2 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-[#0f172a] font-bold text-sm uppercase tracking-widest leading-tight">Scan QR Code</p>
            <p className="text-gray-500 text-[10px] mt-1 font-medium">Scan to share this digital card</p>
          </div>
          <div className="bg-white p-2 rounded-lg ring-2 ring-gray-100 shadow-[6px_6px_10px_rgba(0,0,0,0.1)] flex items-center justify-center w-[110px] h-[110px] shrink-0">
            <QRCode value={window.location.href} size={100} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
          </div>
        </Card>

        {/* F. Main Call to Action */}
        {contactData.url && (
          <a
            href={contactData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-center font-bold uppercase tracking-wider rounded-xl shadow-[0_16px_28px_rgba(37,99,235,0.30)] hover:shadow-[0_20px_35px_rgba(37,99,235,0.40)] hover:-translate-y-1 transition-all duration-300"
          >
            Access Exclusive Link
          </a>
        )}

        {/* F. Footer Section */}
        <div className="mt-10 mb-6 flex flex-col items-center text-center px-4">
          <Link href="/">
            <a className="flex flex-col items-center text-center group transition-all">
              {companySettings?.logoDark || companySettings?.logoMain ? (
                <img
                  src={companySettings.logoDark || companySettings.logoMain!}
                  alt={contactData.organization || "Company Logo"}
                  className="h-8 object-contain mb-4 opacity-80 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="text-white/80 font-black text-2xl tracking-tighter mb-4 opacity-70 group-hover:opacity-100 transition-opacity">
                  {contactData.organization || "Company"}<span className="text-blue-400">.</span>
                </div>
              )}
            </a>
          </Link>

          <p className="text-white/50 text-xs leading-relaxed mb-6 max-w-sm">
            Powered by {contactData.organization || "Company"}.
            All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {contactData.socialLinks && contactData.socialLinks.map((social, idx) => (
              <a
                key={idx}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all transform hover:scale-110"
              >
                {getSocialIcon(social.platform)}
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
