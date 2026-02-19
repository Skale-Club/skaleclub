import "dotenv/config";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function fixConsultingSteps() {
  console.log('🔧 Fixing Consulting Steps translations...\n');

  try {
    const settings = await db.select().from(companySettings).limit(1);
    
    if (settings.length > 0) {
      const setting = settings[0];
      const content = setting.homepageContent as any;
      
      if (content?.consultingStepsSection?.steps) {
        const steps = content.consultingStepsSection.steps;
        
        // Update each step with English translations
        steps[0] = {
          ...steps[0],
          title: "Diagnosis and Direction",
          whatWeDo: "We understand your service, your region, your competitors and your goal (ticket, volume, schedule).",
          outcome: "Diagnosis of what is blocked + simple action plan (week 1 priorities).",
        };
        
        steps[1] = {
          ...steps[1],
          title: "Irresistible Offer (without lowering price)",
          whatWeDo: "We adjust your offer to the American market standard (clarity, trust, differentiation).",
          outcome: "Well-defined package/service + realistic promise + \"why choose you\" in 1 sentence.",
        };
        
        steps[2] = {
          ...steps[2],
          title: "Digital Presence That Converts",
          whatWeDo: "We set up/adjust what the client sees before calling you (website, Google, social proof).",
          outcome: "Page/landing structure + essential copy + checklist of what needs to be \"right\" to convert.",
        };
        
        steps[3] = {
          ...steps[3],
          title: "Lead Acquisition (the right way)",
          whatWeDo: "We choose the channels that make sense for your moment (Google Ads, Local, etc.).",
          outcome: "Acquisition strategy + segmentation + recommended budget and why (no guesswork).",
        };
        
        steps[4] = {
          ...steps[4],
          title: "Conversion and Closing (without chasing)",
          whatWeDo: "We create your service flow to transform leads into appointments.",
          outcome: "Conversation script (SMS/call) + follow-ups + proposal/closing template.",
        };
        
        steps[5] = {
          ...steps[5],
          title: "Optimization and Scale",
          whatWeDo: "We adjust numbers, reduce waste and create an improvement routine.",
          outcome: "Optimization plan (what to measure and when) + next steps to scale consistently.",
        };
        
        content.consultingStepsSection.steps = steps;
        
        await db.update(companySettings)
          .set({ homepageContent: content })
          .where(eq(companySettings.id, setting.id));
        
        console.log('✅ Consulting Steps translated successfully!');
        console.log(`   - Updated ${steps.length} steps\n`);
      }
    }
    
    console.log('🎉 Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixConsultingSteps();
