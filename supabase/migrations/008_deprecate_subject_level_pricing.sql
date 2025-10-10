-- Migration 008: Deprecate price_per_hour in subject_levels
-- Stawki są teraz powiązane z tutorem (profiles.hourly_rate), nie z poziomem

-- Dodaj komentarz do kolumny price_per_hour informujący, że jest deprecated
COMMENT ON COLUMN subject_levels.price_per_hour IS 'DEPRECATED: Cena jest teraz zarządzana per tutor (profiles.hourly_rate), nie per poziom przedmiotu';

-- Ustaw domyślną wartość 0 dla nowych rekordów
ALTER TABLE subject_levels ALTER COLUMN price_per_hour SET DEFAULT 0;

-- Opcjonalnie: zaktualizuj istniejące rekordy do 0 (odkomentuj jeśli chcesz)
-- UPDATE subject_levels SET price_per_hour = 0;

