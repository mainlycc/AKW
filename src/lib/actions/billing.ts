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
  category?: {
    subject_name: string
    level_name: string
  }
  tutors?: Array<{
    id: string
    full_name: string
  }>
  hours_this_month: number
  total_hours: number
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
  const { data: period } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .single()

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

  // Get student hourly rate (default 50 PLN)
  const { data: student } = await supabase
    .from('students')
    .select('hourly_rate')
    .eq('id', studentId)
    .single()

  const hourlyRate = student?.hourly_rate ? parseFloat(student.hourly_rate.toString()) : 50

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

  const { data: allParentData } = await supabase
    .from('student_parents')
    .select(
      `
      student_id,
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
    .eq('is_primary', true)

  // Create a map of student_id -> parent for quick lookup
  type ParentDataItem = {
    student_id: string
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
      if (item.student_id && !parentMap.has(item.student_id)) {
        parentMap.set(item.student_id, item as ParentDataItem)
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
 * Send payment reminder
 */
export async function sendPaymentReminder(
  studentId: string,
  billingPeriodId: string
): Promise<void> {
  const supabase = await createClient()

  // Create reminder record
  const { error } = await supabase.from('payment_reminders').insert({
    student_id: studentId,
    billing_period_id: billingPeriodId,
    reminder_date: new Date().toISOString().split('T')[0],
  })

  if (error) {
    throw new Error(`Failed to send reminder: ${error.message}`)
  }

  // TODO: Implement email sending logic here
  // For now, we just create the reminder record
}

