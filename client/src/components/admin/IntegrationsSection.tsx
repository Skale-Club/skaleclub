import { AIAssistantCard } from './integrations/AIAssistantCard';
import { AnalyticsSection } from './integrations/AnalyticsSection';
import { GHLCard } from './integrations/GHLCard';
import { GooglePlacesCard } from './integrations/GooglePlacesCard';
import { GroqCard } from './integrations/GroqCard';
import { TwilioSection } from './TwilioSection';

export function IntegrationsSection() {
  return (
    <div className="space-y-8">
      <AIAssistantCard />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GHLCard />
        <GroqCard />
        <TwilioSection />
        <GooglePlacesCard />
      </div>
      <AnalyticsSection />
    </div>
  );
}
