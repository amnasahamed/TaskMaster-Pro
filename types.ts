
export enum AssignmentStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  REVIEW = 'Under Review',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum AssignmentType {
  ESSAY = 'Essay',
  DISSERTATION = 'Dissertation',
  REPORT = 'Report',
  PRESENTATION = 'Presentation',
  OTHER = 'Other'
}

export enum AssignmentPriority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  university?: string;
  remarks?: string;
  isFlagged?: boolean; // Bad client / Non-payer
  referredBy?: string; // ID of the student who referred them
}

export interface WriterRating {
  quality: number;
  punctuality: number;
  count: number;
}

export interface Writer {
  id: string;
  name: string;
  contact: string;
  specialty?: string;
  isFlagged?: boolean; // Ghosted / Abandoned work
  rating?: WriterRating;
}

export interface ChapterProgress {
  chapterNumber: number;
  title: string;
  isCompleted: boolean;
  remarks: string;
}

export interface Assignment {
  id: string;
  studentId: string;
  writerId?: string;
  title: string;
  type: AssignmentType;
  subject: string;
  level: string; // Undergraduate, Masters, PhD
  deadline: string; // ISO Date string
  status: AssignmentStatus;
  priority: AssignmentPriority;

  // Document
  documentLink?: string;

  // Word Count specifics
  wordCount?: number;
  costPerWord?: number;       // Client Rate
  writerCostPerWord?: number; // Writer Rate

  // Financials - Incoming (Student)
  price: number;
  paidAmount: number;

  // Financials - Outgoing (Writer)
  writerPrice?: number;
  writerPaidAmount?: number;
  sunkCosts?: number; // Money paid to previous writers (abandoned work)

  // Dissertation specific
  isDissertation: boolean;
  totalChapters?: number;
  chapters?: ChapterProgress[];

  createdAt: string;
  description?: string;
}

export interface DashboardStats {
  totalPending: number;
  totalOverdue: number;
  pendingAmount: number;     // From Students
  pendingWriterPay: number;  // To Writers
  activeDissertations: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  pin?: string; // Custom field for PIN login
}
