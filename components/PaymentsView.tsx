import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Assignment, Student, Writer } from '../types';
import * as DataService from '../services/dataService';
import Card from './ui/Card';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { useToast } from './Layout';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    AreaChart, Area, ScatterChart, Scatter, ZAxis,
    RadialBarChart, RadialBar, Legend,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

type PaymentType = 'incoming' | 'outgoing' | 'finance';

const PaymentsView: React.FC = () => {
    const { addToast } = useToast();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<PaymentType>('incoming');
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [writers, setWriters] = useState<Writer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [isEditMode, setIsEditMode] = useState(false);

    // Chart Data State
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [subjectData, setSubjectData] = useState<any[]>([]);
    const [seasonalityData, setSeasonalityData] = useState<any[]>([]);
    const [topStudentsData, setTopStudentsData] = useState<any[]>([]);
    const [writerMatrixData, setWriterMatrixData] = useState<any[]>([]);
    const [referralData, setReferralData] = useState<any[]>([]);
    const [referralScatterData, setReferralScatterData] = useState<any[]>([]);

    useEffect(() => {
        refreshData();

        // Handle Deep Linking
        if (location.state) {
            const state = location.state as any;
            if (state.tab) setActiveTab(state.tab);
        }
    }, [location.state]);

    const refreshData = async () => {
        const data = await DataService.getAssignments();
        const studentList = await DataService.getStudents();
        const writerList = await DataService.getWriters();

        setAssignments(data);
        setStudents(studentList);
        setWriters(writerList);
        calculateFinanceData(data, studentList, writerList);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#FF3B30'];

    const calculateFinanceData = (data: Assignment[], studentList: Student[], writerList: Writer[]) => {
        // 1. Monthly Data (Chronological)
        const months: Record<string, { name: string, revenue: number, cost: number, profit: number, date: number }> = {};
        const seasonal: Record<number, number> = {};

        data.forEach(a => {
            const date = new Date(a.createdAt || new Date().toISOString());
            const key = `${date.getMonth()}-${date.getFullYear()}`;
            const name = date.toLocaleString('default', { month: 'short', year: '2-digit' });

            if (!months[key]) {
                months[key] = { name, revenue: 0, cost: 0, profit: 0, date: date.getTime() };
            }

            const rev = a.price || 0;
            const cost = (a.writerPrice || 0) + (a.sunkCosts || 0);

            months[key].revenue += rev;
            months[key].cost += cost;
            months[key].profit += (rev - cost);

            const monthIndex = date.getMonth();
            seasonal[monthIndex] = (seasonal[monthIndex] || 0) + 1;
        });

        setMonthlyData(Object.values(months).sort((a, b) => a.date - b.date).slice(-6));

        // 2. Subject Profit Data (Radar)
        const subjects: Record<string, number> = {};
        let maxSubjectVal = 0;
        data.forEach(a => {
            const cost = (a.writerPrice || 0) + (a.sunkCosts || 0);
            const profit = (a.price || 0) - cost;
            if (profit > 0) subjects[a.subject] = (subjects[a.subject] || 0) + profit;
        });

        const subjectArr = Object.keys(subjects)
            .map(key => {
                if (subjects[key] > maxSubjectVal) maxSubjectVal = subjects[key];
                return { subject: key, A: subjects[key], fullMark: maxSubjectVal };
            })
            .sort((a, b) => b.A - a.A)
            .slice(0, 6); // Top 6 for Radar

        // Normalize fullMark
        const finalSubjectData = subjectArr.map(s => ({ ...s, fullMark: maxSubjectVal }));
        setSubjectData(finalSubjectData);

        // 3. Seasonality
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        setSeasonalityData(monthNames.map((name, index) => ({ name, jobs: seasonal[index] || 0 })));

        // 4. Top Students (Radial Bar)
        const studentSpend: Record<string, number> = {};
        data.forEach(a => {
            studentSpend[a.studentId] = (studentSpend[a.studentId] || 0) + a.price;
        });

        const topS = Object.keys(studentSpend).map((sid, index) => {
            const s = studentList.find(st => st.id === sid);
            return {
                name: s?.name || 'Unknown',
                value: studentSpend[sid],
                fill: COLORS[index % COLORS.length] // Assign color for RadialBar
            };
        }).sort((a, b) => b.value - a.value).slice(0, 5);
        setTopStudentsData(topS);

        // 5. Writer Matrix (Cost vs Quality vs Volume)
        const matrix = writerList.map(w => {
            const wAssignments = data.filter(a => a.writerId === w.id);
            const volume = wAssignments.length;
            if (volume === 0) return null;

            const avgCost = wAssignments.reduce((acc, curr) => acc + (curr.writerCostPerWord || 0), 0) / volume;
            const rating = w.rating?.quality || 0;

            return {
                name: w.name,
                x: Number(avgCost.toFixed(2)),
                y: rating,
                z: volume
            };
        }).filter(Boolean);
        setWriterMatrixData(matrix);

        // 6. Referral Network (Scatter)
        const referralMap: Record<string, { name: string, count: number, value: number }> = {};
        studentList.forEach(s => { referralMap[s.id] = { name: s.name, count: 0, value: 0 }; });

        data.forEach(a => {
            const student = studentList.find(s => s.id === a.studentId);
            if (student && student.referredBy && referralMap[student.referredBy]) {
                referralMap[student.referredBy].value += a.price;
            }
        });
        studentList.forEach(s => {
            if (s.referredBy && referralMap[s.referredBy]) {
                referralMap[s.referredBy].count += 1;
            }
        });

        const referrals = Object.values(referralMap)
            .filter(r => r.count > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        setReferralData(referrals);

        // Scatter Data Preparation
        // X: Count, Y: Value, Z: Avg Value
        const refScatter = Object.values(referralMap)
            .filter(r => r.count > 0)
            .map(r => ({
                name: r.name,
                x: r.count,
                y: r.value,
                z: Math.round(r.value / r.count) // Avg Value per referral
            }));
        setReferralScatterData(refScatter);
    };

    const openPaymentModal = (assignment: Assignment, editMode: boolean = false) => {
        setSelectedAssignment(assignment);
        setIsEditMode(editMode);

        if (editMode) {
            if (activeTab === 'incoming') {
                setPaymentAmount(assignment.paidAmount);
            } else {
                setPaymentAmount(assignment.writerPaidAmount || 0);
            }
        } else {
            if (activeTab === 'incoming') {
                const remaining = assignment.price - assignment.paidAmount;
                setPaymentAmount(remaining > 0 ? remaining : 0);
            } else {
                const remaining = (assignment.writerPrice || 0) - (assignment.writerPaidAmount || 0);
                setPaymentAmount(remaining > 0 ? remaining : 0);
            }
        }

        setIsModalOpen(true);
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAssignment) return;

        let updatedAssignment: Assignment;
        const amount = Number(paymentAmount);

        if (activeTab === 'incoming') {
            updatedAssignment = {
                ...selectedAssignment,
                paidAmount: isEditMode ? amount : selectedAssignment.paidAmount + amount
            };
        } else {
            updatedAssignment = {
                ...selectedAssignment,
                writerPaidAmount: isEditMode ? amount : (selectedAssignment.writerPaidAmount || 0) + amount
            };
        }

        await DataService.saveAssignment(updatedAssignment);
        setIsModalOpen(false);
        setSelectedAssignment(null);
        refreshData();
        addToast('Transaction recorded successfully', 'success');
    };

    const totalRevenue = assignments.reduce((sum, a) => sum + a.price, 0);
    const totalCost = assignments.reduce((sum, a) => sum + (a.writerPrice || 0) + (a.sunkCosts || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const totalSunk = assignments.reduce((sum, a) => sum + (a.sunkCosts || 0), 0);

    const totalStudentDue = assignments.reduce((sum, a) => sum + (a.price - a.paidAmount), 0);
    const totalWriterDue = assignments.reduce((sum, a) => sum + ((a.writerPrice || 0) - (a.writerPaidAmount || 0)), 0);

    const filteredAssignments = (activeTab === 'incoming'
        ? assignments.filter(a => a.price > 0)
        : assignments.filter(a => (a.writerPrice || 0) > 0)
    ).filter(a => {
        const student = students.find(s => s.id === a.studentId);
        const writer = writers.find(w => w.id === a.writerId);
        const entityName = activeTab === 'incoming' ? student?.name : writer?.name;

        return a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entityName && entityName.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    const calculateStats = () => {
        if (activeTab === 'incoming') {
            const total = filteredAssignments.reduce((sum, a) => sum + a.price, 0);
            const paid = filteredAssignments.reduce((sum, a) => sum + a.paidAmount, 0);
            return { total, paid, pending: total - paid, labelTotal: 'Total Receivable', labelPaid: 'Received', labelPending: 'Pending' };
        } else if (activeTab === 'outgoing') {
            const total = filteredAssignments.reduce((sum, a) => sum + (a.writerPrice || 0), 0);
            const paid = filteredAssignments.reduce((sum, a) => sum + (a.writerPaidAmount || 0), 0);
            return { total, paid, pending: total - paid, labelTotal: 'Total Payable', labelPaid: 'Paid', labelPending: 'To Pay' };
        }
        return { total: 0, paid: 0, pending: 0, labelTotal: '', labelPaid: '', labelPending: '' };
    };

    const stats = calculateStats();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                {/* iOS Style Segmented Control */}
                <div className="bg-slate-200/50 p-1 rounded-xl flex font-medium text-sm relative">
                    <button
                        onClick={() => setActiveTab('incoming')}
                        className={`flex-1 py-1.5 rounded-lg transition-all duration-200 ${activeTab === 'incoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Incoming
                    </button>
                    <button
                        onClick={() => setActiveTab('outgoing')}
                        className={`flex-1 py-1.5 rounded-lg transition-all duration-200 ${activeTab === 'outgoing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Outgoing
                    </button>
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={`flex-1 py-1.5 rounded-lg transition-all duration-200 ${activeTab === 'finance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Reports
                    </button>
                </div>
            </div>

            {activeTab === 'finance' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    {/* KPI Cards (Always Visible) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20">
                            <p className="text-xs font-semibold opacity-70 mb-1 uppercase">Net Profit</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalProfit)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-ios border border-slate-50">
                            <p className="text-xs font-semibold text-slate-400 mb-1 uppercase">Margin</p>
                            <p className="text-2xl font-bold text-slate-800">{profitMargin}%</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                            <p className="text-xs font-semibold text-orange-600 mb-1 uppercase">Collect</p>
                            <p className="text-2xl font-bold text-orange-900">{formatCurrency(totalStudentDue)}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                            <p className="text-xs font-semibold text-red-600 mb-1 uppercase">Sunk Costs</p>
                            <p className="text-2xl font-bold text-red-900">{formatCurrency(totalSunk)}</p>
                        </div>
                    </div>

                    {/* --- ANALYTICS CONSOLE (Visible on all devices) --- */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Analytics Console</h3>
                            <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        {/* ROW 1: Financial & Volume Trends */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card title="Financial Performance Trend" className="h-[360px]">
                                <div className="h-[280px] w-full mt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="revenue" name="Revenue" fill="#007AFF" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Bar dataKey="cost" name="Cost" fill="#FF3B30" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card title="Job Volume Seasonality" className="h-[360px]">
                                <div className="h-[280px] w-full mt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={seasonalityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#AF52DE" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#AF52DE" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                            <Area type="monotone" dataKey="jobs" stroke="#AF52DE" fillOpacity={1} fill="url(#colorJobs)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>

                        {/* ROW 2: Writer & Client Matrix */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card title="Writer Performance Matrix" className="h-[360px]">
                                <p className="text-[10px] text-slate-400 mb-2">Cost/Word vs Quality Rating • Size = Volume</p>
                                <div className="h-[260px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                            <CartesianGrid />
                                            <XAxis type="number" dataKey="x" name="Cost/Word" unit="₹" fontSize={11} />
                                            <YAxis type="number" dataKey="y" name="Rating" domain={[0, 5]} fontSize={11} />
                                            <ZAxis type="number" dataKey="z" range={[50, 400]} name="Volume" />
                                            <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px' }} />
                                            <Scatter name="Writers" data={writerMatrixData} fill="#007AFF" />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card title="Top 5 VIP Clients (Lifetime Value)" className="h-[360px]">
                                <p className="text-[10px] text-slate-400 mb-1">Rings indicate contribution relative to top earner</p>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadialBarChart
                                            innerRadius="10%"
                                            outerRadius="90%"
                                            data={topStudentsData}
                                            startAngle={180}
                                            endAngle={0}
                                        >
                                            <RadialBar
                                                label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 'bold' }}
                                                background
                                                dataKey="value"
                                                cornerRadius={10}
                                            />
                                            <Legend
                                                iconSize={10}
                                                width={120}
                                                height={140}
                                                layout="vertical"
                                                verticalAlign="middle"
                                                align="right"
                                                wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
                                            />
                                            <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                                        </RadialBarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>

                        {/* ROW 3: Subject Profitability & Referral Network */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card title="Business Shape (Subject Mix)" className="h-[360px]">
                                <p className="text-[10px] text-slate-400 mb-1">Profit distribution across subjects</p>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={subjectData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                                            <Radar
                                                name="Profit"
                                                dataKey="A"
                                                stroke="#AF52DE"
                                                fill="#AF52DE"
                                                fillOpacity={0.6}
                                            />
                                            <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card title="Referral Network Impact" className="h-[360px]">
                                <p className="text-[10px] text-slate-400 mb-2">Impact Analysis: Volume (X) vs Revenue (Y) vs Avg Value (Size)</p>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" dataKey="x" name="Referrals Made" fontSize={11} />
                                            <YAxis type="number" dataKey="y" name="Network Revenue" unit="₹" fontSize={11} />
                                            <ZAxis type="number" dataKey="z" range={[60, 600]} name="Avg Value" unit="₹" />
                                            <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px' }} />
                                            <Scatter name="Referrers" data={referralScatterData} fill="#8B5CF6" shape="circle" />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-left duration-300">
                    {/* Stats Strip */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-2xl shadow-ios text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{stats.labelTotal}</p>
                            <p className="text-lg font-bold text-slate-800">{formatCurrency(stats.total)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl shadow-ios text-center">
                            <p className="text-[10px] text-green-500 uppercase font-bold tracking-wide">{stats.labelPaid}</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.paid)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl shadow-ios text-center">
                            <p className="text-[10px] text-red-500 uppercase font-bold tracking-wide">{stats.labelPending}</p>
                            <p className="text-lg font-bold text-red-600">{formatCurrency(stats.pending)}</p>
                        </div>
                    </div>

                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder={`Search ${activeTab === 'incoming' ? 'students' : 'writers'} or tasks...`}
                            className="w-full bg-slate-200/50 border-none rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="bg-white rounded-2xl shadow-ios overflow-hidden">
                        {filteredAssignments.map((assignment, idx) => {
                            const student = students.find(s => s.id === assignment.studentId);
                            const writer = writers.find(w => w.id === assignment.writerId);

                            let total = 0, paid = 0, due = 0, entityName = '';

                            if (activeTab === 'incoming') {
                                total = assignment.price;
                                paid = assignment.paidAmount;
                                due = total - paid;
                                entityName = student?.name || 'Unknown Student';
                            } else {
                                total = assignment.writerPrice || 0;
                                paid = assignment.writerPaidAmount || 0;
                                due = total - paid;
                                entityName = writer?.name || 'Unassigned Writer';
                            }

                            const isFullyPaid = due <= 0;

                            return (
                                <div key={assignment.id} className={`p-4 ${idx !== filteredAssignments.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 text-sm">{assignment.title}</h3>
                                            <p className="text-xs text-slate-500">{entityName}</p>
                                        </div>
                                        <div className="text-right">
                                            {isFullyPaid ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="font-bold text-red-500 text-sm">
                                                    {formatCurrency(due)} Due
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min((paid / (total || 1)) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium uppercase">
                                                <span>{formatCurrency(paid)} Paid</span>
                                                <span>{formatCurrency(total)} Total</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openPaymentModal(assignment, true)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-primary transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            {!isFullyPaid && (
                                                <Button size="sm" onClick={() => openPaymentModal(assignment, false)}>
                                                    {activeTab === 'incoming' ? 'Receive' : 'Pay'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {filteredAssignments.length === 0 && (
                            <div className="p-8 text-center text-slate-400">
                                No pending payments found.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={
                isEditMode
                    ? "Correct Payment"
                    : (activeTab === 'incoming' ? "Receive Payment" : "Make Payment")
            }>
                <form onSubmit={handlePayment} className="space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                            {activeTab === 'incoming' ? 'From Student' : 'To Writer'}
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">{selectedAssignment?.title}</h3>

                        <div className="inline-block bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                            <p className="text-xs text-slate-400 uppercase font-bold">Current Balance</p>
                            {activeTab === 'incoming' ? (
                                <div className="flex items-baseline gap-1 justify-center">
                                    <span className="text-2xl font-bold text-slate-800">{formatCurrency(selectedAssignment?.paidAmount || 0)}</span>
                                    <span className="text-sm text-slate-400">/ {formatCurrency(selectedAssignment?.price || 0)}</span>
                                </div>
                            ) : (
                                <div className="flex items-baseline gap-1 justify-center">
                                    <span className="text-2xl font-bold text-slate-800">{formatCurrency(selectedAssignment?.writerPaidAmount || 0)}</span>
                                    <span className="text-sm text-slate-400">/ {formatCurrency(selectedAssignment?.writerPrice || 0)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">
                            {isEditMode ? 'New Total Paid Amount' : 'Amount Transaction'}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                required
                                autoFocus
                                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(Number(e.target.value))}
                            />
                            {!isEditMode && (
                                <Button type="button" variant="secondary" onClick={() => {
                                    if (!selectedAssignment) return;
                                    if (activeTab === 'incoming') {
                                        setPaymentAmount(selectedAssignment.price - selectedAssignment.paidAmount);
                                    } else {
                                        setPaymentAmount((selectedAssignment.writerPrice || 0) - (selectedAssignment.writerPaidAmount || 0));
                                    }
                                }}>Max</Button>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant={isEditMode ? "secondary" : "primary"}>
                            {isEditMode ? 'Update' : 'Confirm'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PaymentsView;