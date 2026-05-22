# Requirements: Skale Club Web Platform - v1.7 Voice-Enabled Form Builder & Groq Provider

**Defined:** 2026-05-22
**Core Value:** Leads can qualify themselves through smarter forms that support branching, text or voice project explanations, AI transcription, and admin-ready summaries.

## v1.7 Requirements

### AI Provider & Transcription

- [x] **AI-01**: Admin can select Groq as an active chat provider alongside OpenAI, Gemini, and OpenRouter.
- [x] **AI-02**: Runtime chat provider resolution can return a Groq client and model when `chat_settings.active_ai_provider = "groq"`.
- [x] **STT-01**: Admin can configure the public-form speech-to-text provider separately from the chat provider.
- [x] **STT-02**: Form transcription can use Groq Whisper models.
- [x] **STT-03**: Form transcription can use OpenRouter's audio transcription endpoint when OpenRouter credentials are configured.

### Form Engine Hardening

- [x] **FORM-01**: Form configs validate server-side before an active form can be saved or restored.
- [x] **FORM-02**: Active forms must have at least one question.
- [x] **FORM-03**: Select questions cannot be saved without options.
- [x] **FORM-04**: Thresholds must be ordered as HOT >= WARM >= COLD.
- [x] **FORM-05**: Dynamic forms no longer depend on the first submitted field being `nome`.
- [x] **FORM-06**: Dynamic form scoring no longer uses the legacy fixed `scoreTotal <= 78` limit.
- [x] **FORM-07**: `maxScore` calculation is safe when select options are empty or malformed.
- [x] **FORM-08**: Form runtime supports `textarea` and `voice` question types.
- [x] **FORM-09**: Form runtime supports plural `conditionalFields` while preserving legacy `conditionalField`.
- [x] **FORM-10**: Chat qualification preserves new custom/dynamic answers instead of dropping fields outside the legacy known column set.

### Voice Capture

- [x] **VOICE-01**: Public form renders a voice-answer input with record/stop control, timer, and visual level feedback.
- [x] **VOICE-02**: Public form uploads recorded audio for transcription through a form-scoped endpoint.
- [x] **VOICE-03**: Public form stores transcript text into lead answers.
- [x] **VOICE-04**: Public form stores transcript summary into lead custom answers for admin review.
- [ ] **VOICE-05**: Public form persists audio file URL and audio metadata for playback/reprocessing.
- [ ] **VOICE-06**: Public form lets users explicitly review, accept, retry, or switch to text after transcription.

### Branch Builder UX

- [x] **BRANCH-01**: Existing single conditional field can be configured as text, textarea, email, phone, or voice.
- [ ] **BRANCH-02**: Admin can configure multiple conditional branches per select question.
- [ ] **BRANCH-03**: Admin can route a branch to one or more follow-up fields.
- [ ] **BRANCH-04**: Admin can see branch/readiness validation errors inline before publishing.
- [ ] **BRANCH-05**: Branch editor prevents unreachable required fields and duplicate field IDs.

### Lead Admin UX

- [x] **LEAD-01**: Lead detail view displays voice transcript summaries inline with the relevant form answer.
- [x] **LEAD-02**: Lead detail view hides transcript summary helper fields from noisy "extra custom answers" lists.
- [ ] **LEAD-03**: Lead detail view has a polished "Project Brief" section for voice/text project descriptions.
- [ ] **LEAD-04**: Lead detail view supports transcript expansion/collapse separate from summary.
- [ ] **LEAD-05**: Lead detail view shows transcription provider/model metadata when available.

### Verification

- [x] **VERIFY-01**: TypeScript check passes after provider, form engine, and voice form changes.
- [x] **VERIFY-02**: Local homepage smoke check loads without browser console errors.
- [ ] **VERIFY-03**: Manual UAT confirms Groq transcription with a real API key.
- [ ] **VERIFY-04**: Manual UAT confirms OpenRouter transcription with a real API key.
- [ ] **VERIFY-05**: Manual UAT confirms branch choice "text vs voice" works end-to-end on a public `/f/:slug` form.
- [ ] **VERIFY-06**: Manual UAT confirms chat qualification can save custom branch/voice answers.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full visual flowchart builder | Useful later, but this milestone focuses on branch-capable forms without a canvas editor |
| Voice response playback without persisted audio | Requires audio object storage, handled by VOICE-05 before playback can be reliable |
| Automatic CRM note formatting for voice summaries | GHL sync currently maps fields; rich CRM note generation can be a later milestone |
| Multi-provider live benchmarking | Admin chooses provider manually for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AI-01 | Phase 30 | Complete |
| AI-02 | Phase 30 | Complete |
| STT-01 | Phase 30 | Complete |
| STT-02 | Phase 30 | Complete |
| STT-03 | Phase 30 | Complete |
| FORM-01 | Phase 31 | Complete |
| FORM-02 | Phase 31 | Complete |
| FORM-03 | Phase 31 | Complete |
| FORM-04 | Phase 31 | Complete |
| FORM-05 | Phase 31 | Complete |
| FORM-06 | Phase 31 | Complete |
| FORM-07 | Phase 31 | Complete |
| FORM-08 | Phase 31 | Complete |
| FORM-09 | Phase 31 | Complete |
| FORM-10 | Phase 31 | Complete |
| VOICE-01 | Phase 32 | Complete |
| VOICE-02 | Phase 32 | Complete |
| VOICE-03 | Phase 32 | Complete |
| VOICE-04 | Phase 32 | Complete |
| VOICE-05 | Phase 34 | Not started |
| VOICE-06 | Phase 34 | Not started |
| BRANCH-01 | Phase 32 | Complete |
| BRANCH-02 | Phase 33 | Not started |
| BRANCH-03 | Phase 33 | Not started |
| BRANCH-04 | Phase 33 | Not started |
| BRANCH-05 | Phase 33 | Not started |
| LEAD-01 | Phase 32 | Complete |
| LEAD-02 | Phase 32 | Complete |
| LEAD-03 | Phase 34 | Not started |
| LEAD-04 | Phase 34 | Not started |
| LEAD-05 | Phase 34 | Not started |
| VERIFY-01 | Phase 35 | Complete |
| VERIFY-02 | Phase 35 | Complete |
| VERIFY-03 | Phase 35 | Not started |
| VERIFY-04 | Phase 35 | Not started |
| VERIFY-05 | Phase 35 | Not started |
| VERIFY-06 | Phase 35 | Not started |

**Coverage:**
- v1.7 requirements: 37 total
- Complete: 24
- Remaining: 13
- Mapped to phases: 37/37 (100%)

---
*Requirements defined: 2026-05-22*
