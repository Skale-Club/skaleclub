# Dynamic Translation System

## Overview

This project now uses **AI-powered dynamic translations** instead of hardcoded translation dictionaries. The system caches translations in the database to avoid redundant AI API calls.

## Architecture

### Database Layer
- **Table**: `translations`
- **Columns**:
  - `source_text`: Original English text
  - `source_language`: Source language (default: 'en')
  - `target_language`: Target language (e.g., 'pt')
  - `translated_text`: AI-generated translation
  - `created_at`, `updated_at`: Timestamps
- **Indexes**:
  - Unique index on `(source_text, source_language, target_language)` - prevents duplicates
  - Lookup index on `(source_language, target_language)` - fast queries

### API Layer
- **Endpoint**: `POST /api/translate`
- **Request Body**:
  ```json
  {
    "texts": ["Hello", "Welcome"],
    "targetLanguage": "pt"
  }
  ```
- **Response**:
  ```json
  {
    "translations": {
      "Hello": "Olá",
      "Welcome": "Bem-vindo"
    }
  }
  ```

### Translation Flow
1. Client requests translation via `useTranslation()` hook
2. Hook batches requests together (50ms debounce)
3. API checks database cache first
4. If not cached, calls Gemini AI with translation prompt
5. Stores translation in database
6. Returns translated text to client
7. Client updates UI via custom event

### Client Layer
- **Hook**: `useTranslation()`
  - Returns: `{ t, language, setLanguage, isEnglish, isPortuguese }`
  - `t(text)` function returns original text immediately, then updates when translation arrives
  - In-memory cache prevents redundant API calls
  - Batch processing reduces server load

### AI Integration
- Uses existing Gemini AI client (`server/lib/gemini.ts`)
- Temperature: 0.3 (consistent translations)
- Prompt engineered for JSON response format
- Fallback to original text if AI unavailable

## Usage

### In React Components

```tsx
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t, language, setLanguage } = useTranslation();
  
  return (
    <div>
      <h1>{t("Welcome to Skale Club")}</h1>
      <p>{t("We help you grow your business")}</p>
      <button onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}>
        {t("Switch Language")}
      </button>
    </div>
  );
}
```

### Language Selector

The navbar includes a flag-based language selector:
- 🇺🇸 English
- 🇧🇷 Portuguese

Preference is stored in `localStorage` and persists across sessions.

## Performance Optimizations

1. **Database Caching**: Translations stored permanently, retrieved instantly
2. **Batch Requests**: Multiple translation requests grouped into single API call
3. **In-Memory Cache**: Client-side map prevents duplicate API calls in same session
4. **Debouncing**: 50ms delay before batch request fired
5. **Lazy Loading**: Translations fetched on-demand, not all at once

## Migration

### From Hardcoded to Dynamic

Previously, the project used `client/src/lib/translations.ts` with hardcoded mappings:
```typescript
// OLD - DO NOT USE
export const translations = {
  pt: {
    "Welcome": "Bem-vindo",
    "Hello": "Olá"
  }
};
```

This violated the project's "no hardcoded content" principle. The new system:
- ✅ Stores all content in database
- ✅ Uses AI for dynamic translation
- ✅ Caches efficiently
- ✅ Scales to any language
- ✅ No code changes needed for new translations

### Cleanup

The following files are now **obsolete**:
- `client/src/lib/translations.ts` - Remove when fully migrated
- All `t()` calls still work - no changes needed to components

## Database Commands

### Create Table
```bash
npx tsx scripts/apply-translations-table.ts
```

### View Translations
```sql
SELECT * FROM translations WHERE target_language = 'pt' LIMIT 10;
```

### Clear Cache (force re-translation)
```sql
DELETE FROM translations WHERE target_language = 'pt';
```

## Environment Variables

Required for AI translation to work:
- `GEMINI_API_KEY` - Gemini AI API key (stored in integrationSettings table)

## Troubleshooting

### Translations not appearing
1. Check browser console for API errors
2. Verify Gemini API key is configured in admin panel
3. Check database connection
4. Clear browser localStorage and refresh

### Slow translation loading
1. First load fetches from AI (slower)
2. Subsequent loads use database cache (instant)
3. Consider pre-warming cache with common phrases

### Mixed languages on page
- Expected behavior: English shown first, then updates to Portuguese
- Solved by batching all translations together

## Future Enhancements

- [ ] Admin panel to review/edit AI translations
- [ ] Pre-warming script to cache common UI phrases
- [ ] Support for additional languages (es, fr, de)
- [ ] Translation quality voting system
- [ ] A/B testing of translation variations
