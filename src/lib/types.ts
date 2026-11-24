export type ExtractionMode = "model" | "offline-demo"

export type Decision = {
  id: string
  statement: string
  quote: string
  grounded: boolean
}

export type ActionItem = {
  id: string
  title: string
  owner: string | null
  dueDate: string | null
  dueTime: string | null
  dueDateEvidence: string | null
  quote: string
  grounded: boolean
}

export type ExtractionResult = {
  mode: ExtractionMode
  model: string | null
  meetingTitle: string
  meetingDate: string | null
  summary: string
  decisions: Decision[]
  actionItems: ActionItem[]
  warnings: string[]
  notes: string[]
}

export type DateSource = "transcript" | "reviewer"

export type CalendarEventInput = {
  id: string
  title: string
  owner: string | null
  quote: string
  evidence: string | null
  date: string
  time: string | null
  allDay: boolean
  dateSource: DateSource
}

export type CalendarSyncRequest = {
  confirmed: true
  meetingTitle: string
  summary: string
  events: CalendarEventInput[]
}

export type CalendarSyncResult = {
  id: string
  ok: boolean
  htmlLink?: string
  eventId?: string
  error?: string
}

export type StatusResponse = {
  model: {
    configured: boolean
    model: string | null
    host: string | null
  }
  transcription: {
    configured: boolean
    model: string | null
    host: string | null
    language: string | null
    maxBytes: number
    limitKind: "provider" | "vercel" | "configured"
  }
  calendar: {
    configured: boolean
    connected: boolean
    email: string | null
  }
}
