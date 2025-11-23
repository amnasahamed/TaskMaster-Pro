/// <reference types="vite/client" />
import PocketBase from 'pocketbase';
import { Assignment, AssignmentStatus, AssignmentType, AssignmentPriority, Student, Writer } from '../types';

// Initialize PocketBase
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || `${window.location.protocol}//${window.location.hostname}:8090`;
const pb = new PocketBase(pbUrl);

// Collection Names
const COLLECTIONS = {
  STUDENTS: 'students',
  ASSIGNMENTS: 'assignments',
  WRITERS: 'writers',
};

// Helper to generate IDs (PocketBase generates its own, but we might need this for optimistic UI if we used it, 
// but here we will rely on PB's IDs or map them)
// Note: PocketBase uses 15-char string IDs by default.

// Initial Seed Data (This should ideally be a separate script or admin function, 
// but keeping it here to match previous logic, albeit async)
export const seedData = async () => {
  try {
    // Check if we have any students
    const studentsList = await pb.collection(COLLECTIONS.STUDENTS).getList(1, 1);
    if (studentsList.totalItems === 0) {
      const students: Omit<Student, 'id'>[] = [
        { name: 'Alice Johnson', email: 'alice@uni.edu', phone: '555-0101', university: 'Oxford', isFlagged: false },
        { name: 'Bob Smith', email: 'bob@college.edu', phone: '555-0102', university: 'Cambridge', isFlagged: false },
      ];
      for (const s of students) {
        await pb.collection(COLLECTIONS.STUDENTS).create(s);
      }
    }

    // Check writers
    const writersList = await pb.collection(COLLECTIONS.WRITERS).getList(1, 1);
    if (writersList.totalItems === 0) {
      const writers: Omit<Writer, 'id'>[] = [
        {
          name: 'Dr. Expert',
          contact: '919876543210',
          specialty: 'Law',
          isFlagged: false,
          rating: { quality: 4.8, punctuality: 5.0, count: 12 }
        },
        {
          name: 'Pro Writer',
          contact: '919876543211',
          specialty: 'Nursing',
          isFlagged: false,
          rating: { quality: 4.2, punctuality: 3.8, count: 5 }
        },
      ];
      for (const w of writers) {
        await pb.collection(COLLECTIONS.WRITERS).create(w);
      }
    }

    // Seed User (Muhsina)
    try {
      const userList = await pb.collection('users').getList(1, 1, {
        filter: 'username = "muhsina"'
      });

      if (userList.totalItems === 0) {
        // Create the user
        // Note: 'password' and 'passwordConfirm' are required by PB default auth, 
        // even if we use PIN for our custom UI. We'll set a default strong password.
        await pb.collection('users').create({
          username: 'muhsina',
          email: 'muhsina@taskmaster.pro',
          name: 'Muhsina',
          pin: '4466',
          password: 'Password123!',
          passwordConfirm: 'Password123!',
        });
        console.log('User muhsina seeded.');
      }
    } catch (e) {
      console.error('Failed to seed user. Ensure "users" collection is open or existing.', e);
    }

    // Check assignments
    const assignmentsList = await pb.collection(COLLECTIONS.ASSIGNMENTS).getList(1, 1);
    if (assignmentsList.totalItems === 0) {
      // We need to fetch students and writers to link them correctly if we were strictly relational,
      // but for seeding we might just create them. 
      // However, PB requires valid relation IDs if the schema enforces it.
      // For simplicity in this refactor, we assume the user will set up the schema 
      // to allow text IDs or we fetch the just-created ones.

      // Let's fetch the students and writers we just made or that exist
      const allStudents = await pb.collection(COLLECTIONS.STUDENTS).getFullList();
      const allWriters = await pb.collection(COLLECTIONS.WRITERS).getFullList();

      if (allStudents.length > 0 && allWriters.length > 0) {
        const assignments: any[] = [
          {
            studentId: allStudents[0].id,
            title: 'International Law Essay',
            type: AssignmentType.ESSAY,
            subject: 'Law',
            level: 'Masters',
            deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
            status: AssignmentStatus.IN_PROGRESS,
            priority: AssignmentPriority.HIGH,
            writerId: allWriters[0].id,
            wordCount: 2000,
            costPerWord: 2.5,
            price: 5000,
            paidAmount: 2000,
            writerCostPerWord: 1.5,
            writerPrice: 3000,
            writerPaidAmount: 1000,
            sunkCosts: 0,
            isDissertation: false,
            documentLink: 'https://docs.google.com'
          },
          {
            studentId: allStudents[1].id,
            title: 'Nursing Dissertation',
            type: AssignmentType.DISSERTATION,
            subject: 'Nursing',
            level: 'Undergraduate',
            deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
            status: AssignmentStatus.IN_PROGRESS,
            priority: AssignmentPriority.MEDIUM,
            wordCount: 10000,
            costPerWord: 2.0,
            price: 20000,
            paidAmount: 5000,
            writerCostPerWord: 1.2,
            writerPrice: 12000,
            writerPaidAmount: 0,
            sunkCosts: 0,
            isDissertation: true,
            totalChapters: 5,
            chapters: [
              { chapterNumber: 1, title: 'Introduction', isCompleted: true, remarks: 'Good start' },
              { chapterNumber: 2, title: 'Literature Review', isCompleted: false, remarks: 'In progress' },
              { chapterNumber: 3, title: 'Methodology', isCompleted: false, remarks: '' },
              { chapterNumber: 4, title: 'Results', isCompleted: false, remarks: '' },
              { chapterNumber: 5, title: 'Discussion', isCompleted: false, remarks: '' },
            ],
          }
        ];
        for (const a of assignments) {
          await pb.collection(COLLECTIONS.ASSIGNMENTS).create(a);
        }
      }
    }
  } catch (err) {
    console.error("Error seeding data:", err);
  }
};

// --- Students ---

export const getStudents = async (): Promise<Student[]> => {
  const records = await pb.collection(COLLECTIONS.STUDENTS).getFullList({
    sort: '-created',
  });
  return records.map(r => ({ ...r, id: r.id } as unknown as Student));
};

export const saveStudent = async (student: Student): Promise<Student> => {
  if (student.id) {
    const record = await pb.collection(COLLECTIONS.STUDENTS).update(student.id, student);
    return { ...record, id: record.id } as unknown as Student;
  } else {
    const record = await pb.collection(COLLECTIONS.STUDENTS).create(student);
    return { ...record, id: record.id } as unknown as Student;
  }
};

export const deleteStudent = async (id: string) => {
  await pb.collection(COLLECTIONS.STUDENTS).delete(id);
};

// --- Writers ---

export const getWriters = async (): Promise<Writer[]> => {
  const records = await pb.collection(COLLECTIONS.WRITERS).getFullList({
    sort: '-created',
  });
  return records.map(r => ({ ...r, id: r.id } as unknown as Writer));
};

export const saveWriter = async (writer: Writer): Promise<Writer> => {
  if (writer.id) {
    const record = await pb.collection(COLLECTIONS.WRITERS).update(writer.id, writer);
    return { ...record, id: record.id } as unknown as Writer;
  } else {
    const record = await pb.collection(COLLECTIONS.WRITERS).create(writer);
    return { ...record, id: record.id } as unknown as Writer;
  }
};

export const deleteWriter = async (id: string) => {
  await pb.collection(COLLECTIONS.WRITERS).delete(id);
};

export const rateWriter = async (writerId: string, quality: number, punctuality: number) => {
  try {
    const writer = await pb.collection(COLLECTIONS.WRITERS).getOne(writerId);
    const currentRating = writer.rating || { quality: 0, punctuality: 0, count: 0 };

    // Calculate new average
    const newCount = currentRating.count + 1;
    const newQuality = ((currentRating.quality * currentRating.count) + quality) / newCount;
    const newPunctuality = ((currentRating.punctuality * currentRating.count) + punctuality) / newCount;

    const newRating = {
      quality: Number(newQuality.toFixed(1)),
      punctuality: Number(newPunctuality.toFixed(1)),
      count: newCount
    };

    await pb.collection(COLLECTIONS.WRITERS).update(writerId, { rating: newRating });
  } catch (err) {
    console.error("Error rating writer:", err);
  }
};

// --- Assignments ---

export const getAssignments = async (): Promise<Assignment[]> => {
  const records = await pb.collection(COLLECTIONS.ASSIGNMENTS).getFullList({
    sort: '-created',
  });
  // Ensure fields exist for legacy data or optional fields
  return records.map((a: any) => ({
    ...a,
    id: a.id,
    priority: a.priority || AssignmentPriority.MEDIUM,
    writerPrice: a.writerPrice || 0,
    writerPaidAmount: a.writerPaidAmount || 0,
    sunkCosts: a.sunkCosts || 0,
    wordCount: a.wordCount || 0,
    costPerWord: a.costPerWord || 0,
    writerCostPerWord: a.writerCostPerWord || 0,
    createdAt: a.created || new Date().toISOString() // PB uses 'created'
  }));
};

export const getAssignmentsByStudent = async (studentId: string): Promise<Assignment[]> => {
  const records = await pb.collection(COLLECTIONS.ASSIGNMENTS).getFullList({
    filter: `studentId = "${studentId}"`,
    sort: '-created',
  });
  return records.map((a: any) => ({
    ...a,
    id: a.id,
    priority: a.priority || AssignmentPriority.MEDIUM,
    writerPrice: a.writerPrice || 0,
    writerPaidAmount: a.writerPaidAmount || 0,
    sunkCosts: a.sunkCosts || 0,
    wordCount: a.wordCount || 0,
    costPerWord: a.costPerWord || 0,
    writerCostPerWord: a.writerCostPerWord || 0,
    createdAt: a.created || new Date().toISOString()
  }));
};

export const saveAssignment = async (assignment: Assignment): Promise<Assignment> => {
  if (assignment.id) {
    const record = await pb.collection(COLLECTIONS.ASSIGNMENTS).update(assignment.id, assignment);
    return { ...record, id: record.id } as unknown as Assignment;
  } else {
    const record = await pb.collection(COLLECTIONS.ASSIGNMENTS).create(assignment);
    return { ...record, id: record.id } as unknown as Assignment;
  }
};

export const deleteAssignment = async (id: string) => {
  await pb.collection(COLLECTIONS.ASSIGNMENTS).delete(id);
};

export const getDashboardStats = async () => {
  const assignments = await getAssignments();
  const now = new Date();

  const totalPending = assignments.filter(a => a.status !== AssignmentStatus.COMPLETED && a.status !== AssignmentStatus.CANCELLED).length;

  const totalOverdue = assignments.filter(a => {
    return new Date(a.deadline) < now && a.status !== AssignmentStatus.COMPLETED;
  }).length;

  const pendingAmount = assignments.reduce((sum, a) => sum + (a.price - a.paidAmount), 0);
  const pendingWriterPay = assignments.reduce((sum, a) => sum + ((a.writerPrice || 0) - (a.writerPaidAmount || 0)), 0);

  const activeDissertations = assignments.filter(a => a.isDissertation && a.status !== AssignmentStatus.COMPLETED).length;

  return { totalPending, totalOverdue, pendingAmount, pendingWriterPay, activeDissertations };
};

// --- Data Management (Backup/Restore) ---
// Note: With PocketBase, backup/restore is usually done at the DB level (SQLite file), 
// but we can keep a JSON export for portability if desired.

export const getExportData = async () => {
  const students = await getStudents();
  const writers = await getWriters();
  const assignments = await getAssignments();

  return {
    students,
    writers,
    assignments,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
};

export const importData = async (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data.students || !data.writers || !data.assignments) {
      throw new Error("Invalid data format");
    }

    // This is a destructive or additive operation? 
    // For simplicity, let's just add them. 
    // A full restore usually implies clearing existing data first.

    // Clear existing? (Optional, maybe dangerous without confirmation)
    // await clearAllData(); 

    for (const s of data.students) {
      delete s.id; // Let PB generate new IDs
      delete s.created;
      delete s.updated;
      await pb.collection(COLLECTIONS.STUDENTS).create(s);
    }
    for (const w of data.writers) {
      delete w.id;
      delete w.created;
      delete w.updated;
      await pb.collection(COLLECTIONS.WRITERS).create(w);
    }
    for (const a of data.assignments) {
      delete a.id;
      delete a.created;
      delete a.updated;
      await pb.collection(COLLECTIONS.ASSIGNMENTS).create(a);
    }
    return true;
  } catch (e) {
    console.error("Import failed", e);
    return false;
  }
};

export const clearAllData = async () => {
  // This is dangerous and slow if there are many records, 
  // but for this app scale it's fine.
  const students = await pb.collection(COLLECTIONS.STUDENTS).getFullList();
  for (const s of students) await pb.collection(COLLECTIONS.STUDENTS).delete(s.id);

  const writers = await pb.collection(COLLECTIONS.WRITERS).getFullList();
  for (const w of writers) await pb.collection(COLLECTIONS.WRITERS).delete(w.id);

  const assignments = await pb.collection(COLLECTIONS.ASSIGNMENTS).getFullList();
  for (const a of assignments) await pb.collection(COLLECTIONS.ASSIGNMENTS).delete(a.id);

  window.location.reload();
};