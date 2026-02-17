import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { getTutorSubjectLevels } from "@/lib/actions/tutor"
import { getDefaultStudentRateForLevel } from "../stawki/actions"
import { StudentsTable } from "./students-table"

interface Parent {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  parent_type: string
}

interface SubjectLevel {
  id: string
  level_name: string
  level_order: number
  price_per_hour: number
}

interface Subject {
  id: string
  name: string
  subject_levels: SubjectLevel[]
}

interface TutorSubjectLevel {
  subject_level_id: string
  subjects: { id: string; name: string } | null
  subject_levels: { id: string; level_name: string } | null
}

interface StudentParent {
  id: string
  is_primary: boolean
  parents: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    parent_type: string
  }
}

interface StudentNote {
  id: string
  content: string
  created_at: string
  profiles: {
    id: string
    full_name: string
  }
}

interface StudentSubject {
  subject_level_id: string
  subjects: { name: string } | null
  subject_levels: { level_name: string } | null
}

interface StudentAssignment {
  id: string
  tutor_id: string
  status: string
  profiles?: {
    id: string
    full_name: string
  } | null
}

interface StudentWithRelations {
  id: string
  first_name: string
  last_name: string
  parent_email: string
  parent_phone: string | null
  notes: string | null
  hourly_rate: number | null
  rate_level: number
  hourly_rate_is_overridden: boolean
  created_at: string
  updated_at: string
  student_parents?: StudentParent[]
  student_notes?: StudentNote[]
  student_subjects?: StudentSubject[]
  student_assignments?: StudentAssignment[]
}

export default async function StudentsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile) {
    return null
  }

  const isAdmin = profile.role === 'admin'
  const isTutor = profile.role === 'tutor'

  let students: StudentWithRelations[] = []

  if (isAdmin) {
    const { data } = await supabase
      .from('students')
      .select(`
        *,
        student_parents (
          id,
          is_primary,
          parents (
            id,
            first_name,
            last_name,
            email,
            phone,
            parent_type
          )
        ),
        student_notes (
          id,
          content,
          created_at,
          profiles (
            id,
            full_name
          )
        ),
        student_subjects (
          subject_level_id,
          subjects (
            name,
            color
          ),
          subject_levels (
            level_name
          )
        ),
        student_assignments (
          id,
          tutor_id,
          status,
          profiles!student_assignments_tutor_id_fkey (
            id,
            full_name
          )
        )
      `)
      .order('created_at', { ascending: false })

    students = data || []
  } else if (isTutor) {
    // Tutorzy widzą tylko swoich uczniów
    const { data } = await supabase
      .from('students')
      .select(`
        *,
        student_assignments!inner(
          tutor_id,
          status
        ),
        student_parents (
          id,
          is_primary,
          parents (
            id,
            first_name,
            last_name,
            email,
            phone,
            parent_type
          )
        ),
        student_notes (
          id,
          content,
          created_at,
          profiles (
            id,
            full_name
          )
        ),
        student_subjects (
          subject_level_id,
          subjects (
            name,
            color
          ),
          subject_levels (
            level_name
          )
        )
      `)
      .eq('student_assignments.tutor_id', profile.id)
      .eq('student_assignments.status', 'active')
      .order('created_at', { ascending: false })

    students = data || []
  }

  // Get default student rate from system settings (needed for mergeDuplicateStudents)
  const [rate1, rate2, rate3] = await Promise.all([
    getDefaultStudentRateForLevel(1),
    getDefaultStudentRateForLevel(2),
    getDefaultStudentRateForLevel(3),
  ])
  const defaultStudentRate = rate1
  const defaultStudentRatesByLevel = { 1: rate1, 2: rate2, 3: rate3 } as const

  // Łączenie duplikatów uczniów (tych samych imię i nazwisko, ale różne student_id)
  const mergeDuplicateStudents = (studentsList: StudentWithRelations[], defaultRate: number): StudentWithRelations[] => {
    // Tworzymy mapę po znormalizowanym imieniu i nazwisku
    const normalizedNameMap = new Map<string, StudentWithRelations[]>()
    
    for (const student of studentsList) {
      const normalizedName = `${student.first_name?.trim().toLowerCase() || ''} ${student.last_name?.trim().toLowerCase() || ''}`
      if (!normalizedNameMap.has(normalizedName)) {
        normalizedNameMap.set(normalizedName, [])
      }
      normalizedNameMap.get(normalizedName)!.push(student)
    }
    
    // Łączymy duplikaty
    const mergedStudents: StudentWithRelations[] = []
    
    for (const [, duplicates] of normalizedNameMap.entries()) {
      if (duplicates.length === 1) {
        // Brak duplikatów, dodajemy jak jest
        mergedStudents.push(duplicates[0])
      } else {
        // Znaleziono duplikaty - łączymy je
        // Sortujemy po dacie utworzenia (najstarszy pierwszy) - użyjemy go jako głównego
        duplicates.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime()
          const dateB = new Date(b.created_at || 0).getTime()
          return dateA - dateB
        })
        
        const firstStudent = duplicates[0]
        
        // Łączymy rodziców (bez duplikatów)
        const allParentsMap = new Map<string, StudentParent>()
        for (const student of duplicates) {
          if (student.student_parents && Array.isArray(student.student_parents)) {
            for (const sp of student.student_parents) {
              if (sp.parents && sp.parents.id) {
                allParentsMap.set(sp.parents.id, sp)
              }
            }
          }
        }
        const mergedParents = Array.from(allParentsMap.values())
        
        // Łączymy notatki (wszystkie)
        const allNotes: StudentNote[] = []
        for (const student of duplicates) {
          if (student.student_notes && Array.isArray(student.student_notes)) {
            allNotes.push(...student.student_notes)
          }
        }
        // Sortujemy notatki po dacie (najnowsze pierwsze)
        allNotes.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime()
          const dateB = new Date(b.created_at || 0).getTime()
          return dateB - dateA
        })
        
        // Łączymy przedmioty (bez duplikatów)
        const allSubjectsMap = new Map<string, StudentSubject>()
        for (const student of duplicates) {
          if (student.student_subjects && Array.isArray(student.student_subjects)) {
            for (const ss of student.student_subjects) {
              if (ss.subject_level_id) {
                allSubjectsMap.set(ss.subject_level_id, ss)
              }
            }
          }
        }
        const mergedSubjects = Array.from(allSubjectsMap.values())
        
        // Łączymy przypisania (bez duplikatów - po id przypisania)
        const allAssignmentsMap = new Map<string, StudentAssignment>()
        for (const student of duplicates) {
          if (student.student_assignments && Array.isArray(student.student_assignments)) {
            for (const sa of student.student_assignments) {
              if (sa.id) {
                allAssignmentsMap.set(sa.id, sa)
              }
            }
          }
        }
        const mergedAssignments = Array.from(allAssignmentsMap.values())
        
        // Wybieramy najwyższą stawkę godzinową (używamy defaultRate jako fallback)
        const maxHourlyRate = Math.max(
          ...duplicates.map(s => {
            const rate = parseFloat(s.hourly_rate?.toString() || '0')
            return rate > 0 ? rate : defaultRate
          })
        )
        
        // Wybieramy najnowszą datę aktualizacji
        const latestUpdatedAt = duplicates.reduce((latest, student) => {
          const studentDate = new Date(student.updated_at || 0).getTime()
          const latestDate = new Date(latest || 0).getTime()
          return studentDate > latestDate ? student.updated_at : latest
        }, duplicates[0].updated_at)
        
        // Tworzymy połączony rekord
        mergedStudents.push({
          ...firstStudent,
          id: firstStudent.id, // Używamy ID pierwszego (najstarszego) rekordu
          hourly_rate: maxHourlyRate,
          // Jeśli scaliliśmy duplikaty i wybraliśmy max stawkę, traktujemy to jako override,
          // żeby nie nadpisać tej wartości automatycznie stawką z poziomu przy edycji.
          hourly_rate_is_overridden: true,
          updated_at: latestUpdatedAt,
          student_parents: mergedParents,
          student_notes: allNotes,
          student_subjects: mergedSubjects,
          student_assignments: mergedAssignments,
        })
      }
    }
    
    return mergedStudents
  }
  
  // Łączymy duplikaty przed przekazaniem do tabeli
  students = mergeDuplicateStudents(students, defaultStudentRate)

  // Get all parents and subjects for dialog
  let allParents: Parent[] = []
  let allSubjects: Subject[] = []
  let tutorSubjectLevels: TutorSubjectLevel[] = []

  if (isAdmin) {
    const [parentsData, subjectsData] = await Promise.all([
      supabase.from('parents').select('*').order('last_name'),
      supabase.from('subjects').select(`
        id,
        name,
        color,
        subject_levels (
          id,
          level_name,
          level_order,
          price_per_hour
        )
      `).order('name'),
    ])

    allParents = (parentsData.data as unknown as Parent[]) || []
    allSubjects = (subjectsData.data as unknown as Subject[]) || []
  } else if (isTutor) {
    tutorSubjectLevels = (await getTutorSubjectLevels(profile.id)) as unknown as TutorSubjectLevel[]
  }

  return (
    <div className="space-y-4">
      <StudentsTable
        students={students}
        isAdmin={isAdmin}
        isTutor={isTutor}
        allParents={allParents}
        allSubjects={allSubjects}
        tutorId={profile.id}
        defaultStudentRate={defaultStudentRate}
        defaultStudentRatesByLevel={defaultStudentRatesByLevel}
        tutorSubjectLevels={tutorSubjectLevels}
        currentUserId={profile.id}
      />
    </div>
  )
}

