import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Assignment, AssignmentStatus, AssignmentType, AssignmentPriority, Student, Writer } from '../types';
import * as DataService from '../services/dataService';
import Card from './ui/Card';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { useToast } from './Layout';

const AssignmentsView: React.FC = () => {
    const { addToast } = useToast();
    const location = useLocation();

    // Data State
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [writers, setWriters] = useState<Writer[]>([]);

    // UI State
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filter State
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isOverdueFilter, setIsOverdueFilter] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<Partial<Assignment>>({});

    // Delete Confirmation State
    const [deleteConfig, setDeleteConfig] = useState<{ isOpen: boolean, type: 'single' | 'bulk', id?: string }>({ isOpen: false, type: 'single' });

    // Rating Modal State
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [ratingWriterId, setRatingWriterId] = useState<string | null>(null);
    const [ratingStats, setRatingStats] = useState({ quality: 5, punctuality: 5 });

    // Inline Creation State
    const [newStudentName, setNewStudentName] = useState('');
    const [isAddingStudent, setIsAddingStudent] = useState(false);
    const [newWriterName, setNewWriterName] = useState('');
    const [isAddingWriter, setIsAddingWriter] = useState(false);

    // Reassign State
    const [isReassigning, setIsReassigning] = useState(false);

    useEffect(() => {
        refreshData();

        // Handle Deep Linking from Dashboard
        if (location.state) {
            const state = location.state as any;
            if (state.filterStatus) setStatusFilter(state.filterStatus);
            if (state.filterSpecial === 'overdue') setIsOverdueFilter(true);
            if (state.filterType === 'Dissertation') setSearchTerm('Dissertation');
            if (state.highlightId) {
                const element = document.getElementById(state.highlightId);
                if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const refreshData = async () => {
        setAssignments(await DataService.getAssignments());
        setStudents(await DataService.getStudents());
        setWriters(await DataService.getWriters());
        setSelectedIds(new Set()); // Clear selection on refresh
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    // --- Handlers ---

    const handleQuickAddStudent = async () => {
        if (!newStudentName.trim()) return;
        const newStudent: Student = {
            id: '', // Will be generated
            name: newStudentName,
            email: 'pending@update.com',
            phone: '',
            university: 'Unknown'
        };
        const saved = await DataService.saveStudent(newStudent);
        setStudents(await DataService.getStudents());
        setEditingAssignment(prev => ({ ...prev, studentId: saved.id }));
        setNewStudentName('');
        setIsAddingStudent(false);
        addToast(`Created student: ${saved.name}`, 'success');
    };

    const handleQuickAddWriter = async () => {
        if (!newWriterName.trim()) return;
        const newWriter: Writer = {
            id: '',
            name: newWriterName,
            contact: 'pending@update.com',
            specialty: 'General'
        };
        const saved = await DataService.saveWriter(newWriter);
        setWriters(await DataService.getWriters());
        setEditingAssignment(prev => ({ ...prev, writerId: saved.id }));
        setNewWriterName('');
        setIsAddingWriter(false);
        addToast(`Created writer: ${saved.name}`, 'success');
    };

    const handleReassignWriter = () => {
        const currentPaid = editingAssignment.writerPaidAmount || 0;
        const currentSunk = editingAssignment.sunkCosts || 0;

        setEditingAssignment(prev => ({
            ...prev,
            sunkCosts: currentSunk + currentPaid,
            writerId: '',
            writerPaidAmount: 0,
            writerPrice: 0,
            writerCostPerWord: 0
        }));
        setIsReassigning(false);
        addToast('Writer unassigned. Previous payments moved to Sunk Costs.', 'info');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAssignment.studentId || !editingAssignment.title) {
            addToast('Student and Title are required', 'error');
            return;
        }

        const payload = {
            ...editingAssignment,
            price: Number(editingAssignment.price) || 0,
            paidAmount: Number(editingAssignment.paidAmount) || 0,
            writerPrice: Number(editingAssignment.writerPrice) || 0,
            writerPaidAmount: Number(editingAssignment.writerPaidAmount) || 0,
            sunkCosts: Number(editingAssignment.sunkCosts) || 0,
            wordCount: Number(editingAssignment.wordCount) || 0,
            costPerWord: Number(editingAssignment.costPerWord) || 0,
            writerCostPerWord: Number(editingAssignment.writerCostPerWord) || 0,
            status: editingAssignment.status || AssignmentStatus.PENDING,
            type: editingAssignment.type || AssignmentType.ESSAY,
            priority: editingAssignment.priority || AssignmentPriority.MEDIUM,
            isDissertation: editingAssignment.type === AssignmentType.DISSERTATION,
        } as Assignment;

        if (payload.isDissertation && !payload.chapters && payload.totalChapters) {
            payload.chapters = Array.from({ length: payload.totalChapters }, (_, i) => ({
                chapterNumber: i + 1,
                title: `Chapter ${i + 1}`,
                isCompleted: false,
                remarks: ''
            }));
        }

        await DataService.saveAssignment(payload);
        setIsModalOpen(false);
        setEditingAssignment({});
        refreshData();
        addToast('Assignment saved successfully', 'success');
    };

    const handleStatusChange = async (assignment: Assignment, newStatus: AssignmentStatus) => {
        const updated = { ...assignment, status: newStatus };
        await DataService.saveAssignment(updated);

        // Check if marking as completed and has a writer - trigger rating
        if (newStatus === AssignmentStatus.COMPLETED && assignment.writerId && assignment.status !== AssignmentStatus.COMPLETED) {
            setRatingWriterId(assignment.writerId);
            setRatingStats({ quality: 5, punctuality: 5 });
            setIsRatingModalOpen(true);
        } else {
            refreshData();
            addToast('Status updated', 'info');
        }
    };

    const handleSubmitRating = async () => {
        if (ratingWriterId) {
            await DataService.rateWriter(ratingWriterId, ratingStats.quality, ratingStats.punctuality);
            addToast('Writer rated successfully!', 'success');
            refreshData();
            setIsRatingModalOpen(false);
            setRatingWriterId(null);
        }
    };

    const handleQuickSettle = async (e: React.MouseEvent, assignment: Assignment) => {
        e.stopPropagation();
        const due = assignment.price - assignment.paidAmount;
        if (due <= 0) return;

        if (confirm(`Mark remaining ${formatCurrency(due)} as received?`)) {
            const updated = { ...assignment, paidAmount: assignment.price };
            await DataService.saveAssignment(updated);
            refreshData();
            addToast('Payment settled!', 'success');
        }
    };

    const handleDelete = (id: string) => {
        setDeleteConfig({ isOpen: true, type: 'single', id });
    };

    const handleBulkDelete = () => {
        if (!selectedIds.size) return;
        setDeleteConfig({ isOpen: true, type: 'bulk' });
    };

    const executeDelete = async () => {
        if (deleteConfig.type === 'single' && deleteConfig.id) {
            await DataService.deleteAssignment(deleteConfig.id);
            addToast('Assignment deleted', 'error');
        } else if (deleteConfig.type === 'bulk') {
            // This could be optimized with a Promise.all or a bulk delete API if available
            for (const id of selectedIds) {
                await DataService.deleteAssignment(id);
            }
            addToast(`${selectedIds.size} assignments deleted`, 'success');
            setSelectedIds(new Set());
        }
        refreshData();
        setDeleteConfig({ ...deleteConfig, isOpen: false });
    };

    // Bulk Actions
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredAssignments.map(a => a.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    // Logic to auto-calculate price based on word count
    useEffect(() => {
        if (isModalOpen && editingAssignment) {
            if (editingAssignment.wordCount && editingAssignment.costPerWord) {
                setEditingAssignment(prev => ({
                    ...prev,
                    price: (prev.wordCount || 0) * (prev.costPerWord || 0)
                }));
            }
            if (editingAssignment.wordCount && editingAssignment.writerCostPerWord) {
                setEditingAssignment(prev => ({
                    ...prev,
                    writerPrice: (prev.wordCount || 0) * (prev.writerCostPerWord || 0)
                }));
            }
        }
    }, [editingAssignment.wordCount, editingAssignment.costPerWord, editingAssignment.writerCostPerWord]);

    // Helpers
    const getStatusStyles = (status: AssignmentStatus) => {
        switch (status) {
            case AssignmentStatus.COMPLETED:
                return {
                    card: '!bg-emerald-50/80 border border-emerald-100 shadow-sm',
                    row: 'bg-emerald-50/30 hover:bg-emerald-50/60',
                    select: 'bg-emerald-100 text-emerald-800'
                };
            case AssignmentStatus.IN_PROGRESS:
                return {
                    card: '!bg-blue-50/80 border border-blue-100 shadow-sm',
                    row: 'bg-blue-50/30 hover:bg-blue-50/60',
                    select: 'bg-blue-100 text-blue-700'
                };
            case AssignmentStatus.REVIEW:
                return {
                    card: '!bg-orange-50/80 border border-orange-100 shadow-sm',
                    row: 'bg-orange-50/30 hover:bg-orange-50/60',
                    select: 'bg-orange-100 text-orange-800'
                };
            case AssignmentStatus.CANCELLED:
                return {
                    card: '!bg-red-50/80 border border-red-100 shadow-sm',
                    row: 'bg-red-50/30 hover:bg-red-50/60',
                    select: 'bg-red-100 text-red-700'
                };
            default:
                return {
                    card: '!bg-white border-transparent',
                    row: 'hover:bg-slate-50',
                    select: 'bg-slate-100 text-slate-700'
                };
        }
    };

    const getPriorityColor = (priority: AssignmentPriority) => {
        switch (priority) {
            case AssignmentPriority.HIGH: return 'bg-red-50 text-red-600 border-red-200';
            case AssignmentPriority.MEDIUM: return 'bg-yellow-50 text-yellow-600 border-yellow-200';
            case AssignmentPriority.LOW: return 'bg-green-50 text-green-600 border-green-200';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const filteredAssignments = assignments.filter(a => {
        const student = students.find(s => s.id === a.studentId);
        const searchMatch =
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student && student.name.toLowerCase().includes(searchTerm.toLowerCase()));

        const statusMatch = statusFilter === 'all' || a.status === statusFilter;
        const priorityMatch = priorityFilter === 'all' || a.priority === priorityFilter;
        const isOverdue = new Date(a.deadline) < new Date() && a.status !== AssignmentStatus.COMPLETED;
        const overdueMatch = !isOverdueFilter || isOverdue;

        return statusMatch && priorityMatch && searchMatch && overdueMatch;
    });

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col gap-4 sticky top-14 md:static z-20 bg-background/95 backdrop-blur-sm py-2">
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="w-full bg-white shadow-sm border-none rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* View Toggle (Desktop Only) */}
                    <div className="hidden md:flex bg-slate-200 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'table' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'board' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Board
                        </button>
                    </div>

                    <Button onClick={() => { setEditingAssignment({}); setIsModalOpen(true); }} className="shadow-lg shadow-blue-500/20 whitespace-nowrap">
                        + New
                    </Button>
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <span className="text-sm font-bold text-blue-800">{selectedIds.size} Selected</span>
                        <div className="h-4 w-[1px] bg-blue-200"></div>
                        <button onClick={handleBulkDelete} className="text-sm font-medium text-red-600 hover:text-red-800">Delete</button>
                        <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-sm text-slate-500">Cancel</button>
                    </div>
                )}

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
                    {isOverdueFilter && (
                        <button onClick={() => setIsOverdueFilter(false)} className="bg-red-100 text-red-600 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1">
                            Overdue Only <span className="text-red-400">×</span>
                        </button>
                    )}
                    <select
                        className="bg-white border-none shadow-sm rounded-xl px-4 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20"
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                    >
                        <option value="all">Priority: All</option>
                        {Object.values(AssignmentPriority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                        className="bg-white border-none shadow-sm rounded-xl px-4 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Status: All</option>
                        {Object.values(AssignmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Empty State */}
            {filteredAssignments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="bg-blue-50 p-6 rounded-full mb-4">
                        <svg className="w-12 h-12 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">No tasks found</h3>
                    <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                        {searchTerm ? "Try adjusting your search filters" : "Get started by creating your first assignment"}
                    </p>
                    {!searchTerm && (
                        <Button onClick={() => { setEditingAssignment({}); setIsModalOpen(true); }}>
                            Create Assignment
                        </Button>
                    )}
                </div>
            )}

            {/* --- DESKTOP TABLE VIEW --- */}
            {viewMode === 'table' && filteredAssignments.length > 0 && (
                <div className="hidden md:block bg-white rounded-2xl shadow-ios overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="p-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-primary focus:ring-primary/20"
                                        checked={filteredAssignments.length > 0 && selectedIds.size === filteredAssignments.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Title / Subject</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">People</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Words / Rate</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Due Date</th>
                                <th className="p-4 text-xs font-bold text-green-600 uppercase tracking-wider text-right border-l border-slate-100">Student (In)</th>
                                <th className="p-4 text-xs font-bold text-red-500 uppercase tracking-wider text-right border-l border-slate-100">Writer (Out)</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAssignments.map(assignment => {
                                const student = students.find(s => s.id === assignment.studentId);
                                const writer = writers.find(w => w.id === assignment.writerId);
                                const isOverdue = new Date(assignment.deadline) < new Date() && assignment.status !== AssignmentStatus.COMPLETED;
                                const styles = getStatusStyles(assignment.status);

                                return (
                                    <tr id={assignment.id} key={assignment.id} className={`transition-colors group ${styles.row} ${selectedIds.has(assignment.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-primary focus:ring-primary/20"
                                                checked={selectedIds.has(assignment.id)}
                                                onChange={(e) => handleSelectOne(assignment.id, e.target.checked)}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold text-slate-900">{assignment.title}</div>
                                                {assignment.documentLink && (
                                                    <a href={assignment.documentLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" title="Open Document">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    </a>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">{assignment.type} • {assignment.subject}</div>
                                            {assignment.isDissertation && (
                                                <div className="mt-1 text-[10px] text-purple-600 font-medium">Dissertation</div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-slate-900">{student?.name}</div>
                                            {writer && <div className="text-xs text-slate-400">Writer: {writer.name}</div>}
                                        </td>
                                        <td className="p-4">
                                            <select
                                                className={`text-xs font-bold uppercase rounded px-2 py-1 border-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${styles.select}`}
                                                value={assignment.status}
                                                onChange={(e) => handleStatusChange(assignment, e.target.value as AssignmentStatus)}
                                            >
                                                {Object.values(AssignmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-slate-900">{assignment.wordCount?.toLocaleString() || '-'} words</div>
                                            {assignment.costPerWord ? (
                                                <div className="text-xs text-slate-500">@{formatCurrency(assignment.costPerWord)}/word</div>
                                            ) : <span className="text-xs text-slate-300">-</span>}
                                        </td>
                                        <td className="p-4">
                                            <div className={`text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                                                {new Date(assignment.deadline).toLocaleDateString()}
                                            </div>
                                            <div className="inline-block mt-1">
                                                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${getPriorityColor(assignment.priority)}`}>
                                                    {assignment.priority}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right border-l border-slate-200/50 bg-green-50/20">
                                            <div className="text-sm font-bold text-slate-900">{formatCurrency(assignment.price)}</div>
                                            {assignment.paidAmount < assignment.price ? (
                                                <button
                                                    onClick={(e) => handleQuickSettle(e, assignment)}
                                                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                                                    title="Quick Settle"
                                                >
                                                    Due: {formatCurrency(assignment.price - assignment.paidAmount)}
                                                </button>
                                            ) : (
                                                <span className="text-xs font-medium text-green-500">Paid ✓</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right border-l border-slate-200/50 bg-red-50/20">
                                            {assignment.writerPrice ? (
                                                <>
                                                    <div className="text-sm font-bold text-slate-900">{formatCurrency(assignment.writerPrice)}</div>
                                                    {(assignment.writerPaidAmount || 0) < assignment.writerPrice ? (
                                                        <span className="text-xs font-medium text-red-500">Due: {formatCurrency(assignment.writerPrice - (assignment.writerPaidAmount || 0))}</span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-green-500">Paid ✓</span>
                                                    )}
                                                    {assignment.sunkCosts && assignment.sunkCosts > 0 ? (
                                                        <div className="text-[10px] text-red-400 mt-1">Sunk: {formatCurrency(assignment.sunkCosts)}</div>
                                                    ) : null}
                                                </>
                                            ) : <span className="text-xs text-slate-300">-</span>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => { setEditingAssignment(assignment); setIsModalOpen(true); }}
                                                className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-primary transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- KANBAN BOARD VIEW (Desktop) --- */}
            {viewMode === 'board' && filteredAssignments.length > 0 && (
                <div className="hidden md:flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
                    {[AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS, AssignmentStatus.REVIEW, AssignmentStatus.COMPLETED].map(status => {
                        const colAssignments = filteredAssignments.filter(a => a.status === status);
                        return (
                            <div key={status} className="flex-1 min-w-[280px] bg-slate-100/50 rounded-2xl p-2 border border-slate-200">
                                <div className="px-2 py-3 mb-2 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">{status}</h3>
                                    <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{colAssignments.length}</span>
                                </div>
                                <div className="space-y-3">
                                    {colAssignments.map(a => {
                                        const student = students.find(s => s.id === a.studentId);
                                        return (
                                            <div id={a.id} key={a.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityColor(a.priority)}`}>{a.priority}</span>
                                                    <div className="flex gap-1">
                                                        {a.documentLink && (
                                                            <a href={a.documentLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                            </a>
                                                        )}
                                                        <button onClick={() => { setEditingAssignment(a); setIsModalOpen(true); }} className="text-slate-400 hover:text-primary">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <h4 className="font-semibold text-sm text-slate-900 mb-1 leading-tight">{a.title}</h4>
                                                <p className="text-xs text-slate-500 mb-3">{student?.name}</p>

                                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                                                    <p className={`text-[10px] font-medium ${new Date(a.deadline) < new Date() ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {new Date(a.deadline).toLocaleDateString()}
                                                    </p>

                                                    {/* Quick Status Mover */}
                                                    <div className="flex gap-1">
                                                        {status !== AssignmentStatus.PENDING && (
                                                            <button onClick={() => handleStatusChange(a, Object.values(AssignmentStatus)[Object.values(AssignmentStatus).indexOf(status) - 1])} className="p-1 hover:bg-slate-100 rounded" title="Move Back">
                                                                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                            </button>
                                                        )}
                                                        {status !== AssignmentStatus.COMPLETED && (
                                                            <button onClick={() => handleStatusChange(a, Object.values(AssignmentStatus)[Object.values(AssignmentStatus).indexOf(status) + 1])} className="p-1 hover:bg-slate-100 rounded" title="Move Forward">
                                                                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {colAssignments.length === 0 && <div className="text-center py-8 text-xs text-slate-400 italic">No tasks</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Mobile Card Grid View */}
            {filteredAssignments.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 md:hidden">
                    {filteredAssignments.map(assignment => {
                        const student = students.find(s => s.id === assignment.studentId);
                        const writer = writers.find(w => w.id === assignment.writerId);
                        const isOverdue = new Date(assignment.deadline) < new Date() && assignment.status !== AssignmentStatus.COMPLETED;
                        const progress = assignment.isDissertation && assignment.chapters
                            ? Math.round((assignment.chapters.filter(c => c.isCompleted).length / (assignment.chapters.length || 1)) * 100)
                            : 0;
                        const styles = getStatusStyles(assignment.status);

                        return (
                            <Card key={assignment.id} className={`relative overflow-hidden group transition-colors duration-300 ${styles.card}`}>

                                <div className="flex justify-between items-start mb-3 pl-1">
                                    <div className="flex gap-2 flex-wrap items-center">
                                        <select
                                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border-none focus:ring-0 cursor-pointer appearance-none ${styles.select}`}
                                            value={assignment.status}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleStatusChange(assignment, e.target.value as AssignmentStatus)}
                                        >
                                            {Object.values(AssignmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${getPriorityColor(assignment.priority)}`}>
                                            {assignment.priority}
                                        </span>
                                    </div>
                                    <div className="flex gap-1 opacity-100 transition-opacity">
                                        {assignment.documentLink && (
                                            <a href={assignment.documentLink} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/50 rounded-full hover:bg-white text-blue-500 hover:text-blue-700 backdrop-blur-sm">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            </a>
                                        )}
                                        <button onClick={() => { setEditingAssignment(assignment); setIsModalOpen(true); }} className="p-1.5 bg-white/50 rounded-full hover:bg-white text-slate-400 hover:text-primary backdrop-blur-sm">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-base font-bold text-slate-900 mb-1 leading-tight">{assignment.title}</h3>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-slate-600 font-medium">{student?.name} • {assignment.subject}</p>
                                        {assignment.wordCount && <span className="text-[10px] bg-white/60 text-slate-600 px-1.5 py-0.5 rounded backdrop-blur-sm">{assignment.wordCount} words</span>}
                                    </div>
                                    <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                        {isOverdue ? '⚠️ Overdue ' : 'Due '} {new Date(assignment.deadline).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="bg-green-50/50 p-2.5 rounded-xl border border-green-100 backdrop-blur-sm relative">
                                        <p className="text-[10px] text-green-700 uppercase font-bold mb-1">Student (In)</p>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-800">{formatCurrency(assignment.price)}</span>
                                            <span className={assignment.paidAmount < assignment.price ? 'text-red-600 font-semibold' : 'text-green-600 font-bold'}>
                                                {assignment.price - assignment.paidAmount > 0 ? `-${formatCurrency(assignment.price - assignment.paidAmount)}` : '✓'}
                                            </span>
                                        </div>
                                        {assignment.price - assignment.paidAmount > 0 && (
                                            <button
                                                onClick={(e) => handleQuickSettle(e, assignment)}
                                                className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-sm hover:scale-110 transition-transform"
                                                title="Quick Settle"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-red-50/50 p-2.5 rounded-xl border border-red-100 backdrop-blur-sm">
                                        <p className="text-[10px] text-red-700 uppercase font-bold mb-1">Writer (Out)</p>
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-700 truncate max-w-[60px]">{writer?.name || '-'}</span>
                                            {writer && (
                                                <span className={(assignment.writerPrice || 0) - (assignment.writerPaidAmount || 0) > 0 ? 'text-orange-600 font-semibold' : 'text-green-600 font-bold'}>
                                                    {(assignment.writerPrice || 0) - (assignment.writerPaidAmount || 0) > 0 ? 'Due' : '✓'}
                                                </span>
                                            )}
                                        </div>
                                        {assignment.sunkCosts && assignment.sunkCosts > 0 ? (
                                            <div className="mt-1 pt-1 border-t border-red-200/50 text-[9px] text-red-500 flex justify-between">
                                                <span>Sunk:</span>
                                                <span>{formatCurrency(assignment.sunkCosts)}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {assignment.isDissertation && (
                                    <div className="mt-4">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
                                            <span>Dissertation Progress</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* --- MODAL --- */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAssignment.id ? "Edit Assignment" : "New Assignment"}>
                <form onSubmit={handleSave} className="space-y-5">
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-500 uppercase ml-1">Core Info</label>

                        <div className="flex gap-2">
                            {isAddingStudent ? (
                                <div className="flex-1 flex gap-2 animate-in fade-in slide-in-from-left-2">
                                    <input
                                        autoFocus
                                        placeholder="New Student Name"
                                        className="w-full bg-blue-50 border-blue-200 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20"
                                        value={newStudentName}
                                        onChange={e => setNewStudentName(e.target.value)}
                                    />
                                    <button type="button" onClick={handleQuickAddStudent} className="bg-blue-600 text-white rounded-xl px-4 font-bold">✓</button>
                                    <button type="button" onClick={() => setIsAddingStudent(false)} className="bg-slate-200 text-slate-500 rounded-xl px-4">✕</button>
                                </div>
                            ) : (
                                <div className="flex-1 flex gap-2">
                                    <select
                                        required
                                        className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={editingAssignment.studentId || ''}
                                        onChange={e => setEditingAssignment({ ...editingAssignment, studentId: e.target.value })}
                                    >
                                        <option value="">Select Student</option>
                                        {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.isFlagged && '🚩'}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingStudent(true)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl px-3 transition-colors"
                                        title="Add New Student"
                                    >
                                        +
                                    </button>
                                </div>
                            )}
                        </div>

                        <input
                            required
                            placeholder="Assignment Title"
                            type="text"
                            className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all"
                            value={editingAssignment.title || ''}
                            onChange={e => setEditingAssignment({ ...editingAssignment, title: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <select
                            className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            value={editingAssignment.type || AssignmentType.ESSAY}
                            onChange={e => setEditingAssignment({ ...editingAssignment, type: e.target.value as AssignmentType })}
                        >
                            {Object.values(AssignmentType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select
                            className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            value={editingAssignment.priority || AssignmentPriority.MEDIUM}
                            onChange={e => setEditingAssignment({ ...editingAssignment, priority: e.target.value as AssignmentPriority })}
                        >
                            {Object.values(AssignmentPriority).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                placeholder="Subject"
                                type="text"
                                className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                value={editingAssignment.subject || ''}
                                onChange={e => setEditingAssignment({ ...editingAssignment, subject: e.target.value })}
                            />
                            <input
                                required
                                type="date"
                                className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                value={editingAssignment.deadline ? new Date(editingAssignment.deadline).toISOString().split('T')[0] : ''}
                                onChange={e => setEditingAssignment({ ...editingAssignment, deadline: new Date(e.target.value).toISOString() })}
                            />
                        </div>
                        <input
                            placeholder="Google Drive / Dropbox Link (Optional)"
                            type="url"
                            className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            value={editingAssignment.documentLink || ''}
                            onChange={e => setEditingAssignment({ ...editingAssignment, documentLink: e.target.value })}
                        />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl">
                        <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-3">Pricing Calculator</h4>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <input
                                placeholder="Words"
                                type="number"
                                className="w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                value={editingAssignment.wordCount || ''}
                                onChange={e => setEditingAssignment({ ...editingAssignment, wordCount: Number(e.target.value) })}
                            />
                            <input
                                placeholder="Rate/word"
                                type="number"
                                step="0.1"
                                className="w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                value={editingAssignment.costPerWord || ''}
                                onChange={e => setEditingAssignment({ ...editingAssignment, costPerWord: Number(e.target.value) })}
                            />
                            <div className="flex items-center justify-center bg-blue-50 rounded-xl text-blue-600 font-bold text-sm">
                                {formatCurrency((editingAssignment.wordCount || 0) * (editingAssignment.costPerWord || 0))}
                            </div>
                        </div>

                        <h4 className="font-semibold text-xs text-green-600 uppercase tracking-wider mb-3">Incoming (Student)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                <input
                                    placeholder="Total Price"
                                    type="number"
                                    className="w-full bg-white border-none rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                    value={editingAssignment.price || ''}
                                    onChange={e => setEditingAssignment({ ...editingAssignment, price: Number(e.target.value) })}
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                <input
                                    placeholder="Paid"
                                    type="number"
                                    className="w-full bg-white border-none rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                    value={editingAssignment.paidAmount || 0}
                                    onChange={e => setEditingAssignment({ ...editingAssignment, paidAmount: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-xs text-red-600 uppercase tracking-wider">Outgoing (Writer)</h4>
                            {editingAssignment.writerId && !isReassigning && (
                                <button
                                    type="button"
                                    onClick={() => setIsReassigning(true)}
                                    className="text-[10px] font-bold text-red-500 bg-red-100 px-2 py-1 rounded hover:bg-red-200 transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Reassign / Abandon
                                </button>
                            )}
                        </div>

                        {isReassigning ? (
                            <div className="bg-red-100/50 p-3 rounded-xl border border-red-200 mb-3 animate-in fade-in slide-in-from-top-2">
                                <p className="text-xs text-red-800 font-medium mb-2">Reassign Writer?</p>
                                <p className="text-[10px] text-red-600 mb-3">
                                    This will move the currently paid amount <strong>({formatCurrency(editingAssignment.writerPaidAmount || 0)})</strong> to "Sunk Costs" (non-recoverable) and reset the writer balance to 0 for the new writer.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleReassignWriter}
                                        className="flex-1 bg-red-600 text-white text-xs py-1.5 rounded-lg font-bold shadow-sm"
                                    >
                                        Confirm Reassign
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsReassigning(false)}
                                        className="flex-1 bg-white text-slate-600 text-xs py-1.5 rounded-lg font-bold border border-slate-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-3">
                                {isAddingWriter ? (
                                    <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                                        <input
                                            autoFocus
                                            placeholder="New Writer Name"
                                            className="w-full bg-white border-red-200 border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                            value={newWriterName}
                                            onChange={e => setNewWriterName(e.target.value)}
                                        />
                                        <button type="button" onClick={handleQuickAddWriter} className="bg-red-600 text-white rounded-xl px-3 text-sm font-bold">✓</button>
                                        <button type="button" onClick={() => setIsAddingWriter(false)} className="bg-slate-200 text-slate-500 rounded-xl px-3 text-sm">✕</button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <select
                                            className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                            value={editingAssignment.writerId || ''}
                                            onChange={e => setEditingAssignment({ ...editingAssignment, writerId: e.target.value })}
                                        >
                                            <option value="">Select Writer (Optional)</option>
                                            {writers.map(w => <option key={w.id} value={w.id}>{w.name} {w.isFlagged && '🚩'}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingWriter(true)}
                                            className="bg-white hover:bg-slate-100 text-slate-500 rounded-xl px-3 transition-colors shadow-sm"
                                            title="Add New Writer"
                                        >
                                            +
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="col-span-2">
                                <label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Writer Rate / Word</label>
                                <input
                                    placeholder="Rate"
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 mt-1"
                                    value={editingAssignment.writerCostPerWord || ''}
                                    onChange={e => setEditingAssignment({ ...editingAssignment, writerCostPerWord: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold ml-1">Sunk Cost</label>
                                <div className="bg-white/50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-400 font-medium mt-1">
                                    {formatCurrency(editingAssignment.sunkCosts || 0)}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                <input
                                    placeholder="Writer Fee"
                                    type="number"
                                    className="w-full bg-white border-none rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                    value={editingAssignment.writerPrice || ''}
                                    onChange={e => setEditingAssignment({ ...editingAssignment, writerPrice: Number(e.target.value) })}
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                <input
                                    placeholder="Paid to Writer"
                                    type="number"
                                    className="w-full bg-white border-none rounded-xl pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                                    value={editingAssignment.writerPaidAmount || 0}
                                    onChange={e => setEditingAssignment({ ...editingAssignment, writerPaidAmount: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    {editingAssignment.type === AssignmentType.DISSERTATION && (
                        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100/50">
                            <h4 className="font-semibold text-purple-900 mb-2 text-sm">Dissertation Chapters</h4>
                            <input
                                type="number"
                                placeholder="Total Chapters"
                                className="w-full bg-white border-none rounded-xl px-4 py-2 mb-3 text-sm"
                                value={editingAssignment.totalChapters || 5}
                                onChange={e => setEditingAssignment({ ...editingAssignment, totalChapters: Number(e.target.value) })}
                            />
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        {editingAssignment.id && (
                            <button type="button" onClick={() => { setIsModalOpen(false); handleDelete(editingAssignment.id!); }} className="text-danger text-sm font-medium px-2">
                                Delete
                            </button>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* --- RATING MODAL --- */}
            <Modal isOpen={isRatingModalOpen} onClose={() => setIsRatingModalOpen(false)} title="Rate Writer Performance">
                <div className="text-center">
                    <p className="text-slate-500 mb-6">Task completed! How did the writer perform?</p>

                    <div className="space-y-6 mb-8">
                        <div>
                            <p className="font-bold text-slate-700 mb-2">Quality of Work</p>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} onClick={() => setRatingStats({ ...ratingStats, quality: star })} className={`text-3xl transition-transform hover:scale-110 ${ratingStats.quality >= star ? 'text-yellow-400' : 'text-slate-200'}`}>★</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 mb-2">Punctuality</p>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} onClick={() => setRatingStats({ ...ratingStats, punctuality: star })} className={`text-3xl transition-transform hover:scale-110 ${ratingStats.punctuality >= star ? 'text-blue-400' : 'text-slate-200'}`}>★</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={() => setIsRatingModalOpen(false)}>Skip</Button>
                        <Button className="flex-1" onClick={handleSubmitRating}>Submit Rating</Button>
                    </div>
                </div>
            </Modal>

            {/* --- DELETE CONFIRMATION MODAL --- */}
            <Modal isOpen={deleteConfig.isOpen} onClose={() => setDeleteConfig({ ...deleteConfig, isOpen: false })} title="Confirm Deletion">
                <div className="space-y-4">
                    <p className="text-slate-600">
                        {deleteConfig.type === 'single'
                            ? "Are you sure you want to delete this assignment? This action cannot be undone."
                            : `Are you sure you want to delete ${selectedIds.size} assignments? This action cannot be undone.`
                        }
                    </p>
                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setDeleteConfig({ ...deleteConfig, isOpen: false })}>Cancel</Button>
                        <Button variant="danger" onClick={executeDelete}>Delete Permanently</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AssignmentsView;