-- Drop backup table after PayU migration verification (was paynow_payments)
DROP TABLE IF EXISTS public.paynow_payments_old CASCADE;
