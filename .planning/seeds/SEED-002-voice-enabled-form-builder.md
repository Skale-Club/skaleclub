---
id: SEED-002
status: dormant
planted: 2026-05-22T00:00:00-04:00
planted_during: v1.5 / post-audit discussion
trigger_when: When planning work on the form builder, lead capture UX, Groq as a chat/AI provider, or audio transcription in public forms.
scope: Large
---

# SEED-002: Voice-enabled form builder with transcription provider selection

## Why This Matters

Lead qualification forms currently work best for structured text and select answers. For project discovery, many leads can explain their needs faster and more naturally by voice. A voice-enabled branch in the form would reduce friction, capture richer context, and give the admin a summarized project brief instead of only raw answers.

This also connects naturally to the existing AI integrations direction: Groq should become a first-class AI provider alongside OpenAI, Gemini, and OpenRouter, and the admin should be able to choose which provider handles speech-to-text for form audio.

## When to Surface

**Trigger:** When planning work on the form builder, lead capture UX, Groq as a chat/AI provider, or audio transcription in public forms.

This seed should be presented during `$gsd-new-milestone` when the milestone scope matches any of these conditions:
- The milestone includes form builder schema improvements, conditional logic, branches, or new question types.
- The milestone includes Groq integration beyond the existing audio/transcription helper.
- The milestone includes public lead capture UX improvements, audio recording, or AI-generated lead summaries.
- The milestone includes admin integration settings for selecting provider/model behavior.

## Scope Estimate

**Large** - likely a full milestone or multiple phases. This touches shared form schema, admin builder UI, public form UX, backend upload/transcription routes, provider settings, lead storage/display, and verification across browser permissions and provider failures.

## Breadcrumbs

Related code and decisions found in the current codebase:

- `client/src/components/LeadFormModal.tsx` - public form runtime, step flow, validation, local storage, progressive lead submission.
- `client/src/components/admin/leads/FormEditorContent.tsx` - current form builder editor for questions, ordering, thresholds.
- `client/src/components/admin/leads/QuestionForm.tsx` - current question schema UI, limited to text/email/tel/select plus one conditional field.
- `client/src/components/admin/forms/FormsSection.tsx` - multi-form admin list/editor route.
- `shared/schema/forms.ts` - form JSON config types and lead storage schema.
- `shared/form.ts` - default config, scoring, known fields, max score, sorted question helpers.
- `server/routes/forms.ts` - public form config and progressive lead submission endpoints.
- `server/storage.ts` - form CRUD and `upsertFormLeadProgress` persistence/scoring behavior.
- `client/src/pages/PublicForm.tsx` - direct `/f/:slug` public form entrypoint.
- `server/lib/ai-provider.ts` - active AI provider resolution; currently supports OpenAI, Gemini, OpenRouter for chat and has runtime Groq key helpers.
- `server/lib/openrouter.ts` - OpenRouter OpenAI-compatible client factory.
- `server/routes/integrations.ts` - admin integration endpoints for OpenAI, Gemini, OpenRouter, and Groq settings.
- `client/src/components/admin/integrations/AIAssistantCard.tsx` - admin UI for selecting chat provider; OpenRouter model picker pattern can guide Groq/provider UI.
- `client/src/components/admin/integrations/GroqCard.tsx` - existing Groq admin card.
- `client/src/pages/xpot/components/VoiceRecorder.tsx` - existing audio recorder UI pattern with visual feedback.
- `server/routes/xpot/visits.ts` - existing audio transcription flow around visits.
- `server/routes/xpot/helpers.ts` - existing Groq integration usage for XPOT helpers.
- `.planning/STATE.md` - v1.1 notes include multi-forms support and chat form selection by slug.

## Notes

Proposed product shape from the discussion:

- Add Groq as a provider option in the same AI provider area that currently has OpenAI, Gemini, and OpenRouter.
- Add a separate speech-to-text/transcription provider selector in the API/integrations menu, with at least Groq Whisper and possibly OpenRouter-compatible transcription if supported.
- Improve form schema beyond the current single `conditionalField` model. The target UX needs branching: a select question such as "Would you like to explain your project by voice or text?" should route to either a text field or a voice recorder field.
- Add a voice/audio question type that records audio, shows visual recording feedback, uploads/transcribes it, lets the lead review or retry, then saves transcript plus metadata.
- Save both the full transcript and an admin-facing summary on the lead. The lead dashboard should show the summary first, with full transcript expandable.
- Keep fallback behavior in mind: microphone denied, upload fails, transcription provider disabled, model error, and retry/re-record flows.

Related form builder audit concerns to consider in the same planning window:

- Empty active forms can be published and produce a broken/blank public flow.
- New leads currently require `nome` to start, which conflicts with arbitrary form ordering.
- Select questions can be created without options.
- Thresholds can be saved in invalid order.
- Form score validation still has a legacy fixed max.
- Custom answers need consistent handling across public form and chat.
