-- Migration 010: Tutor Availability Calendar System
-- System kalendarza dostępności tutorów z godzinowymi slotami

-- Tabela przechowująca szablony tygodniowe dostępności tutorów
CREATE TABLE tutor_availability_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tutor_id, version)
);

-- Tabela przechowująca poszczególne godzinowe sloty dostępności
CREATE TABLE tutor_availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES tutor_availability_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Pn, 7=Nd
  start_time TIME NOT NULL CHECK (start_time >= TIME '08:00'),
  end_time TIME NOT NULL CHECK (end_time <= TIME '21:00'),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, day_of_week, start_time),
  CHECK (end_time = start_time + INTERVAL '1 hour')
);

-- Indeksy dla wydajności
CREATE INDEX idx_availability_templates_tutor_id ON tutor_availability_templates(tutor_id);
CREATE INDEX idx_availability_templates_active ON tutor_availability_templates(tutor_id, is_active) WHERE is_active = true;
CREATE INDEX idx_availability_slots_template_id ON tutor_availability_slots(template_id);
CREATE INDEX idx_availability_slots_day_time ON tutor_availability_slots(day_of_week, start_time);

-- Trigger dla updated_at
CREATE TRIGGER update_availability_templates_updated_at 
  BEFORE UPDATE ON tutor_availability_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE tutor_availability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_availability_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies dla tutor_availability_templates

-- Tutorzy mogą widzieć własne szablony
CREATE POLICY "Tutors can view own templates" ON tutor_availability_templates
  FOR SELECT USING (
    tutor_id = auth.uid()
  );

-- Admini mogą widzieć wszystkie szablony
CREATE POLICY "Admins can view all templates" ON tutor_availability_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tutorzy mogą tworzyć własne szablony
CREATE POLICY "Tutors can create own templates" ON tutor_availability_templates
  FOR INSERT WITH CHECK (
    tutor_id = auth.uid()
  );

-- Tutorzy mogą aktualizować własne szablony
CREATE POLICY "Tutors can update own templates" ON tutor_availability_templates
  FOR UPDATE USING (
    tutor_id = auth.uid()
  );

-- RLS Policies dla tutor_availability_slots

-- Tutorzy mogą widzieć sloty swoich szablonów
CREATE POLICY "Tutors can view own slots" ON tutor_availability_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tutor_availability_templates 
      WHERE id = tutor_availability_slots.template_id 
      AND tutor_id = auth.uid()
    )
  );

-- Admini mogą widzieć wszystkie sloty
CREATE POLICY "Admins can view all slots" ON tutor_availability_slots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tutorzy mogą tworzyć sloty dla swoich szablonów
CREATE POLICY "Tutors can create own slots" ON tutor_availability_slots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tutor_availability_templates 
      WHERE id = tutor_availability_slots.template_id 
      AND tutor_id = auth.uid()
    )
  );

-- Tutorzy mogą usuwać sloty swoich szablonów
CREATE POLICY "Tutors can delete own slots" ON tutor_availability_slots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tutor_availability_templates 
      WHERE id = tutor_availability_slots.template_id 
      AND tutor_id = auth.uid()
    )
  );

-- Funkcja pomocnicza do dezaktywacji starych szablonów przy tworzeniu nowego
CREATE OR REPLACE FUNCTION deactivate_old_templates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE tutor_availability_templates
    SET is_active = false
    WHERE tutor_id = NEW.tutor_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger do automatycznej dezaktywacji starych szablonów
CREATE TRIGGER trigger_deactivate_old_templates
  AFTER INSERT OR UPDATE OF is_active ON tutor_availability_templates
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION deactivate_old_templates();

