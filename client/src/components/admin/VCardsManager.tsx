import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, ExternalLink, Upload, Copy, Link as LinkIcon, Instagram, Linkedin, Twitter, Youtube, Facebook, Send, X, QrCode } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QRCode from "react-qr-code";
import type { VCard } from "@shared/schema";
import { usePagePaths } from "@/lib/pagePaths";
import { uploadFileToServer } from "./shared/utils";

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'twitter', label: 'Twitter / X', icon: Twitter },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'telegram', label: 'Telegram', icon: Send },
];

interface SocialLink {
  platform: string;
  url: string;
}

export function VCardsManager() {
  const { toast } = useToast();
  const pagePaths = usePagePaths();
  const [editingCard, setEditingCard] = useState<Partial<VCard> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameValue, setUsernameValue] = useState("");
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: vcards, isLoading } = useQuery<VCard[]>({
    queryKey: ['/api/vcards'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<VCard>) => {
      const res = await fetch('/api/vcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "VCard created successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/vcards'] });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<VCard>) => {
      const res = await fetch(`/api/vcards/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "VCard updated successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/vcards'] });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/vcards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete VCard");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "VCard deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/vcards'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete VCard", variant: "destructive" });
    }
  });

  const validateUsername = (value: string): boolean => {
    if (!value) {
      setUsernameError("Username is required");
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      setUsernameError("Username can only contain lowercase letters, numbers, and dashes");
      return false;
    }
    if (value.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }
    if (value.length > 50) {
      setUsernameError("Username must be less than 50 characters");
      return false;
    }
    setUsernameError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateUsername(usernameValue)) {
      return;
    }

    const fd = new FormData(e.currentTarget);
    const validSocialLinks = socialLinks.filter((link) => link.url.trim());
    const data = {
      username: usernameValue,
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      title: fd.get("title") as string,
      organization: fd.get("organization") as string,
      cellPhone: fd.get("cellPhone") as string,
      email: fd.get("email") as string,
      url: fd.get("url") as string,
      bio: fd.get("bio") as string,
      couponCode: fd.get("couponCode") as string,
      couponAmount: fd.get("couponAmount") as string,
      avatarUrl: fd.get("avatarUrl") as string,
      socialLinks: validSocialLinks,
      isActive: editingCard?.isActive ?? true,
    };

    if (editingCard?.id) {
      updateMutation.mutate({ ...data, id: editingCard.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (card: VCard | null = null) => {
    setEditingCard(card);
    setAvatarPreview(card?.avatarUrl || null);
    setPhoneValue(card?.cellPhone ? formatPhoneNumber(card.cellPhone) : "");
    setSocialLinks(card?.socialLinks || []);
    setUsernameValue(card?.username || "");
    setUsernameError(null);
    setIsDialogOpen(true);
  };

  const addSocialLink = () => {
    setSocialLinks([...socialLinks, { platform: 'instagram', url: '' }]);
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const updateSocialLink = (index: number, field: 'platform' | 'url', value: string) => {
    const updated = [...socialLinks];
    updated[index] = { ...updated[index], [field]: value };
    setSocialLinks(updated);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  };

  const getVCardUrl = (username: string) => {
    return `${window.location.origin}${pagePaths.vcardUser(username)}`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="VCards"
        description="Create and manage digital business cards."
        icon={<QrCode className="w-5 h-5" />}
        action={
          <Button size="sm" onClick={() => openEditDialog(null)}>
            <Plus className="w-4 h-4 mr-2" /> New VCard
          </Button>
        }
      />

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username (URL)</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : vcards?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No VCards created yet.
                </TableCell>
              </TableRow>
            ) : (
              vcards?.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <a href={pagePaths.vcardUser(card.username)} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 hover:underline">
                        {pagePaths.vcardUser(card.username)} <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(getVCardUrl(card.username))}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{card.firstName} {card.lastName}</TableCell>
                  <TableCell>{card.organization}</TableCell>
                  <TableCell>
                    {card.isActive ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">Active</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(card)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm("Are you sure you want to delete this VCard?")) deleteMutation.mutate(card.id);
                    }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCard(null);
            setAvatarPreview(null);
            setPhoneValue("");
            setSocialLinks([]);
            setUsernameValue("");
            setUsernameError(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCard?.id ? 'Edit VCard' : 'New VCard'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4 mt-2">
            {/* Username & Avatar Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username (URL Identifier)</Label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-md border border-input bg-background">
                    <span className="px-3 text-sm text-gray-400 border-r border-input">{`${pagePaths.vcard}/`}</span>
                    <Input
                      id="username"
                      name="username"
                      value={usernameValue}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase();
                        setUsernameValue(value);
                        validateUsername(value);
                      }}
                      className="border-0 shadow-none focus-visible:ring-0"
                      placeholder="johnsmith"
                    />
                  </div>
                  {usernameValue && !usernameError && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(getVCardUrl(usernameValue))}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {usernameError && (
                  <p className="text-xs text-red-500">{usernameError}</p>
                )}
              </div>
              <div className="space-y-4">
                <Label>Avatar Photo</Label>
                <input type="hidden" name="avatarUrl" id="avatarUrl" value={avatarPreview || ''} />
                <div className="flex flex-col items-start gap-4">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {isUploading && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                      </div>
                    )}

                    {avatarPreview ? (
                      <>
                        <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Upload className="w-5 h-5 text-white mb-1" />
                          <span className="text-white text-xs font-medium">Change</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-gray-500">
                        <Upload className="w-6 h-6 mb-1 text-gray-400 group-hover:text-black transition-colors" />
                        <span className="text-xs font-medium">Upload</span>
                      </div>
                    )}
                  </button>
                  <input
                    id="avatar-upload"
                    ref={avatarFileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setIsUploading(true);
                          const url = await uploadFileToServer(file);
                          setAvatarPreview(url);
                          toast({ title: "Success", description: "Avatar uploaded" });
                        } catch (err: any) {
                          toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                        } finally {
                          setIsUploading(false);
                          if (avatarFileInputRef.current) {
                            avatarFileInputRef.current.value = "";
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" defaultValue={editingCard?.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" defaultValue={editingCard?.lastName} required />
              </div>
            </div>

            {/* Organization & Title Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization / Company</Label>
                <Input id="organization" name="organization" defaultValue={editingCard?.organization || ''} placeholder="Company name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Job Title / Position</Label>
                <Input id="title" name="title" defaultValue={editingCard?.title || ''} placeholder="ex: Marketing Manager" />
              </div>
            </div>

            {/* Phone & Email Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cellPhone">Mobile / Phone Number</Label>
                <Input
                  id="cellPhone"
                  name="cellPhone"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(formatPhoneNumber(e.target.value))}
                  placeholder="ex: (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={editingCard?.email || ''} placeholder="ex: john@example.com" />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">Website / Link URL</Label>
              <Input id="url" name="url" defaultValue={editingCard?.url || ''} placeholder="https://yourwebsite.com" />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Biography / About</Label>
              <Textarea id="bio" name="bio" defaultValue={editingCard?.bio || ''} className="h-20" placeholder="Brief professional bio..." />
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Social Links</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSocialLink}>
                  <Plus className="w-4 h-4 mr-1" /> Add Link
                </Button>
              </div>
              {socialLinks.length > 0 && (
                <div className="space-y-2">
                  {socialLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={link.platform}
                        onValueChange={(value) => updateSocialLink(index, 'platform', value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOCIAL_PLATFORMS.map((platform) => (
                            <SelectItem key={platform.value} value={platform.value}>
                              <div className="flex items-center gap-2">
                                <platform.icon className="w-4 h-4" />
                                {platform.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={link.url}
                        onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                        placeholder="https://..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSocialLink(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coupon Section */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border rounded-md">
              <h3 className="col-span-2 text-sm font-semibold mb-2">Discount Coupon (Optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="couponCode">Code</Label>
                <Input id="couponCode" name="couponCode" defaultValue={editingCard?.couponCode || ''} placeholder="ex: SAVE50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="couponAmount">Discount Amount</Label>
                <Input id="couponAmount" name="couponAmount" defaultValue={editingCard?.couponAmount || ''} placeholder="ex: $50.00" />
              </div>
            </div>

            {/* QR Code Preview */}
            {usernameValue && !usernameError && (
              <div className="bg-gray-50 p-4 border rounded-md">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode className="w-4 h-4" />
                  <Label className="text-sm font-semibold">QR Code Preview</Label>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-lg border">
                    <QRCode
                      value={getVCardUrl(usernameValue)}
                      size={100}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>Scan this QR code to view the VCard.</p>
                    <p className="font-mono text-xs mt-1">{getVCardUrl(usernameValue)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !!usernameError}>
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
