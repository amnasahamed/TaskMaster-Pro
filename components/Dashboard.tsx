import React, { useEffect, useState } from 'react';
import { getDashboardStats, getAssignments } from '../services/dataService';
import { Assignment, AssignmentStatus, AssignmentPriority } from '../types';
import Card from './ui/Card';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalPending: 0, totalOverdue: 0, pendingAmount: 0, pendingWriterPay: 0, activeDissertations: 0 });
    const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
    const [statusData, setStatusData] = useState<any[]>([]);
    const [calendarAssignments, setCalendarAssignments] = useState<Assignment[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());

    // Today's Financials
    const [todaysFinancials, setTodaysFinancials] = useState({ earned: 0, paid: 0 });

    // Calendar Modal State
    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedDayAssignments, setSelectedDayAssignments] = useState<Assignment[]>([]);

    useEffect(() => {
        // Request notification permission on mount
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        const refresh = async () => {
            const allAssignments = await getAssignments();
            setStats(await getDashboardStats());
            setCalendarAssignments(allAssignments);

            // Calculate Today's Financials (Mock: Assuming createdAt is used, but ideally we need transaction dates. 
            // For now, let's use a simple approximation based on tasks created today or deadlines today for demo, 
            // OR calculate if we had a proper transaction log. Since we don't, I'll check deadlines today as "Potential Revenue")
            const todayStr = new Date().toDateString();
            const tasksDueToday = allAssignments.filter(a => new Date(a.deadline).toDateString() === todayStr);
            const revenuePotential = tasksDueToday.reduce((sum, a) => sum + (a.price - a.paidAmount), 0);
            // This is imperfect but gives a sense of "Today's Pulse"
            setTodaysFinancials({ earned: revenuePotential, paid: 0 });

            // Get Upcoming Deadlines
            const active = allAssignments.filter(a =>
                a.status !== AssignmentStatus.COMPLETED &&
                a.status !== AssignmentStatus.CANCELLED
            );
            const sorted = active.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
            setUpcomingAssignments(sorted.slice(0, 5));

            // Browser Notification Logic
            if ('Notification' in window && Notification.permission === 'granted') {
                active.forEach(a => {
                    const timeDiff = new Date(a.deadline).getTime() - new Date().getTime();
                    const hoursDiff = timeDiff / (1000 * 3600);
                    if (hoursDiff > 0 && hoursDiff < 24 && !sessionStorage.getItem(`notified-${a.id}`)) {
                        new Notification("Deadline Approaching!", {
                            body: `${a.title} is due in ${Math.round(hoursDiff)} hours.`,
                            icon: '/favicon.ico'
                        });
                        sessionStorage.setItem(`notified-${a.id}`, 'true');
                    }
                });
            }

            // Get Status Distribution
            const counts: Record<string, number> = {};
            allAssignments.forEach(a => {
                counts[a.status] = (counts[a.status] || 0) + 1;
            });

            const pData = Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
            setStatusData(pData);
        };

        refresh();
        const interval = setInterval(refresh, 60000); // Refresh every minute for countdowns
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const getPriorityColor = (priority: AssignmentPriority) => {
        switch (priority) {
            case AssignmentPriority.HIGH: return 'text-red-600 bg-red-100';
            case AssignmentPriority.MEDIUM: return 'text-yellow-600 bg-yellow-100';
            case AssignmentPriority.LOW: return 'text-green-600 bg-green-100';
            default: return 'text-slate-600 bg-slate-100';
        }
    };

    const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#8E8E93'];

    // Navigate with filters (Deep Linking)
    const goToPending = () => navigate('/assignments', { state: { filterStatus: AssignmentStatus.IN_PROGRESS } });
    const goToOverdue = () => navigate('/assignments', { state: { filterSpecial: 'overdue' } });
    const goToIncoming = () => navigate('/payments', { state: { tab: 'incoming' } });
    const goToOutgoing = () => navigate('/payments', { state: { tab: 'outgoing' } });

    // Calendar Logic
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const handleDayClick = (assignments: Assignment[], date: Date) => {
        setSelectedDayAssignments(assignments);
        setSelectedDate(date);
        setIsDayModalOpen(true);
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        // Empty cells for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-10 md:h-24 bg-slate-50/50 border border-slate-100 rounded-lg"></div>);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
            const dateStr = dateObj.toDateString();
            const daysAssignments = calendarAssignments.filter(a => new Date(a.deadline).toDateString() === dateStr && a.status !== AssignmentStatus.COMPLETED);
            const isToday = new Date().toDateString() === dateStr;

            days.push(
                <div
                    key={i}
                    onClick={() => handleDayClick(daysAssignments, dateObj)}
                    className={`h-10 md:h-24 p-1 md:p-2 border rounded-lg overflow-hidden flex flex-col gap-1 transition-all hover:shadow-md cursor-pointer ${isToday ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white border-slate-100'}`}
                >
                    <span className={`text-[10px] md:text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{i}</span>
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                        {daysAssignments.map(a => (
                            <div
                                key={a.id}
                                onClick={(e) => { e.stopPropagation(); navigate('/assignments', { state: { highlightId: a.id } }); }}
                                className="cursor-pointer hidden md:block text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded truncate border-l-2 border-red-500"
                                title={a.title}
                            >
                                {a.title}
                            </div>
                        ))}
                        {daysAssignments.length > 0 && (
                            <div className="md:hidden w-1.5 h-1.5 rounded-full bg-red-500 mx-auto mt-1"></div>
                        )}
                    </div>
                </div>
            );
        }
        return days;
    };

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    return (
        <div className="space-y-6">
            {/* Header Row with Settings */}
            <div className="flex justify-between items-center -mb-2">
                <h2 className="text-xl font-bold text-slate-800">Overview</h2>
                <button
                    onClick={() => navigate('/settings')}
                    className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-slate-600 transition-colors border border-slate-100"
                    title="Settings"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {/* Today's Pulse */}
            {todaysFinancials.earned > 0 && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wide mb-1">Potential Collection Today</p>
                            <p className="text-2xl font-bold">{formatCurrency(todaysFinancials.earned)}</p>
                        </div>
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                    </div>
                </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white hover:bg-slate-50 transition-colors cursor-pointer group" onClick={goToPending}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Pending Tasks</p>
                            <p className="text-3xl font-bold text-slate-900 group-hover:text-primary transition-colors">{stats.totalPending}</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </div>
                    </div>
                </Card>
                <Card className="bg-white hover:bg-red-50/50 transition-colors cursor-pointer group" onClick={goToOverdue}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Overdue</p>
                            <p className="text-3xl font-bold text-red-600">{stats.totalOverdue}</p>
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg text-red-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                </Card>
                <Card className="bg-white hover:bg-green-50/50 transition-colors cursor-pointer group" onClick={goToIncoming}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-1">To Collect</p>
                            <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.pendingAmount)}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">From Students</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg text-green-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                </Card>
                <Card className="bg-white hover:bg-orange-50/50 transition-colors cursor-pointer group" onClick={goToOutgoing}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">To Pay</p>
                            <p className="text-3xl font-bold text-orange-600">{formatCurrency(stats.pendingWriterPay)}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">To Writers</p>
                        </div>
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Calendar Widget */}
                    <div className="bg-white p-5 rounded-2xl shadow-ios">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">Deadlines Calendar</h3>
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded shadow-sm transition-all text-slate-600">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="text-xs font-bold w-20 text-center">{currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded shadow-sm transition-all text-slate-600">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-2 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="text-center text-[10px] uppercase font-bold text-slate-400">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 md:gap-2">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>

                {/* Sidebar Area (1/3 width) */}
                <div className="space-y-6">
                    {/* Upcoming List with Visual Alarm */}
                    <Card title="Upcoming Priority" className="h-auto">
                        <div className="space-y-1">
                            {upcomingAssignments.length > 0 ? (
                                upcomingAssignments.map((a, idx) => {
                                    const timeDiff = new Date(a.deadline).getTime() - new Date().getTime();
                                    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                    const hoursLeft = Math.ceil(timeDiff / (1000 * 3600));
                                    const isOverdue = daysLeft < 0;
                                    // Visual Alarm: < 6 hours and not overdue
                                    const isUrgent = hoursLeft > 0 && hoursLeft < 6;

                                    return (
                                        <div key={a.id} onClick={() => navigate('/assignments', { state: { highlightId: a.id } })} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors ${idx !== upcomingAssignments.length - 1 ? 'border-b border-slate-50' : ''} ${isUrgent ? 'animate-pulse bg-red-50 border-red-200 border' : ''}`}>
                                            <div className="min-w-0 pr-4">
                                                <h4 className="text-sm font-semibold text-slate-900 truncate">{a.title}</h4>
                                                <p className="text-xs text-slate-500 truncate">{a.subject}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getPriorityColor(a.priority)}`}>
                                                    {a.priority}
                                                </span>
                                                <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : isUrgent ? 'text-red-600 font-bold' : daysLeft <= 2 ? 'text-orange-500' : 'text-slate-400'}`}>
                                                    {isOverdue ? 'Overdue' : hoursLeft < 24 ? `${hoursLeft}h` : `${daysLeft}d`}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-slate-400 py-12">
                                    <p>No upcoming tasks. Enjoy your day!</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Workload Chart */}
                    <Card title="Workload" className="h-[300px]">
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Calendar Day Modal */}
            <Modal isOpen={isDayModalOpen} onClose={() => setIsDayModalOpen(false)} title={`Tasks for ${selectedDate?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}>
                <div className="space-y-3">
                    {selectedDayAssignments.length > 0 ? (
                        selectedDayAssignments.map(a => (
                            <div
                                key={a.id}
                                onClick={() => navigate('/assignments', { state: { highlightId: a.id } })}
                                className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-blue-50 transition-colors"
                            >
                                <div>
                                    <h4 className="font-semibold text-sm text-slate-900">{a.title}</h4>
                                    <p className="text-xs text-slate-500">{a.subject} • {a.type}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getPriorityColor(a.priority)}`}>
                                    {a.priority}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-sm">No deadlines scheduled for this day.</p>
                        </div>
                    )}
                    <div className="pt-2">
                        <Button variant="ghost" className="w-full" onClick={() => setIsDayModalOpen(false)}>Close</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;