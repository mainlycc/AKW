-- Migration 021: Automatyczne generowanie sesji z booked_slots
-- System automatycznie generuje sesje w tutoring_sessions na podstawie booked_slots

-- Funkcja pomocnicza: oblicza datę następnego wystąpienia danego dnia tygodnia
CREATE OR REPLACE FUNCTION get_next_weekday_date(
  p_weekday INTEGER, -- 1=Poniedziałek, 7=Niedziela
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE AS $$
DECLARE
  v_current_weekday INTEGER;
  v_days_to_add INTEGER;
BEGIN
  -- Oblicz dzień tygodnia dla p_start_date (1=Poniedziałek, 7=Niedziela)
  -- PostgreSQL DOW: 0=Niedziela, 1=Poniedziałek, ..., 6=Sobota
  -- Nasz system: 1=Poniedziałek, 2=Wtorek, ..., 7=Niedziela
  -- Konwersja: 0→7, 1→1, 2→2, ..., 6→6
  v_current_weekday := EXTRACT(DOW FROM p_start_date);
  IF v_current_weekday = 0 THEN
    v_current_weekday := 7; -- Niedziela
  END IF;
  
  -- Oblicz ile dni dodać do najbliższego wystąpienia p_weekday
  IF v_current_weekday <= p_weekday THEN
    -- Jeśli dzisiaj jest wcześniej lub tego samego dnia w tygodniu
    v_days_to_add := p_weekday - v_current_weekday;
  ELSE
    -- Jeśli dzisiaj jest później w tygodniu, przejdź do następnego tygodnia
    v_days_to_add := 7 - (v_current_weekday - p_weekday);
  END IF;
  
  -- Jeśli dzisiaj jest tym dniem i chcemy dzisiaj, zwróć dzisiaj
  -- W przeciwnym razie zwróć następne wystąpienie
  IF v_days_to_add = 0 THEN
    RETURN p_start_date;
  ELSE
    RETURN p_start_date + v_days_to_add;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Funkcja: generuje sesje dla pojedynczego booked_slot w określonym zakresie dat
CREATE OR REPLACE FUNCTION generate_sessions_for_booked_slot(
  p_booked_slot_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '3 months')
)
RETURNS INTEGER AS $$
DECLARE
  v_slot RECORD;
  v_assignment RECORD;
  v_current_date DATE;
  v_session_date TIMESTAMPTZ;
  v_duration_minutes INTEGER;
  v_sessions_created INTEGER := 0;
BEGIN
  -- Pobierz dane booked_slot
  SELECT 
    bs.id,
    bs.tutor_id,
    bs.student_assignment_id,
    bs.weekday,
    bs.start_time,
    bs.end_time,
    bs.status,
    bs.created_by
  INTO v_slot
  FROM booked_slots bs
  WHERE bs.id = p_booked_slot_id
    AND bs.status = 'booked';
  
  -- Sprawdź czy slot istnieje i jest aktywny
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Pobierz dane przypisania
  SELECT 
    sa.student_id,
    sa.status as assignment_status
  INTO v_assignment
  FROM student_assignments sa
  WHERE sa.id = v_slot.student_assignment_id;
  
  -- Sprawdź czy przypisanie jest aktywne
  IF NOT FOUND OR v_assignment.assignment_status != 'active' THEN
    RETURN 0;
  END IF;
  
  -- Oblicz czas trwania w minutach
  v_duration_minutes := EXTRACT(EPOCH FROM (v_slot.end_time::TIME - v_slot.start_time::TIME)) / 60;
  
  -- Znajdź pierwszy dzień tygodnia w zakresie
  v_current_date := get_next_weekday_date(v_slot.weekday, p_start_date);
  
  -- Generuj sesje dla każdego tygodnia w zakresie
  WHILE v_current_date <= p_end_date LOOP
    -- Utwórz datę sesji z czasem
    v_session_date := (v_current_date::DATE || ' ' || v_slot.start_time::TIME)::TIMESTAMPTZ;
    
    -- Sprawdź czy sesja już istnieje (unikalność: assignment_id + session_date)
    IF NOT EXISTS (
      SELECT 1 
      FROM tutoring_sessions 
      WHERE assignment_id = v_slot.student_assignment_id
        AND session_date = v_session_date
    ) THEN
      -- Utwórz sesję
      INSERT INTO tutoring_sessions (
        assignment_id,
        tutor_id,
        student_id,
        session_date,
        duration_minutes,
        notes,
        status,
        created_by
      ) VALUES (
        v_slot.student_assignment_id,
        v_slot.tutor_id,
        v_assignment.student_id,
        v_session_date,
        v_duration_minutes,
        NULL,
        'scheduled',
        v_slot.created_by
      );
      
      v_sessions_created := v_sessions_created + 1;
    END IF;
    
    -- Przejdź do następnego tygodnia
    v_current_date := v_current_date + INTERVAL '7 days';
  END LOOP;
  
  RETURN v_sessions_created;
END;
$$ LANGUAGE plpgsql;

-- Funkcja: generuje sesje dla wszystkich aktywnych booked_slots
CREATE OR REPLACE FUNCTION generate_sessions_for_all_booked_slots(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '3 months')
)
RETURNS INTEGER AS $$
DECLARE
  v_slot RECORD;
  v_total_sessions INTEGER := 0;
BEGIN
  -- Iteruj przez wszystkie aktywne booked_slots
  FOR v_slot IN 
    SELECT id 
    FROM booked_slots 
    WHERE status = 'booked'
  LOOP
    v_total_sessions := v_total_sessions + generate_sessions_for_booked_slot(
      v_slot.id,
      p_start_date,
      p_end_date
    );
  END LOOP;
  
  RETURN v_total_sessions;
END;
$$ LANGUAGE plpgsql;

-- Trigger: automatycznie generuje sesje przy tworzeniu booked_slot
CREATE OR REPLACE FUNCTION trigger_generate_sessions_on_booked_slot()
RETURNS TRIGGER AS $$
BEGIN
  -- Generuj sesje tylko dla nowych aktywnych booked_slots
  IF NEW.status = 'booked' THEN
    PERFORM generate_sessions_for_booked_slot(
      NEW.id,
      CURRENT_DATE,
      (CURRENT_DATE + INTERVAL '3 months')::DATE
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Utwórz trigger
DROP TRIGGER IF EXISTS trg_generate_sessions_on_booked_slot ON booked_slots;
CREATE TRIGGER trg_generate_sessions_on_booked_slot
  AFTER INSERT ON booked_slots
  FOR EACH ROW
  WHEN (NEW.status = 'booked')
  EXECUTE FUNCTION trigger_generate_sessions_on_booked_slot();

-- Funkcja: anuluje przyszłe sesje gdy booked_slot jest anulowany
CREATE OR REPLACE FUNCTION cancel_future_sessions_for_booked_slot(
  p_booked_slot_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_slot RECORD;
  v_cancelled_count INTEGER;
BEGIN
  -- Pobierz dane booked_slot
  SELECT 
    bs.student_assignment_id,
    bs.weekday,
    bs.start_time
  INTO v_slot
  FROM booked_slots bs
  WHERE bs.id = p_booked_slot_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Anuluj wszystkie przyszłe sesje dla tego przypisania, które pasują do weekday i start_time
  -- Konwersja weekday: nasz system 1-7 (Pn-Nd) → PostgreSQL DOW 0-6 (Nd-Sb)
  -- Porównujemy dzień tygodnia i czas rozpoczęcia
  UPDATE tutoring_sessions
  SET status = 'cancelled'
  WHERE assignment_id = v_slot.student_assignment_id
    AND session_date >= CURRENT_DATE
    AND status = 'scheduled'
    AND (
      EXTRACT(DOW FROM session_date) = CASE 
        WHEN v_slot.weekday = 7 THEN 0  -- Niedziela: 7 → 0
        ELSE v_slot.weekday             -- Pon-Sob: 1-6 → 1-6
      END
    )
    AND DATE_TRUNC('minute', session_date::TIME) = DATE_TRUNC('minute', v_slot.start_time::TIME);
  
  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;
  
  RETURN v_cancelled_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger: anuluje przyszłe sesje gdy booked_slot jest anulowany
CREATE OR REPLACE FUNCTION trigger_cancel_sessions_on_booked_slot_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  -- Anuluj sesje tylko gdy status zmienia się z 'booked' na 'cancelled'
  IF OLD.status = 'booked' AND NEW.status = 'cancelled' THEN
    PERFORM cancel_future_sessions_for_booked_slot(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Utwórz trigger
DROP TRIGGER IF EXISTS trg_cancel_sessions_on_booked_slot_cancelled ON booked_slots;
CREATE TRIGGER trg_cancel_sessions_on_booked_slot_cancelled
  AFTER UPDATE ON booked_slots
  FOR EACH ROW
  WHEN (OLD.status = 'booked' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION trigger_cancel_sessions_on_booked_slot_cancelled();

-- Komentarze
COMMENT ON FUNCTION generate_sessions_for_booked_slot IS 'Generuje sesje dla pojedynczego booked_slot w określonym zakresie dat';
COMMENT ON FUNCTION generate_sessions_for_all_booked_slots IS 'Generuje sesje dla wszystkich aktywnych booked_slots';
COMMENT ON FUNCTION cancel_future_sessions_for_booked_slot IS 'Anuluje przyszłe sesje dla anulowanego booked_slot';

