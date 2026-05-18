import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { SectionHeader } from '@/components/admin/shared';
import { MarketingCampaignsTab } from '@/components/admin/marketing/MarketingCampaignsTab';
import { MarketingSourcesTab } from '@/components/admin/marketing/MarketingSourcesTab';
import {
  type DatePreset,
  type MarketingFilters,
} from '@/components/admin/marketing/utils';
import { MarketingConversionsTab } from '@/components/admin/marketing/MarketingConversionsTab';
import { MarketingOverviewTab } from '@/components/admin/marketing/MarketingOverviewTab';
import { MarketingJourneyTab } from '@/components/admin/marketing/MarketingJourneyTab';

const DATE_PRESETS: ReadonlyArray<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
];

const CONVERSION_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'phone_click', label: 'Phone Call' },
  { value: 'form_submitted', label: 'Form Submitted' },
  { value: 'booking_started', label: 'Booking Started' },
];

const ALL_VALUE = '__all__'; // sentinel — Select cannot use empty-string value

export function MarketingSection({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [filters, setFilters] = useState<MarketingFilters>({ datePreset: '30d' });
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedVisitorUuid, setSelectedVisitorUuid] = useState<string | null>(null);

  // Source / Campaign options will be populated by tabs once data loads (Plan 02+).
  // For now we render a single "All" option so the Selects are functional.
  const sourceOptions: string[] = [];
  const campaignOptions: string[] = [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Traffic Analytics"
        description="See where your visitors come from and which sources generate real leads."
        icon={<TrendingUp className="w-5 h-5" />}
      />

      {/* Filter bar — D-05, D-06, D-07, D-08, D-09, D-10 */}
      <div className="flex flex-wrap items-center gap-2" data-testid="marketing-filter-bar">
        {/* Date preset buttons */}
        <div className="flex items-center gap-1">
          {DATE_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant={filters.datePreset === preset.id ? 'default' : 'outline'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  datePreset: preset.id,
                  dateFrom: undefined,
                  dateTo: undefined,
                }))
              }
              data-testid={`marketing-preset-${preset.id}`}
            >
              {preset.label}
            </Button>
          ))}

          {/* Custom date range — Popover with Calendar (D-07) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={
                  filters.datePreset === 'custom' && filters.dateFrom && filters.dateTo
                    ? 'default'
                    : 'outline'
                }
                data-testid="marketing-preset-custom"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                {filters.dateFrom && filters.dateTo
                  ? `${format(new Date(filters.dateFrom), 'MMM d')} – ${format(
                      new Date(filters.dateTo),
                      'MMM d',
                    )}`
                  : 'Custom'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                  to: filters.dateTo ? new Date(filters.dateTo) : undefined,
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setFilters((prev) => ({
                      ...prev,
                      datePreset: 'custom',
                      dateFrom: range.from!.toISOString(),
                      dateTo: range.to!.toISOString(),
                    }));
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Divider */}
        <div className="border-l border-border h-6 mx-2" aria-hidden="true" />

        {/* Source filter (D-08) */}
        <Select
          value={filters.source ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilters((prev) => ({ ...prev, source: v === ALL_VALUE ? undefined : v }))
          }
        >
          <SelectTrigger className="w-[180px] h-9" data-testid="marketing-filter-source">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All sources</SelectItem>
            {sourceOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Campaign filter (D-08) */}
        <Select
          value={filters.campaign ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilters((prev) => ({ ...prev, campaign: v === ALL_VALUE ? undefined : v }))
          }
        >
          <SelectTrigger className="w-[200px] h-9" data-testid="marketing-filter-campaign">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All campaigns</SelectItem>
            {campaignOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Conversion type filter (D-09) */}
        <Select
          value={filters.conversionType ?? ALL_VALUE}
          onValueChange={(v) =>
            setFilters((prev) => ({
              ...prev,
              conversionType: v === ALL_VALUE ? undefined : v,
            }))
          }
        >
          <SelectTrigger className="w-[200px] h-9" data-testid="marketing-filter-conversion-type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All types</SelectItem>
            {CONVERSION_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs (D-11) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="marketing-tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="marketing-tab-sources">
            Sources
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="marketing-tab-campaigns">
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="conversions" data-testid="marketing-tab-conversions">
            Conversions
          </TabsTrigger>
          <TabsTrigger value="journey" data-testid="marketing-tab-journey">
            Journey
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <MarketingOverviewTab filters={filters} />
        </TabsContent>
        <TabsContent value="sources" className="pt-4">
          <MarketingSourcesTab filters={filters} />
        </TabsContent>
        <TabsContent value="campaigns" className="pt-4">
          <MarketingCampaignsTab filters={filters} />
        </TabsContent>
        <TabsContent value="conversions" className="pt-4">
          <MarketingConversionsTab
            filters={filters}
            onSelectVisitor={(uuid) => {
              setSelectedVisitorUuid(uuid);
              setActiveTab('journey');
            }}
          />
        </TabsContent>
        <TabsContent value="journey" className="pt-4">
          <MarketingJourneyTab selectedVisitorUuid={selectedVisitorUuid} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
