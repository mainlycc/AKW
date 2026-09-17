-- Migration 052: Add messenger_url to profiles for tutors
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS messenger_url TEXT;
