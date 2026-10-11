# Lead notifications

Completed website leads are stored in `form_leads` and delivered to every
configured Telegram destination. SMS templates are not used by the completed
lead pipeline.

## Message contract

`server/lib/lead-telegram.ts` is the single formatter and sender for standard
forms, NFC order forms, the WhatsApp pre-chat, Skale Hub capture, the AI chat
qualification flow, and the contact form.

Every message uses the same compact structure:

1. Lead and form identity
2. `────────────`
3. Contact details and a WhatsApp link when the phone is usable
4. `────────────`
5. Answers, in the order defined by `FormConfig.questions`
6. `────────────`
7. Origin: form, page URL, language, referrer, UTMs, capture channel and time

Telegram receives HTML with user-provided values escaped. Individual answers
and the complete message are bounded so a large form cannot exceed Telegram's
message limit. The source block is retained when answers must be omitted.

## Language

The browser sends the active UI language (`en` or `pt`) with the lead. It is
stored in `form_leads.language`; `referrer_url` stores the referring page. For
older clients that do not send a language, a `/br` origin path selects
Portuguese and every other path selects English.

System labels use the fixed `COPY` map in `server/lib/lead-telegram.ts`.
Question, option and form labels remain authored in English, then use the
existing static Portuguese dictionary and cached translations. If a cached
translation is unavailable, the English label is used instead of delaying or
losing the notification. Free-text answers are never translated.

## Adding or changing a form

- Define questions and their order in `FormConfig`; the Telegram message follows
  that order automatically.
- Use the standard lead progress endpoint and send `language`, `urlOrigem`,
  `referrerUrl` and the UTM fields.
- Route special capture endpoints through `runLeadPostProcessing` with both the
  form slug and form name.
- Do not build a Telegram message in an individual route.
- Only set `notificacaoEnviada` after Telegram confirms at least one destination.

The contact route creates its own managed form record so contact submissions
also appear in the same lead storage and notification pipeline.

## Production checklist

1. Apply `supabase/migrations/20261011120000_form_lead_locale_origin.sql`.
2. Confirm Telegram is enabled and has at least one destination.
3. Submit one English and one Portuguese form from pages with test UTMs.
4. Confirm headings, answers, origin metadata and the WhatsApp link.
5. Confirm the saved leads have `notificacao_enviada = true` only after delivery.

Bot tokens and chat IDs belong in integration settings and must never be added
to source files, tests or documentation.
