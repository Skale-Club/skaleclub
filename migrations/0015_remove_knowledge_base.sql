-- Migration 0015: Remove Knowledge Base Tables
-- The knowledge base feature is not being used in the application.
-- This migration removes all knowledge base related tables and columns.

-- Drop knowledge base tables (no longer used)
DROP TABLE IF EXISTS "knowledge_base_assistant_link" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_articles" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_categories" CASCADE;

-- Remove knowledge base flags from chat_settings
ALTER TABLE "chat_settings" DROP COLUMN IF EXISTS "use_knowledge_base";
