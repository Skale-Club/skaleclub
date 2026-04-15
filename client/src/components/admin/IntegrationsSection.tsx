import { useState } from 'react';
import { BarChart2, Bot, Building2, Phone, Puzzle } from 'lucide-react';
import { SectionHeader } from './shared';
import { AIAssistantCard } from './integrations/AIAssistantCard';
import { AnalyticsSection } from './integrations/AnalyticsSection';
import { GHLCard } from './integrations/GHLCard';
import { GooglePlacesCard } from './integrations/GooglePlacesCard';
import { GroqCard } from './integrations/GroqCard';
import { TwilioSection } from './TwilioSection';

type IntegrationTab = 'ai' | 'crm' | 'communications' | 'analytics';

const INTEGRATION_TABS: { id: IntegrationTab; label: string; icon: typeof Bot }[] = [
  { id: 'ai',             label: 'AI Assistant',    icon: Bot       },
  { id: 'crm',            label: 'CRM',             icon: Building2 },
  { id: 'communications', label: 'Communications',  icon: Phone     },
  { id: 'analytics',      label: 'Analytics',       icon: BarChart2 },
];

export function IntegrationsSection() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>('ai');

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Integrations"
        description="Connect external services — AI, CRM, communication"
        icon={<Puzzle className="w-5 h-5" />}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1.5 bg-muted p-1.5 rounded-lg overflow-x-auto">
        {INTEGRATION_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 min-w-0 justify-center ${
              activeTab === tab.id
                ? 'bg-white dark:bg-card border-border shadow-sm'
                : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50'
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'ai' && <AIAssistantCard />}

      {activeTab === 'crm' && <GHLCard />}

      {activeTab === 'communications' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TwilioSection />
          <GroqCard />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <GooglePlacesCard />
          <AnalyticsSection />
        </div>
      )}
    </div>
  );
}
