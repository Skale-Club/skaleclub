import { useState } from 'react';
import { BarChart2, Bot, Building2, Network, Phone, Puzzle } from 'lucide-react';
import { SectionHeader, SubSidebar, SubSidebarLayout } from './shared';
import { AIAssistantCard } from './integrations/AIAssistantCard';
import { AnalyticsSection } from './integrations/AnalyticsSection';
import { GHLCard } from './integrations/GHLCard';
import { GooglePlacesCard } from './integrations/GooglePlacesCard';
import { GroqCard } from './integrations/GroqCard';
import { McpSettingsSection } from './McpSettingsSection';
import { TelegramSection } from './TelegramSection';
import { FormTranscriptionCard } from './integrations/FormTranscriptionCard';
import { TwilioSection } from './TwilioSection';
import { ResendSection } from './ResendSection';

type IntegrationTab = 'ai' | 'crm' | 'communications' | 'analytics' | 'mcp';

const INTEGRATION_TABS: { id: IntegrationTab; label: string; icon: typeof Bot }[] = [
  { id: 'ai',             label: 'AI Assistant',    icon: Bot       },
  { id: 'crm',            label: 'CRM',             icon: Building2 },
  { id: 'communications', label: 'Communications',  icon: Phone     },
  { id: 'analytics',      label: 'Analytics',       icon: BarChart2 },
  { id: 'mcp',            label: 'MCP',             icon: Network   },
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

      <SubSidebarLayout
        nav={
          <SubSidebar
            items={INTEGRATION_TABS}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as IntegrationTab)}
            storageKey="integrations"
          />
        }
      >
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <AIAssistantCard />
            <FormTranscriptionCard />
          </div>
        )}

        {activeTab === 'crm' && <GHLCard />}

        {activeTab === 'communications' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TwilioSection />
            <TelegramSection />
            <ResendSection />
            <GroqCard />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <GooglePlacesCard />
            <AnalyticsSection />
          </div>
        )}

        {activeTab === 'mcp' && <McpSettingsSection embedded />}
      </SubSidebarLayout>
    </div>
  );
}
