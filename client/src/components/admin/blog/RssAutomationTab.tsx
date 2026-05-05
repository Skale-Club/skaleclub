import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { AutomationStatusBanners } from "./AutomationStatusBanners";
import { RssSourcesPanel } from "./RssSourcesPanel";
import { RssQueuePanel } from "./RssQueuePanel";
import { JobHistoryPanel } from "./JobHistoryPanel";

type SubTab = "sources" | "queue" | "jobs";
const SUB_TABS: Array<{ id: SubTab; labelKey: "Sources" | "Queue" | "Jobs" }> = [
  { id: "sources", labelKey: "Sources" },
  { id: "queue", labelKey: "Queue" },
  { id: "jobs", labelKey: "Jobs" },
];

export function RssAutomationTab() {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("sources");

  return (
    <div className="space-y-4">
      {/* Banners pinned ABOVE sub-tabs (D-02) */}
      <AutomationStatusBanners />

      {/* Sub-tabs */}
      <div className="flex gap-1.5 bg-muted p-1.5 rounded-lg overflow-x-auto">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-all flex-1 justify-center ${
              activeSubTab === tab.id
                ? "bg-white dark:bg-card border-border shadow-sm"
                : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50"
            }`}
            data-testid={`subtab-rss-${tab.id}`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeSubTab === "sources" && <RssSourcesPanel />}
      {activeSubTab === "queue" && <RssQueuePanel />}
      {activeSubTab === "jobs" && <JobHistoryPanel />}
    </div>
  );
}
