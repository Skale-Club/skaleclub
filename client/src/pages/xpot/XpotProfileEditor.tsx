import { useRef, useState } from "react";
import { Camera, Loader2, X, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { XpotMeResponse } from "./types";

interface Props {
  me: XpotMeResponse;
  onClose: () => void;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function XpotProfileEditor({ me, onClose }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(me.rep.displayName);
  const [phone, setPhone] = useState(me.rep.phone ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(me.rep.avatarUrl ?? null);
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);

  const avatarMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const res = await apiRequest("POST", "/api/xpot/me/avatar", { imageData });
      return res.json() as Promise<{ avatarUrl: string }>;
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; phone?: string; avatarUrl?: string }) => {
      const res = await apiRequest("PATCH", "/api/xpot/me", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/me"] });
      toast({ title: "Profile updated" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await toBase64(file);
    setAvatarPreview(base64);
    setPendingImageData(base64);
  };

  const handleSave = async () => {
    let avatarUrl: string | undefined;

    if (pendingImageData) {
      try {
        const result = await avatarMutation.mutateAsync(pendingImageData);
        avatarUrl = result.avatarUrl;
      } catch (err: any) {
        toast({ title: "Avatar upload failed", description: err.message, variant: "destructive" });
        return;
      }
    }

    const patch: { displayName?: string; phone?: string; avatarUrl?: string } = {};
    if (displayName !== me.rep.displayName) patch.displayName = displayName;
    if (phone !== (me.rep.phone ?? "")) patch.phone = phone;
    if (avatarUrl) patch.avatarUrl = avatarUrl;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    profileMutation.mutate(patch);
  };

  const initials = me.rep.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const isSaving = avatarMutation.isPending || profileMutation.isPending;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl border border-white/10 pb-safe-area-inset-bottom"
        style={{ background: "rgba(10, 15, 30, 0.97)", backdropFilter: "blur(24px)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-base font-semibold text-white">Edit Profile</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 hover:bg-white/8 hover:text-white/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-6">
          {/* Avatar picker */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-20 w-20 shrink-0"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl text-xl font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
                >
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Change photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/60 focus:bg-white/8 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/60 focus:bg-white/8 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Role
              </label>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
                {me.rep.role}
              </div>
            </div>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !displayName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-black transition-all disabled:opacity-40"
            style={{ background: isSaving ? "rgba(59,130,246,0.5)" : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Check className="h-4 w-4 text-white" />
            )}
            <span className="text-white">{isSaving ? "Saving…" : "Save Changes"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
