import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  GripVertical,
  Save,
  X,
} from "lucide-react";
import type { PortfolioSettings, PortfolioSlide } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DEFAULT_SLIDE: Omit<PortfolioSlide, "id"> = {
  title: "New Service",
  description: "Describe your service here.",
  price: "$0",
  priceLabel: "One-time",
  priceBadge: "One-time Fee",
  features: ["Feature 1", "Feature 2", "Feature 3"],
  ctaText: "Get Started",
  imageUrl: "",
  bgColor: "#ffffff",
  accentColor: "#406EF1",
  enabled: true,
};

function SlideCard({
  slide,
  onEdit,
  onDelete,
  onToggle,
}: {
  slide: PortfolioSlide;
  onEdit: (slide: PortfolioSlide) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div
        className="w-8 h-8 rounded-md shrink-0 border"
        style={{ backgroundColor: slide.bgColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{slide.title}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {slide.price}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{slide.description}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={slide.enabled}
          onCheckedChange={(checked) => onToggle(slide.id, checked)}
          aria-label="Enable slide"
        />
        <Button size="icon" variant="ghost" onClick={() => onEdit(slide)}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(slide.id)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function SlideDialog({
  slide,
  open,
  onClose,
  onSave,
}: {
  slide: PortfolioSlide | null;
  open: boolean;
  onClose: () => void;
  onSave: (slide: PortfolioSlide) => void;
}) {
  const [form, setForm] = useState<PortfolioSlide>(
    slide || { id: crypto.randomUUID(), ...DEFAULT_SLIDE }
  );
  const [featuresText, setFeaturesText] = useState(
    (slide?.features || DEFAULT_SLIDE.features).join("\n")
  );

  const handleChange = (field: keyof PortfolioSlide, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const features = featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    onSave({ ...form, features });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slide ? "Edit Slide" : "New Slide"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CTA Button Text</Label>
              <Input
                value={form.ctaText}
                onChange={(e) => handleChange("ctaText", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                placeholder="$1,999.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Price Label</Label>
              <Input
                value={form.priceLabel}
                onChange={(e) => handleChange("priceLabel", e.target.value)}
                placeholder="One-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Price Badge</Label>
              <Input
                value={form.priceBadge}
                onChange={(e) => handleChange("priceBadge", e.target.value)}
                placeholder="One-time Fee"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Features (one per line)</Label>
            <Textarea
              rows={4}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={"Feature 1\nFeature 2\nFeature 3"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input
              value={form.imageUrl}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
              placeholder="https://..."
            />
            {form.imageUrl && (
              <img
                src={form.imageUrl}
                alt="Preview"
                className="mt-2 h-32 w-full object-cover rounded-md border"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Background Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.bgColor}
                  onChange={(e) => handleChange("bgColor", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={form.bgColor}
                  onChange={(e) => handleChange("bgColor", e.target.value)}
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Accent Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => handleChange("accentColor", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={form.accentColor}
                  onChange={(e) => handleChange("accentColor", e.target.value)}
                  placeholder="#406EF1"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => handleChange("enabled", v)}
              id="slide-enabled"
            />
            <Label htmlFor="slide-enabled">Enabled</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-1" /> Save Slide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PortfolioSection() {
  const { toast } = useToast();
  const [editingSlide, setEditingSlide] = useState<PortfolioSlide | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<PortfolioSettings>({
    queryKey: ["/api/portfolio-settings"],
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<PortfolioSettings>) =>
      apiRequest("PUT", "/api/portfolio-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio-settings"] });
      toast({ title: "Portfolio saved", description: "Changes saved successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const save = useCallback(
    (data: Partial<PortfolioSettings>) => mutation.mutate(data),
    [mutation]
  );

  const slides: PortfolioSlide[] = settings?.slides || [];

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(slides, oldIndex, newIndex);
    save({ slides: reordered });
  };

  const handleToggle = (id: string, enabled: boolean) => {
    const updated = slides.map((s) => (s.id === id ? { ...s, enabled } : s));
    save({ slides: updated });
  };

  const handleDelete = (id: string) => {
    const updated = slides.filter((s) => s.id !== id);
    save({ slides: updated });
  };

  const handleSaveSlide = (slide: PortfolioSlide) => {
    const exists = slides.some((s) => s.id === slide.id);
    const updated = exists
      ? slides.map((s) => (s.id === slide.id ? slide : s))
      : [...slides, slide];
    save({ slides: updated });
    setIsDialogOpen(false);
    setEditingSlide(null);
  };

  const openNewSlide = () => {
    setEditingSlide(null);
    setIsDialogOpen(true);
  };

  const openEditSlide = (slide: PortfolioSlide) => {
    setEditingSlide(slide);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage the content of the{" "}
            <a
              href="/portfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              /portfolio
              <ExternalLink className="w-3 h-3" />
            </a>{" "}
            page.
          </p>
        </div>
      </div>

      {/* Hero & CTA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hero Slide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Badge Text</Label>
            <Input
              defaultValue={settings?.heroBadgeText || ""}
              onBlur={(e) => save({ heroBadgeText: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hero Title</Label>
            <Input
              defaultValue={settings?.heroTitle || ""}
              onBlur={(e) => save({ heroTitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hero Subtitle</Label>
            <Textarea
              rows={2}
              defaultValue={settings?.heroSubtitle || ""}
              onBlur={(e) => save({ heroSubtitle: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final CTA Slide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>CTA Title</Label>
            <Input
              defaultValue={settings?.ctaTitle || ""}
              onBlur={(e) => save({ ctaTitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>CTA Subtitle</Label>
            <Input
              defaultValue={settings?.ctaSubtitle || ""}
              onBlur={(e) => save({ ctaSubtitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Button Text</Label>
            <Input
              defaultValue={settings?.ctaButtonText || ""}
              onBlur={(e) => save({ ctaButtonText: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Slides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Service Slides{" "}
              <span className="text-muted-foreground font-normal text-sm ml-1">
                ({slides.length})
              </span>
            </CardTitle>
            <Button size="sm" onClick={openNewSlide}>
              <Plus className="w-4 h-4 mr-1" />
              Add Slide
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {slides.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-lg">
              No service slides yet. Click "Add Slide" to create one.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={slides.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {slides.map((slide) => (
                    <SlideCard
                      key={slide.id}
                      slide={slide}
                      onEdit={openEditSlide}
                      onDelete={handleDelete}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <SlideDialog
        open={isDialogOpen}
        slide={editingSlide}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingSlide(null);
        }}
        onSave={handleSaveSlide}
      />
    </div>
  );
}
