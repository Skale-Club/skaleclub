import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  managedPageSectionsSchema,
  registeredSectionTypes,
  sectionDefinitionMetadata,
  sectionPropsSchemas,
  sectionStarterProps,
  type RegisteredSectionType,
} from "@shared/section-definitions";

interface EditableSection {
  type: RegisteredSectionType;
  version?: number;
  props: Record<string, unknown>;
}

interface SectionComposerProps {
  value: string;
  onChange: (value: string) => void;
}

function schemaShape(type: RegisteredSectionType) {
  const schema = sectionPropsSchemas[type];
  return "shape" in schema ? (schema as z.AnyZodObject).shape : {};
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodEffects
  ) {
    current = current instanceof z.ZodEffects ? current._def.schema : current._def.innerType;
  }
  return current;
}

function labelFor(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function JsonField({
  id,
  value,
  placeholder,
  onCommit,
}: {
  id: string;
  value: unknown;
  placeholder: string;
  onCommit: (value: unknown) => void;
}) {
  const serializedValue = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(serializedValue);
  const [error, setError] = useState<string | null>(null);

  // Reordering or duplicating sections can reuse a React node at the same
  // array index, especially when adjacent sections share a type. Keep the
  // textarea synchronized so it never displays and later commits another
  // section's stale JSON value.
  useEffect(() => {
    setDraft(serializedValue);
    setError(null);
  }, [serializedValue]);

  const commit = () => {
    if (!draft.trim()) return;
    try {
      onCommit(JSON.parse(draft));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON value");
    }
  };

  return (
    <div>
      <Textarea
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        className="min-h-24 font-mono text-xs"
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function PropField({
  sectionIndex,
  name,
  schema,
  value,
  onChange,
  onRemove,
}: {
  sectionIndex: number;
  name: string;
  schema: z.ZodTypeAny;
  value: unknown;
  onChange: (value: unknown) => void;
  onRemove: () => void;
}) {
  const fieldId = `section-${sectionIndex}-${name}`;
  const inner = unwrap(schema);
  const required = !schema.safeParse(undefined).success;
  const isConfigured = value !== undefined;
  const removeButton = isConfigured && !required ? (
    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} title={`Clear ${labelFor(name)}`}>
      <X className="h-3.5 w-3.5" />
    </Button>
  ) : null;

  if (inner instanceof z.ZodBoolean) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
        <Label htmlFor={fieldId}>{labelFor(name)}{required ? " *" : ""}</Label>
        <div className="flex items-center gap-1">
          <Switch id={fieldId} checked={value === true} onCheckedChange={onChange} />
          {removeButton}
        </div>
      </div>
    );
  }

  if (inner instanceof z.ZodEnum) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between"><Label htmlFor={fieldId}>{labelFor(name)}{required ? " *" : ""}</Label>{removeButton}</div>
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
          <SelectTrigger id={fieldId}><SelectValue placeholder="Not configured" /></SelectTrigger>
          <SelectContent>
            {(inner.options as string[]).map((option: string) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (inner instanceof z.ZodNumber) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between"><Label htmlFor={fieldId}>{labelFor(name)}{required ? " *" : ""}</Label>{removeButton}</div>
        <Input id={fieldId} type="number" value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
      </div>
    );
  }

  if (inner instanceof z.ZodArray || inner instanceof z.ZodObject || inner instanceof z.ZodRecord) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between"><Label htmlFor={fieldId}>{labelFor(name)}{required ? " *" : ""}</Label>{removeButton}</div>
        <JsonField id={fieldId} value={value} placeholder={inner instanceof z.ZodArray ? "[]" : "{}"} onCommit={onChange} />
      </div>
    );
  }

  const stringValue = typeof value === "string" ? value : "";
  const multiline = /headline|subheadline|subtitle|description|note|text|body|helper/i.test(name) || stringValue.length > 90;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between"><Label htmlFor={fieldId}>{labelFor(name)}{required ? " *" : ""}</Label>{removeButton}</div>
      {multiline ? (
        <Textarea id={fieldId} value={stringValue} onChange={(event) => onChange(event.target.value)} className="min-h-20" />
      ) : (
        <Input id={fieldId} value={stringValue} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

export function SectionComposer({ value, onChange }: SectionComposerProps) {
  const [selectedType, setSelectedType] = useState<RegisteredSectionType>("featureGrid");
  const parsed = useMemo(() => {
    try {
      const raw = JSON.parse(value);
      return managedPageSectionsSchema.safeParse(raw).success
        ? (raw as EditableSection[])
        : Array.isArray(raw) ? (raw as EditableSection[]) : null;
    } catch {
      return null;
    }
  }, [value]);

  const save = (sections: EditableSection[]) => onChange(JSON.stringify(sections, null, 2));

  if (!parsed) {
    return <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">Fix the advanced JSON below to restore guided editing.</p>;
  }

  const updateProps = (index: number, props: Record<string, unknown>) => {
    const next = [...parsed];
    next[index] = { ...next[index], props };
    save(next);
  };

  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= parsed.length) return;
    const next = [...parsed];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label>Add template</Label>
          <Select value={selectedType} onValueChange={(type) => setSelectedType(type as RegisteredSectionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {registeredSectionTypes.map((type) => (
                <SelectItem key={type} value={type}>{sectionDefinitionMetadata[type].label} · {sectionDefinitionMetadata[type].role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => save([...parsed, {
            type: selectedType,
            version: sectionDefinitionMetadata[selectedType].version,
            props: structuredClone(sectionStarterProps[selectedType]),
          }])}
        >
          <Plus className="mr-2 h-4 w-4" /> Add section
        </Button>
      </div>

      {parsed.map((section, index) => {
        const type = section.type as RegisteredSectionType;
        const definition = sectionDefinitionMetadata[type];
        const shape = definition ? schemaShape(type) : {};
        const fieldNames = Array.from(new Set([...Object.keys(shape), ...Object.keys(section.props ?? {})]));
        return (
          <div key={`${type}-${index}`} className="space-y-4 rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <p className="font-semibold">{index + 1}. {definition?.label ?? type}</p>
                <p className="text-xs text-muted-foreground"><code>{type}</code> · {definition?.role ?? "unknown"} · v{section.version ?? definition?.version ?? 1}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)} title="Move up"><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" disabled={index === parsed.length - 1} onClick={() => move(index, 1)} title="Move down"><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => save([...parsed.slice(0, index + 1), structuredClone(section), ...parsed.slice(index + 1)])} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => save(parsed.filter((_, itemIndex) => itemIndex !== index))} title="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fieldNames.map((name) => (
                <PropField
                  key={name}
                  sectionIndex={index}
                  name={name}
                  schema={shape[name] ?? z.unknown()}
                  value={section.props?.[name]}
                  onChange={(fieldValue) => {
                    const props = { ...(section.props ?? {}) };
                    if (fieldValue === undefined) delete props[name];
                    else props[name] = fieldValue;
                    updateProps(index, props);
                  }}
                  onRemove={() => {
                    const props = { ...(section.props ?? {}) };
                    delete props[name];
                    updateProps(index, props);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
