-- booked_slots: cykliczne rezerwacje tygodniowe powiązane z aktywnym przypisaniem ucznia do tutora

create table if not exists public.booked_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_assignment_id uuid not null references public.student_assignments(id) on delete restrict,
  -- 1 = Monday ... 7 = Sunday (zgodne z DayOfWeek w aplikacji)
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  status text not null default 'booked' check (status in ('booked','cancelled')),
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- porządkowe
create index if not exists idx_booked_slots_tutor_weekday_time on public.booked_slots (tutor_id, weekday, start_time);
create index if not exists idx_booked_slots_assignment on public.booked_slots (student_assignment_id);

-- brak nieprawidłowych zakresów czasu
alter table public.booked_slots
  add constraint booked_slots_time_range check (start_time < end_time);

-- unikalność aktywnych rezerwacji dla tego samego tutora, dnia i przedziału
create unique index if not exists uq_booked_slots_active
on public.booked_slots (tutor_id, weekday, start_time, end_time)
where status = 'booked';

-- trigger aktualizujący updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_booked_slots_set_updated_at on public.booked_slots;
create trigger trg_booked_slots_set_updated_at
before update on public.booked_slots
for each row execute function public.set_updated_at();

-- RLS
alter table public.booked_slots enable row level security;

-- Helper: sprawdzenie czy assignment jest aktywny i należy do tutora
create or replace function public.is_assignment_valid_for_tutor(p_assignment uuid, p_tutor uuid)
returns boolean as $$
  select exists(
    select 1 from public.student_assignments sa
    where sa.id = p_assignment
      and sa.tutor_id = p_tutor
      and sa.status = 'active'
  );
$$ language sql stable;

-- Polityki
-- Admin pełny dostęp, Tutor ograniczony do własnych rezerwacji

-- Zakładamy, że role są w tabeli profiles.role ('admin'|'tutor') i auth.uid() = profiles.id

create or replace function public.is_admin(p_user uuid)
returns boolean as $$
  select exists(
    select 1 from public.profiles p where p.id = p_user and p.role = 'admin'
  );
$$ language sql stable;

-- SELECT
drop policy if exists booked_slots_select on public.booked_slots;
create policy booked_slots_select on public.booked_slots
for select using (
  public.is_admin(auth.uid()) or tutor_id = auth.uid()
);

-- INSERT
drop policy if exists booked_slots_insert on public.booked_slots;
create policy booked_slots_insert on public.booked_slots
for insert with check (
  -- admin może wstawić dowolnie, tutor tylko własne i z poprawnym assignmentem
  public.is_admin(auth.uid()) or (
    tutor_id = auth.uid() and public.is_assignment_valid_for_tutor(student_assignment_id, auth.uid())
  )
);

-- UPDATE (np. zmiana statusu na cancelled)
drop policy if exists booked_slots_update on public.booked_slots;
create policy booked_slots_update on public.booked_slots
for update using (
  public.is_admin(auth.uid()) or tutor_id = auth.uid()
) with check (
  public.is_admin(auth.uid()) or tutor_id = auth.uid()
);

-- DELETE (opcjonalnie blokujemy i używamy status=cancelled)
drop policy if exists booked_slots_delete on public.booked_slots;
create policy booked_slots_delete on public.booked_slots
for delete using (
  public.is_admin(auth.uid()) or tutor_id = auth.uid()
);

comment on table public.booked_slots is 'Cykliczne rezerwacje (tygodniowe) slotów przez tutorów/admina';
comment on column public.booked_slots.weekday is '1=Monday ... 7=Sunday';


