-- ============================================================
-- Migration: Admin Finance Tracker tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- Admin Expenses (your card spending, build costs etc.)
CREATE TABLE IF NOT EXISTS admin_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_pence INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_expenses_date ON admin_expenses(date DESC);

-- Admin Finance Notes (free text notes, pay yourself back reminders etc.)
CREATE TABLE IF NOT EXISTS admin_finance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
