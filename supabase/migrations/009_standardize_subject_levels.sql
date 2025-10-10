-- Migration 009: Standardize subject levels
-- Każdy przedmiot ma 3 standardowe poziomy: Szkoła podstawowa, Szkoła średnia podstawa, Szkoła średnia rozszerzenie

-- Dodaj 3 standardowe poziomy dla każdego przedmiotu, który ich jeszcze nie ma

-- Poziom 1: Szkoła podstawowa
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT id, 'Szkoła podstawowa', 1, 0
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM subject_levels WHERE subject_id = s.id AND level_order = 1
);

-- Poziom 2: Szkoła średnia podstawa
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT id, 'Szkoła średnia podstawa', 2, 0
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM subject_levels WHERE subject_id = s.id AND level_order = 2
);

-- Poziom 3: Szkoła średnia rozszerzenie
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT id, 'Szkoła średnia rozszerzenie', 3, 0
FROM subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM subject_levels WHERE subject_id = s.id AND level_order = 3
);

