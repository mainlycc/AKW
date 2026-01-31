'use server'

import { createClient } from '@/lib/supabase/server'

export type BillingStatus = 'paid' | 'partially_paid' | 'unpaid'

export interface BillingPeriod {
  id: string
  month: number
  year: number
  created_at: string
}

export interface StudentBilling {
  id: string
  student_id: string
  billing_period_id: string
  total_due: number
  total_paid: number
  balance: number
  status: BillingStatus
  students: {
    id: string
    first_name: string
    last_name: string
  }
  billing_periods: {
    id: string
    month: number
    year: number
  }
}

export interface StudentBillingWithParent extends StudentBilling {
  parent?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }
  parents?: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }>
  category?: {
    subject_name: string
    level_name: string
  }
  categories?: Array<{
    subject_name: string
    level_name: string
  }>
  tutors?: Array<{
    id: string
    full_name: string
  }>
  hours_this_month: number
  total_hours: number
  hours?: number // For declarations billing
}

/**
 * Calculate monthly billing for a student based on completed sessions
 */
/**
 * Retry function with exponential backoff for rate limit errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isRateLimit = 
        (error as { status?: number; code?: string }).status === 429 ||
        (error as { code?: string }).code === 'over_request_rate_limit'
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(2, attempt)
        console.log(`Rate limit hit, retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await delay(delayMs)
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

export async function calculateMonthlyBilling(
  studentId: string,
  month: number,
  year: number
): Promise<string> {
  const supabase = await createClient()

  try {
    const result = await retryWithBackoff(async () => {
      const { data, error } = await supabase.rpc('calculate_student_billing', {
        p_student_id: studentId,
        p_month: month,
        p_year: year,
      })

      if (error) {
        // If it's not a rate limit error, throw immediately
        if (error.code !== 'over_request_rate_limit') {
          throw error
        }
        // For rate limit, throw to trigger retry
        throw { ...error, code: error.code || 'over_request_rate_limit' }
      }

      return data || ''
    })

    return result
  } catch (error) {
    const isRateLimit = 
      (error as { status?: number; code?: string }).status === 429 ||
      (error as { code?: string }).code === 'over_request_rate_limit'
    
    if (isRateLimit) {
      console.error('Rate limit exceeded after retries, using manual calculation:', error)
    } else {
      console.error('RPC call failed, using manual calculation:', error)
    }
    // Fallback: calculate manually
    return await calculateBillingManually(studentId, month, year)
  }
}

/**
 * Manual calculation fallback if RPC function is not available
 */
async function calculateBillingManually(
  studentId: string,
  month: number,
  year: number
): Promise<string> {
  const supabase = await createClient()

  // Get or create billing period
  const { data: period, error: periodFetchError } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (periodFetchError) {
    throw new Error(`Failed to fetch billing period: ${periodFetchError.message}`)
  }

  let periodId: string
  if (period) {
    periodId = period.id
  } else {
    const { data: newPeriod, error: periodError } = await supabase
      .from('billing_periods')
      .insert({ month, year })
      .select('id')
      .single()

    if (periodError || !newPeriod) {
      throw new Error(`Failed to create billing period: ${periodError?.message}`)
    }
    periodId = newPeriod.id
  }

  // Get student hourly rate
  const { data: student } = await supabase
    .from('students')
    .select('hourly_rate')
    .eq('id', studentId)
    .single()

  // Get default rate from system_settings if student doesn't have one
  let defaultRate = 50.00 // fallback
  if (!student?.hourly_rate) {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'default_student_rate')
      .maybeSingle()
    
    if (setting?.value) {
      const parsedRate = parseFloat(setting.value)
      if (!isNaN(parsedRate)) {
        defaultRate = parsedRate
      }
    }
  }

  const hourlyRate = student?.hourly_rate ? parseFloat(student.hourly_rate.toString()) : defaultRate

  // Calculate total due from completed sessions
  const { data: sessions } = await supabase
    .from('tutoring_sessions')
    .select('duration_minutes')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .gte('session_date', `${year}-${String(month).padStart(2, '0')}-01`)
    .lt('session_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)

  let totalDue = 0
  if (sessions) {
    for (const session of sessions) {
      if (session.duration_minutes) {
        totalDue += (session.duration_minutes / 60) * hourlyRate
      }
    }
  }

  // Calculate total paid
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('student_id', studentId)
    .eq('billing_period_id', periodId)

  const totalPaid =
    payments?.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0

  const balance = totalDue - totalPaid
  let status: 'paid' | 'partially_paid' | 'unpaid' = 'unpaid'
  // If no sessions (totalDue = 0), status should be 'unpaid'
  if (totalDue === 0) {
    status = 'unpaid'
  } else if (balance <= 0) {
    status = 'paid'
  } else if (totalPaid > 0) {
    status = 'partially_paid'
  }

  // Insert or update student billing
  const { data: billing, error: billingError } = await supabase
    .from('student_billings')
    .upsert(
      {
        student_id: studentId,
        billing_period_id: periodId,
        total_due: totalDue,
        total_paid: totalPaid,
        balance: balance,
        status: status,
      },
      {
        onConflict: 'student_id,billing_period_id',
      }
    )
    .select('id')
    .single()

  if (billingError || !billing) {
    throw new Error(`Failed to save billing: ${billingError?.message}`)
  }

  return billing.id
}

/**
 * Get or create billing period
 */
export async function getBillingPeriods(): Promise<BillingPeriod[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('billing_periods')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch billing periods: ${error.message}`)
  }

  return data || []
}

/**
 * Get student billings for a specific period
 */
export async function getStudentBillings(
  month: number,
  year: number
): Promise<StudentBillingWithParent[]> {
  const supabase = await createClient()

  // Get billing period
  const { data: period } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .single()

  if (!period) {
    // Period doesn't exist yet, return empty array
    return []
  }

  // Get all students with their billings
  const { data: billings, error } = await supabase
    .from('student_billings')
    .select(
      `
      *,
      students (
        id,
        first_name,
        last_name
      ),
      billing_periods (
        id,
        month,
        year
      )
    `
    )
    .eq('billing_period_id', period.id)
    .order('students(last_name)', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch student billings: ${error.message}`)
  }

  // Get parent information for all students in one query to avoid rate limits
  const studentIds = (billings || []).map((b) => (b as StudentBilling).student_id)
  
  if (studentIds.length === 0) {
    return []
  }

  // Get all parents, ordered by is_primary DESC so primary parents come first
  const { data: allParentData } = await supabase
    .from('student_parents')
    .select(
      `
      student_id,
      is_primary,
      parents (
        id,
        first_name,
        last_name,
        email,
        phone
      )
    `
    )
    .in('student_id', studentIds)
    .order('is_primary', { ascending: false }) // Primary parents first

  // Create a map of student_id -> parent for quick lookup
  // Prefer primary parents, but use first available if no primary
  type ParentDataItem = {
    student_id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    } | {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    }[] | null
  }

  const parentMap = new Map<string, ParentDataItem>()
  if (allParentData) {
    for (const item of allParentData) {
      if (item.student_id) {
        const existing = parentMap.get(item.student_id)
        // If no parent yet, or if this is primary and existing is not, use this one
        if (!existing || (item.is_primary && !existing.is_primary)) {
          parentMap.set(item.student_id, item as ParentDataItem)
        }
      }
    }
  }

  // Get active assignments to get all tutors (even if they don't have completed sessions yet)
  const { data: assignmentsData } = await supabase
    .from('student_assignments')
    .select(
      `
      student_id,
      tutor_id,
      status,
      profiles!student_assignments_tutor_id_fkey (
        id,
        full_name
      ),
      subjects (
        id,
        name
      ),
      subject_levels (
        id,
        level_name
      )
    `
    )
    .in('student_id', studentIds)
    .eq('status', 'active')

  // Get sessions data for all students to calculate hours and get tutor/category info
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12 
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data: sessionsData } = await supabase
    .from('tutoring_sessions')
    .select(
      `
      student_id,
      tutor_id,
      session_date,
      duration_minutes,
      status,
      student_assignments!inner (
        subject_id,
        subject_level_id,
        subjects!inner (
          name
        ),
        subject_levels!inner (
          level_name
        )
      ),
      profiles!tutoring_sessions_tutor_id_fkey (
        id,
        full_name
      )
    `
    )
    .in('student_id', studentIds)
    .eq('status', 'completed')

  // Create maps for quick lookup
  const hoursThisMonthMap = new Map<string, number>()
  const totalHoursMap = new Map<string, number>()
  const tutorMap = new Map<string, Map<string, string>>() // Store tutor ID -> tutor name mapping
  const categoryMap = new Map<string, Set<string>>() // Store unique categories

  // First, collect tutors and categories from active assignments (like in students table)
  if (assignmentsData) {
    for (const assignment of assignmentsData) {
      const studentId = assignment.student_id
      
      // Collect tutors
      if (assignment.tutor_id && assignment.profiles) {
        const tutor = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles
        if (tutor && tutor.id && tutor.full_name) {
          if (!tutorMap.has(studentId)) {
            tutorMap.set(studentId, new Map())
          }
          tutorMap.get(studentId)!.set(tutor.id, tutor.full_name)
        }
      }
      
      // Collect categories from active assignments
      if (assignment.subjects && assignment.subject_levels) {
        const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects
        const level = Array.isArray(assignment.subject_levels) ? assignment.subject_levels[0] : assignment.subject_levels
        
        if (subject?.name && level?.level_name) {
          if (!categoryMap.has(studentId)) {
            categoryMap.set(studentId, new Set())
          }
          categoryMap.get(studentId)!.add(`${subject.name} - ${level.level_name}`)
        }
      }
    }
  }

  // Then, process sessions to calculate hours and also add tutors from sessions
  if (sessionsData) {
    for (const session of sessionsData) {
      const studentId = session.student_id
      const hours = (session.duration_minutes || 0) / 60
      const sessionDate = new Date(session.session_date || '')
      const isThisMonth = sessionDate >= new Date(startDate) && sessionDate < new Date(endDate)

      // Calculate hours this month - sum all hours from all tutors
      if (isThisMonth) {
        const current = hoursThisMonthMap.get(studentId) || 0
        hoursThisMonthMap.set(studentId, current + hours)
      }

      // Calculate total hours - sum all hours from all tutors
      const totalCurrent = totalHoursMap.get(studentId) || 0
      totalHoursMap.set(studentId, totalCurrent + hours)

      // Collect tutors from sessions (in case they're not in active assignments)
      if (session.tutor_id && session.profiles) {
        const tutor = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles
        if (tutor && tutor.id && tutor.full_name) {
          if (!tutorMap.has(studentId)) {
            tutorMap.set(studentId, new Map())
          }
          tutorMap.get(studentId)!.set(tutor.id, tutor.full_name)
        }
      }

      // Collect all categories for this student
      if (session.student_assignments) {
        const assignment = Array.isArray(session.student_assignments) 
          ? session.student_assignments[0] 
          : session.student_assignments
        
        if (assignment?.subjects && assignment?.subject_levels) {
          const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects
          const level = Array.isArray(assignment.subject_levels) ? assignment.subject_levels[0] : assignment.subject_levels
          
          if (subject?.name && level?.level_name) {
            if (!categoryMap.has(studentId)) {
              categoryMap.set(studentId, new Set())
            }
            categoryMap.get(studentId)!.add(`${subject.name} - ${level.level_name}`)
          }
        }
      }
    }
  }

  // Convert tutor maps to display format - collect all tutors with their IDs
  const tutorDisplayMap = new Map<string, Array<{ id: string; full_name: string }>>()
  for (const [studentId, tutorIdNameMap] of tutorMap.entries()) {
    const tutorsList: Array<{ id: string; full_name: string }> = []
    
    // Convert map to array
    for (const [tutorId, tutorName] of tutorIdNameMap.entries()) {
      tutorsList.push({
        id: tutorId,
        full_name: tutorName
      })
    }
    
    // Sort by name for consistency
    tutorsList.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl', { sensitivity: 'base' }))
    
    tutorDisplayMap.set(studentId, tutorsList)
  }

  // Convert category sets to display format
  const categoryDisplayMap = new Map<string, { subject_name: string; level_name: string }>()
  for (const [studentId, categories] of categoryMap.entries()) {
    const categoriesArray = Array.from(categories)
    if (categoriesArray.length === 1) {
      // Single category
      const [subjectName, levelName] = categoriesArray[0].split(' - ')
      categoryDisplayMap.set(studentId, {
        subject_name: subjectName,
        level_name: levelName
      })
    } else {
      // Multiple categories - show "Wiele przedmiotów (X)"
      categoryDisplayMap.set(studentId, {
        subject_name: `Wiele przedmiotów (${categoriesArray.length})`,
        level_name: ''
      })
    }
  }

  // Combine billings with parent, tutor, category, and hours information
  const billingsWithParents: StudentBillingWithParent[] = []

  for (const billing of billings || []) {
    const studentBilling = billing as StudentBilling
    const parentItem = parentMap.get(studentBilling.student_id)
    
    const parent = parentItem?.parents
      ? (Array.isArray(parentItem.parents)
          ? parentItem.parents[0]
          : parentItem.parents)
      : undefined

    billingsWithParents.push({
      ...studentBilling,
      parent: parent
        ? {
            id: parent.id,
            first_name: parent.first_name,
            last_name: parent.last_name,
            email: parent.email,
            phone: parent.phone,
          }
        : undefined,
      category: categoryDisplayMap.get(studentBilling.student_id),
      tutors: tutorDisplayMap.get(studentBilling.student_id) || [],
      hours_this_month: hoursThisMonthMap.get(studentBilling.student_id) || 0,
      total_hours: totalHoursMap.get(studentBilling.student_id) || 0,
    })
  }

  return billingsWithParents
}

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Recalculate all billings for a period
 */
export async function recalculateBillingsForPeriod(
  month: number,
  year: number
): Promise<void> {
  const supabase = await createClient()

  try {
    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')

    if (studentsError) {
      // Check for connection errors
      if (studentsError.message.includes('ECONNRESET') || 
          studentsError.message.includes('fetch failed') ||
          studentsError.code === 'PGRST301') {
        throw new Error('Błąd połączenia z bazą danych. Spróbuj ponownie za chwilę.')
      }
      throw new Error(
        `Failed to fetch students: ${studentsError.message}`
      )
    }

    if (!students || students.length === 0) {
      return
    }

    // Calculate billing for each student with delay to avoid rate limits
    for (let i = 0; i < students.length; i++) {
      const student = students[i]
      try {
        await calculateMonthlyBilling(student.id, month, year)
        // Add delay between requests to avoid rate limits (100ms delay)
        if (i < students.length - 1) {
          await delay(100)
        }
      } catch (error) {
        // Check for connection errors
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('ECONNRESET') || 
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('timeout')) {
          console.error(`Connection error for student ${student.id}, skipping...`)
          // Add longer delay on connection error
          await delay(500)
          continue
        }
        // Log error but continue with other students
        console.error(`Failed to calculate billing for student ${student.id}:`, error)
        // Add longer delay on error to avoid rate limits
        await delay(200)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('ECONNRESET') || 
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('timeout')) {
      throw new Error('Błąd połączenia z bazą danych. Spróbuj ponownie za chwilę.')
    }
    throw error
  }
}

/**
 * Get student billings calculated from tutor reports for a specific period
 */
export async function getStudentBillingsFromReports(
  month: number,
  year: number
): Promise<StudentBillingWithParent[]> {
  const supabase = await createClient()
  
  // Check user authentication and role for debugging
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()
    console.log('[getStudentBillingsFromReports] User auth check:', {
      userId: user.id,
      userEmail: user.email,
      profileRole: profile?.role,
      hasProfile: !!profile,
    })
  } else {
    console.warn('[getStudentBillingsFromReports] No authenticated user found!')
  }

  // Validate month and year
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Month must be between 1 and 12.`)
  }
  if (year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${year}. Year must be between 2000 and 2100.`)
  }

  // Get or create billing period
  const { data: period, error: periodFetchError } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (periodFetchError) {
    throw new Error(`Failed to fetch billing period: ${periodFetchError.message}`)
  }

  let periodId: string
  if (period) {
    periodId = period.id
  } else {
    const { data: newPeriod, error: periodError } = await supabase
      .from('billing_periods')
      .insert({ month, year })
      .select('id')
      .single()

    if (periodError || !newPeriod) {
      throw new Error(`Failed to create billing period: ${periodError?.message || 'Unknown error'}`)
    }
    periodId = newPeriod.id
  }

  // Get all approved reports for the month/year
  // NOTE: We do NOT include student_parents here - we'll fetch the latest parent data separately
  // This ensures we always show the most current parent assignments, not what was in the report
  const { data: reports, error: reportsError } = await supabase
    .from('monthly_reports')
    .select(`
      id,
      tutor_id,
      month,
      year,
      profiles!monthly_reports_tutor_id_fkey (
        id,
        full_name
      ),
      monthly_report_entries (
        id,
        student_id,
        hours,
        students (
          id,
          first_name,
          last_name,
          hourly_rate
        )
      )
    `)
    .eq('month', month)
    .eq('year', year)
    .in('status', ['approved', 'paid']) // Only approved or paid reports

  if (reportsError) {
    throw new Error(`Failed to fetch reports: ${reportsError.message}`)
  }

  if (!reports || reports.length === 0) {
    return []
  }

  // Group entries by student_id and sum hours
  const studentHoursMap = new Map<string, number>()
  const studentTutorsMap = new Map<string, Map<string, string>>() // student_id -> tutor_id -> tutor_name
  const studentDataMap = new Map<string, { 
    first_name: string
    last_name: string
    hourly_rate: number
  }>()

  for (const report of reports) {
    const tutor = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
    const tutorId = tutor?.id || ''
    const tutorName = tutor?.full_name || ''

    const entries = report.monthly_report_entries || []
    
    for (const entry of entries) {
      const studentId = entry.student_id
      const hours = parseFloat(entry.hours?.toString() || '0')
      
      // Sum hours for this student
      const currentHours = studentHoursMap.get(studentId) || 0
      studentHoursMap.set(studentId, currentHours + hours)

      // Collect tutors
      if (tutorId && tutorName) {
        if (!studentTutorsMap.has(studentId)) {
          studentTutorsMap.set(studentId, new Map())
        }
        studentTutorsMap.get(studentId)!.set(tutorId, tutorName)
      }

      // Store student data (from first entry, hourly_rate should be same for all)
      // NOTE: We do NOT store student_parents here - we'll fetch the latest parent data separately
      if (!studentDataMap.has(studentId)) {
        const student = Array.isArray(entry.students) ? entry.students[0] : entry.students
        // Get default rate from system_settings if student doesn't have one
        let defaultRate = 50.00 // fallback
        if (!student?.hourly_rate) {
          const { data: setting } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'default_student_rate')
            .maybeSingle()
          
          if (setting?.value) {
            const parsedRate = parseFloat(setting.value)
            if (!isNaN(parsedRate)) {
              defaultRate = parsedRate
            }
          }
        }
        
        const hourlyRate = student?.hourly_rate 
          ? parseFloat(student.hourly_rate.toString()) 
          : defaultRate
        
        studentDataMap.set(studentId, {
          first_name: student?.first_name || '',
          last_name: student?.last_name || '',
          hourly_rate: hourlyRate,
        })
      }
    }
  }

  const studentIds = Array.from(studentHoursMap.keys())
  
  if (studentIds.length === 0) {
    return []
  }

  // Get parents - Use EXACT same approach as getStudentBillings (line 321-337)
  // Copy EXACTLY the same code that works in getStudentBillings
  console.log('[getStudentBillingsFromReports] About to query student_parents (EXACT copy of getStudentBillings):', {
    studentIdsCount: studentIds.length,
    firstFewIds: studentIds.slice(0, 5),
    blankaId: 'f720ee5e-9876-4234-bd48-00efb04c16b5',
    blankaInList: studentIds.includes('f720ee5e-9876-4234-bd48-00efb04c16b5'),
  })
  
  // Split into batches of 100 (Supabase limit for .in())
  const BATCH_SIZE = 100
  type ParentDataEntry = {
    id: string
    student_id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    } | null
  }
  
  const allParentData: ParentDataEntry[] = []
  
  for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
    const batch = studentIds.slice(i, i + BATCH_SIZE)
    console.log(`[getStudentBillingsFromReports] Querying batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} student IDs`)
    
    const { data: batchData, error: parentQueryError } = await supabase
      .from('student_parents')
      .select(
        `
        id,
        student_id,
        is_primary,
        parents (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `
      )
      .in('student_id', batch)
      .order('is_primary', { ascending: false }) // Primary parents first

    if (parentQueryError) {
      console.error(`[getStudentBillingsFromReports] Error fetching student_parents batch ${Math.floor(i / BATCH_SIZE) + 1}:`, {
        error: parentQueryError,
        errorCode: parentQueryError.code,
        errorMessage: parentQueryError.message,
        errorDetails: parentQueryError.details,
        errorHint: parentQueryError.hint,
        batchSize: batch.length,
        batchStart: i,
      })
    } else {
      if (batchData) {
        // Convert batchData to correct type - Supabase may return parents as array
        type SupabaseBatchItem = {
          id: string
          student_id: string
          is_primary: boolean
          parents: {
            id: string
            first_name: string
            last_name: string
            email: string
            phone: string | null
          } | {
            id: string
            first_name: string
            last_name: string
            email: string
            phone: string | null
          }[] | null
        }
        const convertedBatch: ParentDataEntry[] = batchData.map((item: SupabaseBatchItem) => ({
          id: item.id,
          student_id: item.student_id,
          is_primary: item.is_primary,
          parents: Array.isArray(item.parents) 
            ? (item.parents[0] || null)
            : item.parents || null
        }))
        allParentData.push(...convertedBatch)
        console.log(`[getStudentBillingsFromReports] Batch ${Math.floor(i / BATCH_SIZE) + 1} returned ${batchData.length} parent records`)
      }
    }
  }
  
  console.log(`[getStudentBillingsFromReports] Total parent records fetched: ${allParentData.length}`)

  console.log('[getStudentBillingsFromReports] Student_parents query result:', {
    allParentDataCount: allParentData?.length || 0,
    blankaKrykId: 'f720ee5e-9876-4234-bd48-00efb04c16b5',
    blankaKrykParents: allParentData?.filter(sp => sp.student_id === 'f720ee5e-9876-4234-bd48-00efb04c16b5') || [],
    blankaKrykParentsCount: allParentData?.filter(sp => sp.student_id === 'f720ee5e-9876-4234-bd48-00efb04c16b5').length || 0,
    sampleParents: allParentData?.slice(0, 5).map(sp => ({
      student_id: sp.student_id,
      is_primary: sp.is_primary,
      hasParent: !!sp.parents,
      parentName: sp.parents ? `${sp.parents.first_name} ${sp.parents.last_name}` : null,
      parentId: sp.parents?.id,
    })) || [],
  })

  // Process studentsWithParents - EXACT same logic as /uczniowie students-table.tsx line 378
  // const parents = student.student_parents || []
  // Then extract parents from student_parents array

  // Create parent maps - EXACT same logic as /uczniowie students-table.tsx
  // In students-table.tsx: const parents = student.student_parents || []
  // Then: parents.map(sp => sp.parents) to get all parents
  type ParentData = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }

  // Map for primary parent (for backward compatibility)
  const parentMap = new Map<string, ParentData>()
  // Map for all parents (for displaying all parents like in /uczniowie)
  const allParentsMap = new Map<string, ParentData[]>()
  
  // Process allParentData - Group by student_id (same approach as getStudentBillings)
  // Group by student_id
  const parentsByStudent = new Map<string, typeof allParentData>()
  for (const sp of allParentData) {
    if (!parentsByStudent.has(sp.student_id)) {
      parentsByStudent.set(sp.student_id, [])
    }
    parentsByStudent.get(sp.student_id)!.push(sp)
  }

  // Process each student's parents
  for (const [studentId, studentParents] of parentsByStudent.entries()) {
    console.log(`[getStudentBillingsFromReports] Processing student ${studentId}:`, {
      studentId,
      parentsCount: studentParents.length,
      parents: studentParents.map(sp => ({
        is_primary: sp.is_primary,
        hasParent: !!sp.parents,
        parentId: sp.parents?.id,
        parentName: sp.parents ? `${sp.parents.first_name} ${sp.parents.last_name}` : null,
      })),
    })

    // Extract all parents - upewnij się, że nie pomijamy żadnych rodziców
    const allParents: ParentData[] = []
    for (const sp of studentParents) {
      // Sprawdź czy sp.parents istnieje i ma id (podstawowa walidacja)
      if (sp.parents) {
        // Jeśli parents ma id, dodaj go - nawet jeśli inne pola są puste
        if (sp.parents.id) {
          allParents.push({
            id: sp.parents.id,
            first_name: sp.parents.first_name || '',
            last_name: sp.parents.last_name || '',
            email: sp.parents.email || '',
            phone: sp.parents.phone,
          })
        } else {
          // Loguj przypadki, gdy parents istnieje, ale nie ma id
          console.warn(`[getStudentBillingsFromReports] Parent without id for student ${studentId}:`, {
            studentId,
            hasParents: !!sp.parents,
            parentData: sp.parents,
          })
        }
      } else {
        // Loguj przypadki, gdy sp.parents jest null
        console.warn(`[getStudentBillingsFromReports] student_parents entry with null parents for student ${studentId}:`, {
          studentId,
          is_primary: sp.is_primary,
          student_parent_id: sp.id,
        })
      }
    }

    // Zawsze ustaw allParentsMap, nawet jeśli jest puste - to pozwoli na debugowanie
    allParentsMap.set(studentId, allParents)

    if (allParents.length > 0) {
      console.log(`[getStudentBillingsFromReports] Extracted parents for ${studentId}:`, {
        studentId,
        extractedCount: allParents.length,
        extractedParents: allParents.map(p => `${p.first_name} ${p.last_name}`),
      })

      // Find primary parent with email for backward compatibility
      // Najpierw szukaj głównego rodzica z emailem
      const primaryParentWithEmail = studentParents.find(
        sp => sp.is_primary && sp.parents && sp.parents.email && sp.parents.email.trim()
      )
      
      if (primaryParentWithEmail && primaryParentWithEmail.parents) {
        parentMap.set(studentId, {
          id: primaryParentWithEmail.parents.id,
          first_name: primaryParentWithEmail.parents.first_name || '',
          last_name: primaryParentWithEmail.parents.last_name || '',
          email: primaryParentWithEmail.parents.email || '',
          phone: primaryParentWithEmail.parents.phone,
        })
      } else {
        // Jeśli nie ma głównego z emailem, użyj pierwszego dostępnego rodzica z emailem
        const parentWithEmail = allParents.find(p => p.email && p.email.trim())
        if (parentWithEmail) {
          parentMap.set(studentId, parentWithEmail)
        } else if (allParents.length > 0) {
          // Ostateczny fallback - pierwszy dostępny rodzic (nawet bez emaila)
          parentMap.set(studentId, allParents[0])
        }
      }
    } else {
      console.log(`[getStudentBillingsFromReports] No valid parents extracted for student ${studentId}`, {
        studentId,
        studentParentsCount: studentParents.length,
        studentParentsWithNull: studentParents.filter(sp => !sp.parents).length,
        studentParentsWithId: studentParents.filter(sp => sp.parents && sp.parents.id).length,
      })
    }
  }
  
  // NOTE: We do NOT use studentDataMap as fallback for parents
  // We ONLY use the latest data from the separate query above
  // This ensures we always show current parent assignments, not what was in old reports

  console.log('[getStudentBillingsFromReports] Final parent maps:', {
    parentMapSize: parentMap.size,
    allParentsMapSize: allParentsMap.size,
    parentMapKeys: Array.from(parentMap.keys()),
    allParentsMapKeys: Array.from(allParentsMap.keys()),
    sampleEntries: Array.from(parentMap.entries()).slice(0, 3),
    sampleAllParentsEntries: Array.from(allParentsMap.entries()).slice(0, 3).map(([id, parents]) => ({
      studentId: id,
      parentsCount: parents.length,
      parents: parents.map(p => `${p.first_name} ${p.last_name}`),
    })),
  })

  // Get payments for the period
  const { data: payments } = await supabase
    .from('payments')
    .select('student_id, amount')
    .eq('billing_period_id', periodId)
    .in('student_id', studentIds)

  // Group payments by student_id
  const paymentsMap = new Map<string, number>()
  if (payments) {
    for (const payment of payments) {
      const current = paymentsMap.get(payment.student_id) || 0
      paymentsMap.set(payment.student_id, current + parseFloat(payment.amount.toString()))
    }
  }

  // Get active assignments to get categories (subjects)
  const { data: assignmentsData } = await supabase
    .from('student_assignments')
    .select(`
      student_id,
      subjects (
        id,
        name
      ),
      subject_levels (
        id,
        level_name
      )
    `)
    .in('student_id', studentIds)
    .eq('status', 'active')

  // Create category map
  const categoryMap = new Map<string, Set<string>>()
  if (assignmentsData) {
    for (const assignment of assignmentsData) {
      const studentId = assignment.student_id
      const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects
      const level = Array.isArray(assignment.subject_levels) ? assignment.subject_levels[0] : assignment.subject_levels
      
      if (subject?.name && level?.level_name) {
        if (!categoryMap.has(studentId)) {
          categoryMap.set(studentId, new Set())
        }
        categoryMap.get(studentId)!.add(`${subject.name} - ${level.level_name}`)
      }
    }
  }

  // Convert tutor maps to display format
  const tutorDisplayMap = new Map<string, Array<{ id: string; full_name: string }>>()
  for (const [studentId, tutorIdNameMap] of studentTutorsMap.entries()) {
    const tutorsList: Array<{ id: string; full_name: string }> = []
    for (const [tutorId, tutorName] of tutorIdNameMap.entries()) {
      tutorsList.push({ id: tutorId, full_name: tutorName })
    }
    tutorsList.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl', { sensitivity: 'base' }))
    tutorDisplayMap.set(studentId, tutorsList)
  }

  // Convert category sets to display format - zwracamy listę wszystkich przedmiotów
  const categoryDisplayMap = new Map<string, Array<{ subject_name: string; level_name: string }>>()
  for (const [studentId, categories] of categoryMap.entries()) {
    const categoriesArray = Array.from(categories)
    const categoriesList: Array<{ subject_name: string; level_name: string }> = []
    
    for (const categoryString of categoriesArray) {
      const [subjectName, levelName] = categoryString.split(' - ')
      categoriesList.push({
        subject_name: subjectName,
        level_name: levelName
      })
    }
    
    // Sortuj alfabetycznie po nazwie przedmiotu
    categoriesList.sort((a, b) => a.subject_name.localeCompare(b.subject_name, 'pl', { sensitivity: 'base' }))
    categoryDisplayMap.set(studentId, categoriesList)
  }

  // Build billings array
  const billingsWithParents: StudentBillingWithParent[] = []

  for (const studentId of studentIds) {
    const hours = studentHoursMap.get(studentId) || 0
    const studentData = studentDataMap.get(studentId)
    
    if (!studentData) {
      continue
    }

    const hourlyRate = studentData.hourly_rate
    const totalDue = hours * hourlyRate
    const totalPaid = paymentsMap.get(studentId) || 0
    const balance = totalDue - totalPaid

    let status: BillingStatus = 'unpaid'
    if (totalDue === 0) {
      status = 'unpaid'
    } else if (balance <= 0) {
      status = 'paid'
    } else if (totalPaid > 0) {
      status = 'partially_paid'
    }

    // Get parent from map (already processed to prefer primary) - for backward compatibility
    const parent = parentMap.get(studentId)
    // Get all parents - for displaying all parents like in /uczniowie
    const allParents = allParentsMap.get(studentId) || []

    // Create a temporary billing ID (we don't have actual student_billings record)
    // We'll use a combination of student_id and period_id
    const tempBillingId = `${studentId}-${periodId}`

    billingsWithParents.push({
      id: tempBillingId,
      student_id: studentId,
      billing_period_id: periodId,
      total_due: totalDue,
      total_paid: totalPaid,
      balance: balance,
      status: status,
      students: {
        id: studentId,
        first_name: studentData.first_name,
        last_name: studentData.last_name,
      },
      billing_periods: {
        id: periodId,
        month: month,
        year: year,
      },
      parent: parent
        ? {
            id: parent.id,
            first_name: parent.first_name,
            last_name: parent.last_name,
            email: parent.email,
            phone: parent.phone,
          }
        : undefined,
      // Zawsze zwracaj tablicę rodziców (nawet jeśli pusta) - to pozwoli na lepsze wyświetlanie w tabeli
      parents: allParents,
      categories: categoryDisplayMap.get(studentId) || [],
      tutors: tutorDisplayMap.get(studentId) || [],
      hours_this_month: hours,
      total_hours: hours, // For reports, this is the same as hours_this_month
    })
  }

  // Łączenie duplikatów uczniów (tych samych imię i nazwisko, ale różne student_id)
  // Tworzymy mapę po znormalizowanym imieniu i nazwisku
  const normalizedNameMap = new Map<string, StudentBillingWithParent[]>()
  
  for (const billing of billingsWithParents) {
    const normalizedName = `${billing.students.first_name.trim().toLowerCase()} ${billing.students.last_name.trim().toLowerCase()}`
    if (!normalizedNameMap.has(normalizedName)) {
      normalizedNameMap.set(normalizedName, [])
    }
    normalizedNameMap.get(normalizedName)!.push(billing)
  }
  
  // Łączymy duplikaty
  const mergedBillings: StudentBillingWithParent[] = []
  
  for (const [normalizedName, duplicates] of normalizedNameMap.entries()) {
    if (duplicates.length === 1) {
      // Brak duplikatów, dodajemy jak jest
      mergedBillings.push(duplicates[0])
    } else {
      // Znaleziono duplikaty - łączymy je
      const firstBilling = duplicates[0]
      
      // Sumujemy godziny
      const totalHours = duplicates.reduce((sum, b) => sum + b.hours_this_month, 0)
      
      // Sumujemy płatności
      const totalPaid = duplicates.reduce((sum, b) => sum + b.total_paid, 0)
      
      // Sumujemy należności
      const totalDue = duplicates.reduce((sum, b) => sum + b.total_due, 0)
      
      // Obliczamy saldo
      const balance = totalDue - totalPaid
      
      // Określamy status
      let status: BillingStatus = 'unpaid'
      if (totalDue === 0) {
        status = 'unpaid'
      } else if (balance <= 0) {
        status = 'paid'
      } else if (totalPaid > 0) {
        status = 'partially_paid'
      }
      
      // Łączymy tutorów (bez duplikatów)
      const allTutors = new Map<string, { id: string; full_name: string }>()
      for (const billing of duplicates) {
        if (billing.tutors) {
          for (const tutor of billing.tutors) {
            allTutors.set(tutor.id, tutor)
          }
        }
      }
      const mergedTutors = Array.from(allTutors.values()).sort((a, b) => 
        a.full_name.localeCompare(b.full_name, 'pl', { sensitivity: 'base' })
      )
      
      // Łączymy kategorie/przedmioty (bez duplikatów)
      const allCategories = new Map<string, { subject_name: string; level_name: string }>()
      for (const billing of duplicates) {
        if (billing.categories) {
          for (const category of billing.categories) {
            const categoryKey = `${category.subject_name} - ${category.level_name}`
            allCategories.set(categoryKey, category)
          }
        }
      }
      const mergedCategories = Array.from(allCategories.values()).sort((a, b) => 
        a.subject_name.localeCompare(b.subject_name, 'pl', { sensitivity: 'base' })
      )
      
      // Łączymy rodziców (bez duplikatów)
      const allParents = new Map<string, ParentData>()
      for (const billing of duplicates) {
        if (billing.parents) {
          for (const parent of billing.parents) {
            allParents.set(parent.id, parent)
          }
        }
        // Również sprawdzamy parent (dla kompatybilności wstecznej)
        if (billing.parent) {
          allParents.set(billing.parent.id, billing.parent)
        }
      }
      const mergedParents = Array.from(allParents.values())
      
      // Wybieramy głównego rodzica (pierwszy z email lub pierwszy dostępny)
      const primaryParent = mergedParents.find(p => p.email && p.email.trim()) || mergedParents[0]
      
      // Tworzymy połączony billing
      mergedBillings.push({
        ...firstBilling,
        id: `${firstBilling.student_id}-${periodId}-merged`, // Oznaczamy jako połączony
        total_due: totalDue,
        total_paid: totalPaid,
        balance: balance,
        status: status,
        tutors: mergedTutors,
        categories: mergedCategories,
        parents: mergedParents,
        parent: primaryParent,
        hours_this_month: totalHours,
        total_hours: totalHours,
      })
    }
  }
  
  // Sort by student last name
  mergedBillings.sort((a, b) => 
    a.students.last_name.localeCompare(b.students.last_name, 'pl', { sensitivity: 'base' })
  )

  // Debug logging - check final result
  console.log('[getStudentBillingsFromReports] Final billings result:', {
    totalBillings: mergedBillings.length,
    originalBillingsCount: billingsWithParents.length,
    billingsWithParentCount: mergedBillings.filter(b => b.parent).length,
    billingsWithAllParentsCount: mergedBillings.filter(b => b.parents && b.parents.length > 0).length,
    billingsWithoutParentCount: mergedBillings.filter(b => !b.parent && (!b.parents || b.parents.length === 0)).length,
    // Check specific student "Blanka Kryk" if present
    blankaKryk: mergedBillings.find(b => 
      b.students.first_name.toLowerCase().includes('blanka') && 
      b.students.last_name.toLowerCase().includes('kryk')
    ) ? {
      student: `${mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.students.first_name} ${mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.students.last_name}`,
      studentId: mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.student_id,
      hasParent: !!mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parent,
      parent: mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parent ? `${mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parent!.first_name} ${mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parent!.last_name}` : null,
      hasAllParents: !!(mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parents && mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parents!.length > 0),
      allParentsCount: mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parents?.length || 0,
      allParents: mergedBillings.find(b => 
        b.students.first_name.toLowerCase().includes('blanka') && 
        b.students.last_name.toLowerCase().includes('kryk')
      )!.parents?.map(p => `${p.first_name} ${p.last_name}`) || [],
    } : null,
    sampleBillings: mergedBillings.slice(0, 5).map(b => ({
      student: `${b.students.first_name} ${b.students.last_name}`,
      studentId: b.student_id,
      hasParent: !!b.parent,
      parent: b.parent ? `${b.parent.first_name} ${b.parent.last_name}` : null,
      hasAllParents: !!(b.parents && b.parents.length > 0),
      allParentsCount: b.parents?.length || 0,
      allParents: b.parents?.map(p => `${p.first_name} ${p.last_name}`) || [],
    })),
  })

  return mergedBillings
}

/**
 * Send payment reminder
 */
export async function sendPaymentReminder(
  studentId: string,
  billingPeriodId: string
): Promise<void> {
  const supabase = await createClient()

  // Validate inputs
  if (!studentId || !billingPeriodId) {
    throw new Error('Student ID and Billing Period ID are required')
  }

  console.log('[sendPaymentReminder] Attempting to send reminder:', {
    studentId,
    billingPeriodId,
    reminderDate: new Date().toISOString().split('T')[0],
  })

  // Check if billing period exists
  const { data: period, error: periodError } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('id', billingPeriodId)
    .single()

  if (periodError || !period) {
    console.error('[sendPaymentReminder] Billing period not found:', {
      billingPeriodId,
      error: periodError,
    })
    throw new Error(`Billing period not found: ${periodError?.message || 'Unknown error'}`)
  }

  // Check if student exists
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, hourly_rate')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    console.error('[sendPaymentReminder] Student not found:', {
      studentId,
      error: studentError,
    })
    throw new Error(`Student not found: ${studentError?.message || 'Unknown error'}`)
  }

  // Create reminder record
  const { data: reminder, error } = await supabase
    .from('payment_reminders')
    .insert({
      student_id: studentId,
      billing_period_id: billingPeriodId,
      reminder_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) {
    console.error('[sendPaymentReminder] Failed to create reminder record:', {
      error: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      errorHint: error.hint,
      studentId,
      billingPeriodId,
    })
    throw new Error(`Failed to send reminder: ${error.message}`)
  }

  console.log('[sendPaymentReminder] Reminder created successfully:', {
    reminderId: reminder?.id,
    studentId,
    studentName: `${student.first_name} ${student.last_name}`,
  })

  // Get period data
  const { data: periodData } = await supabase
    .from('billing_periods')
    .select('month, year')
    .eq('id', billingPeriodId)
    .single()

  if (!periodData) {
    throw new Error('Billing period data not found')
  }

  const month = periodData.month
  const year = periodData.year

  // Get billing data (if exists)
  const { data: billingData } = await supabase
    .from('student_billings')
    .select('total_due, total_paid, balance')
    .eq('student_id', studentId)
    .eq('billing_period_id', billingPeriodId)
    .single()

  let totalDue = 0
  let totalPaid = 0
  let balance = 0
  let hours = 0

  if (billingData) {
    totalDue = parseFloat(billingData.total_due?.toString() || '0')
    totalPaid = parseFloat(billingData.total_paid?.toString() || '0')
    balance = parseFloat(billingData.balance?.toString() || '0')
    // Calculate hours from total_due and hourly_rate
    // Get default rate from system_settings if student doesn't have one
    let defaultRate = 50.00 // fallback
    if (!student?.hourly_rate) {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'default_student_rate')
        .maybeSingle()
      
      if (setting?.value) {
        const parsedRate = parseFloat(setting.value)
        if (!isNaN(parsedRate)) {
          defaultRate = parsedRate
        }
      }
    }
    const hourlyRate = parseFloat(student.hourly_rate?.toString() || defaultRate.toString())
    hours = hourlyRate > 0 ? totalDue / hourlyRate : 0
  } else {
    // If billing doesn't exist, get data from reports (for billing-from-reports)
    const { data: reportsData } = await supabase
      .from('monthly_reports')
      .select(`
        monthly_report_entries!inner (
          hours,
          student_id
        )
      `)
      .eq('month', month)
      .eq('year', year)
      .in('status', ['approved', 'paid'])

    if (reportsData) {
      for (const report of reportsData) {
        const entries = Array.isArray(report.monthly_report_entries) 
          ? report.monthly_report_entries 
          : [report.monthly_report_entries]
        for (const entry of entries) {
          if (entry && entry.student_id === studentId) {
            hours += parseFloat(entry.hours?.toString() || '0')
          }
        }
      }
      // Get default rate from system_settings if student doesn't have one
    let defaultRate = 50.00 // fallback
    if (!student?.hourly_rate) {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'default_student_rate')
        .maybeSingle()
      
      if (setting?.value) {
        const parsedRate = parseFloat(setting.value)
        if (!isNaN(parsedRate)) {
          defaultRate = parsedRate
        }
      }
    }
    const hourlyRate = parseFloat(student.hourly_rate?.toString() || defaultRate.toString())
      totalDue = hours * hourlyRate
    }

    // Get payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('amount')
      .eq('student_id', studentId)
      .eq('billing_period_id', billingPeriodId)

    if (paymentsData) {
      for (const payment of paymentsData) {
        totalPaid += parseFloat(payment.amount?.toString() || '0')
      }
    }
    balance = totalDue - totalPaid
  }

  // Get parent email
  const { data: parentData } = await supabase
    .from('student_parents')
    .select(`
      is_primary,
      parents (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('student_id', studentId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .single()

  if (parentData && parentData.parents) {
    const parent = Array.isArray(parentData.parents) ? parentData.parents[0] : parentData.parents
    if (parent && parent.email) {
      // Send email
      const { sendPaymentReminderEmail } = await import('@/lib/email/send')
      const emailResult = await sendPaymentReminderEmail({
        to: parent.email,
        parentName: `${parent.first_name} ${parent.last_name}`,
        studentName: `${student.first_name} ${student.last_name}`,
        month,
        year,
        totalDue,
        totalPaid,
        balance,
        hours,
      })

      if (emailResult.success) {
        // Update reminder record with sent_at timestamp
        await supabase
          .from('payment_reminders')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', reminder?.id)

        console.log('[sendPaymentReminder] Email sent successfully:', {
          reminderId: reminder?.id,
          email: parent.email,
          messageId: emailResult.messageId,
        })
      } else {
        console.error('[sendPaymentReminder] Failed to send email:', {
          reminderId: reminder?.id,
          email: parent.email,
          error: emailResult.error,
        })
        // Don't throw - reminder record was created, email failure is logged
      }
    } else {
      console.warn('[sendPaymentReminder] No parent email found:', {
        studentId,
        hasParent: !!parent,
        hasEmail: !!(parent && parent.email),
      })
    }
  } else {
    console.warn('[sendPaymentReminder] No parent found for student:', {
      studentId,
      hasParentData: !!parentData,
    })
  }
}

/**
 * Get student billings calculated from approved declarations for a specific period
 */
export async function getStudentBillingsFromDeclarations(
  month: number,
  year: number
): Promise<StudentBillingWithParent[]> {
  const supabase = await createClient()

  // Validate month and year
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Month must be between 1 and 12.`)
  }
  if (year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${year}. Year must be between 2000 and 2100.`)
  }

  // Get or create billing period
  const { data: period, error: periodFetchError } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (periodFetchError) {
    throw new Error(`Failed to fetch billing period: ${periodFetchError.message}`)
  }

  let periodId: string
  if (period) {
    periodId = period.id
  } else {
    const { data: newPeriod, error: periodError } = await supabase
      .from('billing_periods')
      .insert({ month, year })
      .select('id')
      .single()

    if (periodError || !newPeriod) {
      throw new Error(`Failed to create billing period: ${periodError?.message || 'Unknown error'}`)
    }
    periodId = newPeriod.id
  }

  // Get all submitted and approved declarations for the month/year
  const { data: declarations, error: declarationsError } = await supabase
    .from('monthly_declarations')
    .select(`
      id,
      tutor_id,
      month,
      year,
      status,
      profiles!monthly_declarations_tutor_id_fkey (
        id,
        full_name
      ),
      monthly_declaration_entries (
        id,
        student_id,
        duration_minutes,
        students (
          id,
          first_name,
          last_name,
          hourly_rate
        )
      )
    `)
    .eq('month', month)
    .eq('year', year)
    .in('status', ['submitted', 'approved'])

  if (declarationsError) {
    throw new Error(`Failed to fetch declarations: ${declarationsError.message}`)
  }

  if (!declarations || declarations.length === 0) {
    return []
  }

  // Group entries by student_id and sum hours
  const studentHoursMap = new Map<string, number>()
  const studentTutorsMap = new Map<string, Map<string, string>>()
  const studentDataMap = new Map<string, { 
    first_name: string
    last_name: string
    hourly_rate: number
  }>()

  for (const declaration of declarations) {
    const tutor = Array.isArray(declaration.profiles) ? declaration.profiles[0] : declaration.profiles
    const tutorId = tutor?.id || ''
    const tutorName = tutor?.full_name || ''

    const entries = declaration.monthly_declaration_entries || []
    
    for (const entry of entries) {
      const studentId = entry.student_id
      const hours = (entry.duration_minutes || 0) / 60
      
      const currentHours = studentHoursMap.get(studentId) || 0
      studentHoursMap.set(studentId, currentHours + hours)

      if (tutorId && tutorName) {
        if (!studentTutorsMap.has(studentId)) {
          studentTutorsMap.set(studentId, new Map())
        }
        studentTutorsMap.get(studentId)!.set(tutorId, tutorName)
      }

      if (!studentDataMap.has(studentId)) {
        const student = Array.isArray(entry.students) ? entry.students[0] : entry.students
        const hourlyRate = student?.hourly_rate 
          ? parseFloat(student.hourly_rate.toString()) 
          : 50
        
        studentDataMap.set(studentId, {
          first_name: student?.first_name || '',
          last_name: student?.last_name || '',
          hourly_rate: hourlyRate,
        })
      }
    }
  }

  const studentIds = Array.from(studentHoursMap.keys())
  
  if (studentIds.length === 0) {
    return []
  }

  // Get parents
  const BATCH_SIZE = 100
  type ParentDataEntry = {
    id: string
    student_id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    } | null
  }
  
  const allParentData: ParentDataEntry[] = []
  
  for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
    const batch = studentIds.slice(i, i + BATCH_SIZE)
    
    const { data: batchData, error: parentQueryError } = await supabase
      .from('student_parents')
      .select(`
        id,
        student_id,
        is_primary,
        parents (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .in('student_id', batch)
      .order('is_primary', { ascending: false })

    if (parentQueryError) {
      throw new Error(`Failed to fetch parents: ${parentQueryError.message}`)
    }

    if (batchData) {
      // Mapuj dane - Supabase zwraca parents jako tablicę, ale typ oczekuje pojedynczego obiektu
      const mappedData: ParentDataEntry[] = batchData.map((item: any) => ({
        id: item.id,
        student_id: item.student_id,
        is_primary: item.is_primary,
        parents: Array.isArray(item.parents) ? item.parents[0] : item.parents,
      }))
      allParentData.push(...mappedData)
    }
  }

  const parentMap = new Map<string, ParentDataEntry>()
  for (const item of allParentData) {
    if (item.student_id) {
      const existing = parentMap.get(item.student_id)
      if (!existing || (item.is_primary && !existing.is_primary)) {
        parentMap.set(item.student_id, item)
      }
    }
  }

  // Build result array
  const result: StudentBillingWithParent[] = []

  for (const studentId of studentIds) {
    const hours = studentHoursMap.get(studentId) || 0
    const studentData = studentDataMap.get(studentId)
    if (!studentData) continue

    const hourlyRate = studentData.hourly_rate
    const totalDue = hours * hourlyRate

    const parentData = parentMap.get(studentId)
    const parent = parentData?.parents
      ? {
          id: parentData.parents.id,
          first_name: parentData.parents.first_name,
          last_name: parentData.parents.last_name,
          email: parentData.parents.email,
          phone: parentData.parents.phone,
        }
      : undefined

    const tutorsMap = studentTutorsMap.get(studentId) || new Map()
    const tutors = Array.from(tutorsMap.values())

    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('student_id', studentId)
      .eq('billing_period_id', periodId)

    const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0) || 0
    const balance = totalDue - totalPaid

    let status: BillingStatus = 'unpaid'
    if (balance <= 0 && totalPaid > 0) {
      status = 'paid'
    } else if (totalPaid > 0) {
      status = 'partially_paid'
    }

    result.push({
      id: '',
      student_id: studentId,
      billing_period_id: periodId,
      total_due: totalDue,
      total_paid: totalPaid,
      balance,
      status,
      students: {
        id: studentId,
        first_name: studentData.first_name,
        last_name: studentData.last_name,
      },
      billing_periods: {
        id: periodId,
        month,
        year,
      },
      parent,
      tutors: tutors.length > 0 ? tutors : undefined,
      hours,
      hours_this_month: hours, // For declarations, hours_this_month is the same as hours
      total_hours: hours, // For declarations, total_hours is the same as hours
    })
  }

  result.sort((a, b) => {
    const nameA = `${a.students.last_name} ${a.students.first_name}`.toLowerCase()
    const nameB = `${b.students.last_name} ${b.students.first_name}`.toLowerCase()
    return nameA.localeCompare(nameB)
  })

  return result
}

