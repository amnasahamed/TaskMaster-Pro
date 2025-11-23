import React, { useState, useEffect } from 'react';
import { Writer, Assignment, AssignmentStatus } from '../types';
import * as DataService from '../services/dataService';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { useToast } from './Layout';

const WritersView: React.FC = () => {
    const { addToast } = useToast();
    const [writers, setWriters] = useState<Writer[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);

    // Mobile Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWriter, setEditingWriter] = useState<Partial<Writer>>({});
    const [historyWriter, setHistoryWriter] = useState<Writer | null>(null);

    // Desktop Split View State
    const [selectedWriterId, setSelectedWriterId] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('name');

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        setWriters(await DataService.getWriters());
        setAssignments(await DataService.getAssignments());
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWriter.name) return;
        const saved = await DataService.saveWriter(editingWriter as Writer);
        setIsModalOpen(false);
        setEditingWriter({});
        refreshData();
        setSelectedWriterId(saved.id);
        addToast('Writer saved', 'success');
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this writer?')) {
            await DataService.deleteWriter(id);
            refreshData();
            if (selectedWriterId === id) setSelectedWriterId(null);
            addToast('Writer deleted', 'error');
        }
    };

    const getWriterAssignments = (writerId: string) => assignments.filter(a => a.writerId === writerId);

    // Filter and Sort Logic
    const filteredWriters = writers.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        switch (sortOption) {
            case 'quality':
                return (b.rating?.quality || 0) - (a.rating?.quality || 0);
            case 'punctuality':
                return (b.rating?.punctuality || 0) - (a.rating?.punctuality || 0);
            case 'pending':
                const getPending = (wid: string) => assignments
                    .filter(ass => ass.writerId === wid)
                    .reduce((sum, curr) => sum + ((curr.writerPrice || 0) - (curr.writerPaidAmount || 0)), 0);
                return getPending(b.id) - getPending(a.id);
            case 'active':
                const getActive = (wid: string) => assignments
                    .filter(ass => ass.writerId === wid && ass.status === AssignmentStatus.IN_PROGRESS).length;
                return getActive(b.id) - getActive(a.id);
            case 'name':
            default:
                return a.name.localeCompare(b.name);
        }
    });

    const WriterDetails: React.FC<{ writer: Writer }> = ({ writer }) => {
        const writerAssignments = getWriterAssignments(writer.id);
        const pending = writerAssignments.filter(a => a.status !== AssignmentStatus.COMPLETED && a.status !== AssignmentStatus.CANCELLED);
        const completed = writerAssignments.filter(a => a.status === AssignmentStatus.COMPLETED);

        const openWhatsApp = (number: string) => {
            const cleanNum = number.replace(/[^0-9]/g, '');
            window.open(`https://wa.me/${cleanNum}`, '_blank');
        };

        // Rating rendering
        const renderStars = (score: number) => {
            return (
                <div className="flex text-yellow-400 text-xs">
                    {[1, 2, 3, 4, 5].map(i => (
                        <span key={i} className={i <= Math.round(score) ? 'opacity-100' : 'opacity-30'}>★</span>
                    ))}
                </div>
            );
        };

        const AssignmentItem: React.FC<{ a: Assignment }> = ({ a }) => (
            <div className="border-b border-slate-100 last:border-0 py-3 flex justify-between items-center hover:bg-slate-50/50 transition-colors px-2 -mx-2 rounded-lg">
                <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-900 text-sm truncate">{a.title}</h4>
                        {a.status === AssignmentStatus.IN_PROGRESS && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                    </div>
                    <div className="flex gap-2 text-[10px] text-slate-500">
                        <span className="bg-slate-100 px-1.5 rounded">{a.type}</span>
                        <span>Due: {new Date(a.deadline).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={(a.writerPrice || 0) - (a.writerPaidAmount || 0) > 0 ? "text-red-600 font-bold text-xs" : "text-green-600 font-bold text-xs"}>
                        {(a.writerPrice || 0) - (a.writerPaidAmount || 0) > 0 ? formatCurrency((a.writerPrice || 0) - (a.writerPaidAmount || 0)) : 'Settled'}
                    </span>
                    {(a.writerPrice || 0) - (a.writerPaidAmount || 0) > 0 && <p className="text-[9px] text-slate-400 uppercase mt-0.5">Due</p>}
                </div>
            </div>
        );

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-slate-900">{writer.name}</h2>
                            {writer.isFlagged && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200">FLAGGED</span>}
                        </div>
                        <p className="text-slate-500">{writer.specialty || 'Generalist'}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => openWhatsApp(writer.contact)}
                            className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors"
                            title="Chat on WhatsApp"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => {
                                setHistoryWriter(null); // Close view modal to avoid mess
                                setEditingWriter(writer);
                                setIsModalOpen(true);
                            }}
                            className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(writer.id)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>

                {/* Performance Card */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">Quality</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-800">{writer.rating?.quality || 'N/A'}</span>
                            {writer.rating && renderStars(writer.rating.quality)}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">Punctuality</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-800">{writer.rating?.punctuality || 'N/A'}</span>
                            {writer.rating && renderStars(writer.rating.punctuality)}
                        </div>
                    </div>
                </div>

                {writer.isFlagged && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <div>
                            <p className="text-sm font-bold text-red-700">Flagged Writer</p>
                            <p className="text-xs text-red-600">Marked for abandonment or quality issues.</p>
                        </div>
                    </div>
                )}

                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Active Tasks</h4>
                        <span className="bg-blue-200 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{pending.length}</span>
                    </div>
                    {pending.length > 0 ? (
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-blue-100/50">
                            {pending.map(a => <AssignmentItem key={a.id} a={a} />)}
                        </div>
                    ) : <p className="text-xs text-blue-400 italic">No active assignments.</p>}
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assignment History</h4>
                        <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{completed.length}</span>
                    </div>
                    {completed.length > 0 ? (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            {completed.map(a => <AssignmentItem key={a.id} a={a} />)}
                        </div>
                    ) : <p className="text-xs text-slate-400 italic px-1">No completed assignments.</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Search writers..."
                            className="w-full bg-slate-200/50 border-none rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            className="bg-slate-200/50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 cursor-pointer flex-1 sm:flex-none text-slate-700 font-medium"
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                        >
                            <option value="name">Sort: Name</option>
                            <option value="quality">Sort: Quality</option>
                            <option value="punctuality">Sort: Punctuality</option>
                            <option value="pending">Sort: Pending Pay</option>
                            <option value="active">Sort: Active Tasks</option>
                        </select>
                        <Button onClick={() => { setEditingWriter({}); setIsModalOpen(true); }} className="whitespace-nowrap">
                            New
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[500px]">
                {/* Writer List (Left Panel) */}
                <div className="bg-white rounded-2xl shadow-ios overflow-hidden flex flex-col h-full lg:col-span-1">
                    <div className="overflow-y-auto flex-1 no-scrollbar">
                        {filteredWriters.map((writer, index) => {
                            const writerAssignments = getWriterAssignments(writer.id);
                            const active = writerAssignments.filter(a => a.status === AssignmentStatus.IN_PROGRESS).length;
                            const totalPaid = writerAssignments.reduce((acc, curr) => acc + (curr.writerPaidAmount || 0), 0);
                            const totalFee = writerAssignments.reduce((acc, curr) => acc + (curr.writerPrice || 0), 0);
                            const pendingPay = totalFee - totalPaid;
                            const isSelected = selectedWriterId === writer.id;

                            return (
                                <div
                                    key={writer.id}
                                    className={`p-4 flex items-center justify-between transition-colors cursor-pointer border-b border-slate-50 ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                                    onClick={() => {
                                        setSelectedWriterId(writer.id);
                                        if (window.innerWidth < 1024) setHistoryWriter(writer);
                                    }}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {writer.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className={`font-semibold truncate flex items-center gap-2 ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                                                {writer.name}
                                                {writer.isFlagged && <span className="text-[10px] animate-pulse">🚩</span>}
                                            </h3>
                                            <div className="flex gap-2 text-xs text-slate-500">
                                                <span className="truncate">{writer.specialty || 'Generalist'}</span>
                                                {active > 0 && <span className="text-blue-600 font-medium whitespace-nowrap">• {active} Active</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {pendingPay > 0 && (
                                        <div className="text-right pl-2">
                                            <p className="font-semibold text-xs text-red-500">{formatCurrency(pendingPay)}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredWriters.length === 0 && (
                            <div className="p-8 text-center text-slate-400">
                                No writers found.
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail View (Right Panel) */}
                <div className="hidden lg:block lg:col-span-2 bg-white rounded-2xl shadow-ios p-6 h-full overflow-y-auto">
                    {selectedWriterId ? (
                        (() => {
                            const writer = writers.find(w => w.id === selectedWriterId);
                            return writer ? <WriterDetails writer={writer} /> : null;
                        })()
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            <p className="text-lg font-medium">Select a writer to view details</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={!!historyWriter} onClose={() => setHistoryWriter(null)} title={`${historyWriter?.name || 'Writer'}'s Profile`}>
                {historyWriter && <WriterDetails writer={historyWriter} />}
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingWriter.id ? "Edit Writer" : "New Writer"}>
                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Profile</label>
                        <div className="space-y-3">
                            <input required placeholder="Writer Name" type="text" className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all" value={editingWriter.name || ''} onChange={e => setEditingWriter({ ...editingWriter, name: e.target.value })} />
                            <input required placeholder="Mobile Number" type="tel" className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all" value={editingWriter.contact || ''} onChange={e => setEditingWriter({ ...editingWriter, contact: e.target.value })} />
                            <input placeholder="Specialty (e.g. Law, Nursing)" type="text" className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all" value={editingWriter.specialty || ''} onChange={e => setEditingWriter({ ...editingWriter, specialty: e.target.value })} />

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase ml-1">Quality (0-5)</label>
                                    <input
                                        type="number" step="0.1" min="0" max="5"
                                        className="w-full bg-slate-100 border-none rounded-xl px-4 py-2 mt-1 focus:ring-2 focus:ring-primary/20"
                                        value={editingWriter.rating?.quality ?? 5.0}
                                        onChange={e => setEditingWriter({
                                            ...editingWriter,
                                            rating: {
                                                count: editingWriter.rating?.count || 1,
                                                punctuality: editingWriter.rating?.punctuality || 5.0,
                                                quality: Number(e.target.value)
                                            }
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase ml-1">Punctuality (0-5)</label>
                                    <input
                                        type="number" step="0.1" min="0" max="5"
                                        className="w-full bg-slate-100 border-none rounded-xl px-4 py-2 mt-1 focus:ring-2 focus:ring-primary/20"
                                        value={editingWriter.rating?.punctuality ?? 5.0}
                                        onChange={e => setEditingWriter({
                                            ...editingWriter,
                                            rating: {
                                                count: editingWriter.rating?.count || 1,
                                                quality: editingWriter.rating?.quality || 5.0,
                                                punctuality: Number(e.target.value)
                                            }
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100 mt-2">
                                <input
                                    type="checkbox"
                                    id="flagWriter"
                                    className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
                                    checked={editingWriter.isFlagged || false}
                                    onChange={e => setEditingWriter({ ...editingWriter, isFlagged: e.target.checked })}
                                />
                                <label htmlFor="flagWriter" className="text-sm font-bold text-red-700">Flag Writer (Ghosting/Poor Quality)</label>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        {editingWriter.id && (
                            <Button type="button" variant="danger" size="sm" onClick={() => { setIsModalOpen(false); handleDelete(editingWriter.id!); }}>Delete</Button>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit">Save Writer</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default WritersView;