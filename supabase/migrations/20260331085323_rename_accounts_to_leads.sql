-- Migration: Rename accounts to leads
-- This renames all account-related tables, columns, enums, and indexes to lead terminology

-- 1. Rename enum type
ALTER TYPE sales_account_status RENAME TO sales_lead_status;

-- 2. Rename main table (this also requires updating the column that uses the enum type name in default)
-- First, alter the column to remove the type reference, then rename type, then alter back
-- Actually, PostgreSQL allows renaming the type and the column default will still work

-- 3. Rename sales_accounts to sales_leads
ALTER TABLE sales_accounts RENAME TO sales_leads;

-- 4. Rename sales_account_locations to sales_lead_locations
ALTER TABLE sales_account_locations RENAME TO sales_lead_locations;

-- 5. Rename sales_account_contacts to sales_lead_contacts
ALTER TABLE sales_account_contacts RENAME TO sales_lead_contacts;

-- 6. Rename account_id columns to lead_id in all tables

-- 6a. sales_lead_locations
ALTER TABLE sales_lead_locations RENAME COLUMN account_id TO lead_id;

-- 6b. sales_lead_contacts
ALTER TABLE sales_lead_contacts RENAME COLUMN account_id TO lead_id;

-- 6c. sales_visits
ALTER TABLE sales_visits RENAME COLUMN account_id TO lead_id;

-- 6d. sales_opportunities_local
ALTER TABLE sales_opportunities_local RENAME COLUMN account_id TO lead_id;

-- 6e. sales_tasks
ALTER TABLE sales_tasks RENAME COLUMN account_id TO lead_id;

-- 7. Rename indexes

-- 7a. sales_accounts indexes -> sales_leads
ALTER INDEX IF EXISTS sales_accounts_owner_idx RENAME TO sales_leads_owner_idx;
ALTER INDEX IF EXISTS sales_accounts_status_idx RENAME TO sales_leads_status_idx;
ALTER INDEX IF EXISTS sales_accounts_name_idx RENAME TO sales_leads_name_idx;

-- 7b. sales_account_locations index -> sales_lead_locations
ALTER INDEX IF EXISTS sales_account_locations_account_idx RENAME TO sales_lead_locations_lead_idx;

-- 7c. sales_account_contacts index -> sales_lead_contacts
ALTER INDEX IF EXISTS sales_account_contacts_account_idx RENAME TO sales_lead_contacts_lead_idx;

-- 7d. sales_visits index
ALTER INDEX IF EXISTS sales_visits_account_idx RENAME TO sales_visits_lead_idx;

-- 7e. sales_opportunities index
ALTER INDEX IF EXISTS sales_opportunities_account_idx RENAME TO sales_opportunities_lead_idx;

-- 8. Update entity_type in sync events from 'sales_account' to 'sales_lead'
UPDATE sales_sync_events SET entity_type = 'sales_lead' WHERE entity_type = 'sales_account';
