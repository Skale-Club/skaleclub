# FAQ Management Scripts

This directory contains utility scripts for managing FAQs in the Skale Club chat system.

## Available Scripts

### 1. `view-faqs.ts`
View all FAQs currently in the database.

```bash
npx tsx scripts/view-faqs.ts
```

### 2. `seed-faqs.ts`
Initial seeding script with 12 FAQs in Portuguese. Only runs if database is empty.

```bash
npx tsx scripts/seed-faqs.ts
```

### 3. `add-more-faqs.ts`
Adds 10 additional FAQs in English covering important topics like:
- Cancellation policy
- Eco-friendly products
- Satisfaction guarantee
- Service process
- Pet/child safety
- Rescheduling

```bash
npx tsx scripts/add-more-faqs.ts
```

### 4. `test-faq-search.ts`
Tests the FAQ search functionality with various queries.

```bash
npx tsx scripts/test-faq-search.ts
```

## Current FAQ Topics (21 Total)

### Service Information
- Types of marketing services offered
- Service areas covered
- Operating hours (Monday-Saturday, 8am-6pm)
- Minimum charge per appointment ($120)
- How to request a budget
- Booking without a visit

### Professional Quality
- Professional qualifications and training
- Why choose Skale Club

### Cleaning Process
- Step-by-step cleaning process
- Drying time expectations
- Stain removal capabilities

### Policies
- Cancellation policy (24-hour notice)
- Rescheduling policy
- Satisfaction guarantee
- Payment methods accepted

### Safety & Products
- Eco-friendly products
- Pet and child safety
- Product ingredients

### Customer Service
- Need to be home during service
- Booking lead time recommendations
- What if not satisfied

## How the Chat Uses FAQs

The chat AI has access to the `search_faqs` tool that:

1. **Searches by keyword** - Queries both questions and answers
2. **Returns all FAQs** - When no query is provided
3. **Case-insensitive** - Matches regardless of capitalization

### Example Chat Interactions

**Customer:** "What is your cancellation policy?"
**AI:** [Calls `search_faqs` with query="cancellation"]
**AI:** Returns exact answer from database

**Customer:** "Are your products safe for my dog?"
**AI:** [Calls `search_faqs` with query="pets"]
**AI:** Returns pet-safe product information

**Customer:** "Can you remove wine stains?"
**AI:** [Calls `search_faqs` with query="stain"]
**AI:** Returns stain removal capabilities

## Adding New FAQs

### Via Admin Panel
1. Login to Admin → FAQs section
2. Click "Add FAQ"
3. Enter question and answer
4. Set order (for display priority)
5. Save

### Via Script
Create a new script or modify `add-more-faqs.ts`:

```typescript
const newFaqs = [
  {
    question: "Your question here?",
    answer: "Your detailed answer here.",
    order: 21, // Next available order number
  },
];
```

## Testing FAQ Search

After adding FAQs, test them:

```bash
# View all FAQs
npx tsx scripts/view-faqs.ts

# Test search functionality
npx tsx scripts/test-faq-search.ts
```

Then test in the actual chat by asking questions related to your new FAQs.

## Database Schema

```typescript
faqs {
  id: serial PRIMARY KEY
  question: text NOT NULL
  answer: text NOT NULL
  order: integer DEFAULT 0
}
```

## System Prompt Integration

The chat's system prompt includes instructions to:
- Use `search_faqs` for policy/process/product questions
- ALWAYS search FAQs before answering
- Never make up policy information
- Provide accurate answers from database

## Best Practices

1. **Clear Questions**: Write questions as customers would ask them
2. **Complete Answers**: Provide thorough, specific answers
3. **Multiple Phrasings**: Create multiple FAQs for the same topic with different wording
4. **Keywords**: Include relevant keywords in answers for better search results
5. **Order Priority**: Set lower order numbers for more important FAQs
6. **Regular Updates**: Keep FAQs current with business policy changes

## Future Enhancements

- [ ] Multi-language support (detect customer language)
- [ ] FAQ analytics (track which FAQs are most searched)
- [ ] Smart FAQ suggestions in chat
- [ ] Category/tag system for FAQs
- [ ] A/B testing different FAQ answers
