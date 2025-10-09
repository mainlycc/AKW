-- Ten plik zawiera przykładowe dane do testowania aplikacji
-- UWAGA: Uruchom ten skrypt TYLKO w środowisku deweloperskim!

-- Najpierw musimy utworzyć użytkowników w auth.users ręcznie przez panel Supabase
-- Ten skrypt zakłada, że użytkownicy już istnieją

-- Przykładowe przedmioty
INSERT INTO subjects (name, description) VALUES
  ('Matematyka', 'Korepetycje z matematyki na różnych poziomach'),
  ('Fizyka', 'Korepetycje z fizyki'),
  ('Chemia', 'Korepetycje z chemii'),
  ('Język angielski', 'Nauka języka angielskiego'),
  ('Język polski', 'Przygotowanie do matury z języka polskiego')
ON CONFLICT DO NOTHING;

-- Przykładowe poziomy dla Matematyki
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT 
  s.id,
  level_data.level_name,
  level_data.level_order,
  level_data.price
FROM subjects s
CROSS JOIN (
  VALUES 
    ('Podstawowy', 1, 80.00),
    ('Rozszerzony', 2, 100.00),
    ('Maturalny', 3, 120.00)
) AS level_data(level_name, level_order, price)
WHERE s.name = 'Matematyka'
ON CONFLICT DO NOTHING;

-- Przykładowe poziomy dla Fizyki
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT 
  s.id,
  level_data.level_name,
  level_data.level_order,
  level_data.price
FROM subjects s
CROSS JOIN (
  VALUES 
    ('Podstawowy', 1, 75.00),
    ('Rozszerzony', 2, 95.00),
    ('Maturalny', 3, 115.00)
) AS level_data(level_name, level_order, price)
WHERE s.name = 'Fizyka'
ON CONFLICT DO NOTHING;

-- Przykładowe poziomy dla Chemii
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT 
  s.id,
  level_data.level_name,
  level_data.level_order,
  level_data.price
FROM subjects s
CROSS JOIN (
  VALUES 
    ('Podstawowy', 1, 75.00),
    ('Rozszerzony', 2, 95.00),
    ('Maturalny', 3, 110.00)
) AS level_data(level_name, level_order, price)
WHERE s.name = 'Chemia'
ON CONFLICT DO NOTHING;

-- Przykładowe poziomy dla Języka angielskiego
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT 
  s.id,
  level_data.level_name,
  level_data.level_order,
  level_data.price
FROM subjects s
CROSS JOIN (
  VALUES 
    ('A2', 1, 70.00),
    ('B1', 2, 85.00),
    ('B2', 3, 100.00),
    ('C1', 4, 120.00)
) AS level_data(level_name, level_order, price)
WHERE s.name = 'Język angielski'
ON CONFLICT DO NOTHING;

-- Przykładowe poziomy dla Języka polskiego
INSERT INTO subject_levels (subject_id, level_name, level_order, price_per_hour)
SELECT 
  s.id,
  level_data.level_name,
  level_data.level_order,
  level_data.price
FROM subjects s
CROSS JOIN (
  VALUES 
    ('Podstawowy', 1, 70.00),
    ('Rozszerzony', 2, 90.00),
    ('Maturalny', 3, 110.00)
) AS level_data(level_name, level_order, price)
WHERE s.name = 'Język polski'
ON CONFLICT DO NOTHING;

-- Przykładowi uczniowie
INSERT INTO students (first_name, last_name, parent_email, parent_phone, notes) VALUES
  ('Anna', 'Nowak', 'rodzic.nowak@example.com', '+48 123 456 789', 'Uczeń klasy 8, przygotowanie do egzaminu'),
  ('Jan', 'Kowalski', 'kowalski.rodzic@example.com', '+48 987 654 321', 'Liceum, poziom rozszerzony'),
  ('Maria', 'Wiśniewska', 'wisniewski@example.com', '+48 555 666 777', 'Przygotowanie do matury'),
  ('Piotr', 'Zieliński', 'zielinski.kontakt@example.com', '+48 444 555 666', NULL),
  ('Katarzyna', 'Lewandowska', 'lewandowska@example.com', '+48 333 222 111', 'Potrzebuje pomocy w gramatyce')
ON CONFLICT DO NOTHING;

-- UWAGA: Przypisania i sesje wymagają istniejących ID użytkowników z tabeli profiles
-- Te dane należy dodać ręcznie po utworzeniu użytkowników w panelu Supabase

