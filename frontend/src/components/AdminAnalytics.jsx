// frontend/src/components/AdminAnalytics.jsx
import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell,
    ResponsiveContainer, AreaChart, Area, CartesianGrid, ComposedChart
} from 'recharts';
import TicketFilterBar from './TicketFilterBar';

const COLORS = ['#184F7E', '#F7941D', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS = { 'Open': '#F7941D', 'In Progress': '#184F7E', 'Resolved': '#10b981', 'Closed': '#6b7280', 'Decline': '#ef4444' };
const SEVERITY_COLORS = { 'High (>=10)': '#ef4444', 'Normal (<10)': '#3b82f6' };

const AdminAnalytics = ({ tickets, usersList }) => {
    const [filteredTickets, setFilteredTickets] = useState(tickets || []);

    const isLate = (ticket) => {
        if (!ticket.deadline || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        try {
            const [datePart, timePart] = ticket.deadline.split(' ');
            const [day, month, year] = datePart.split('-');
            const [hour, minute] = timePart ? timePart.split(':') : [0, 0];
            return new Date(year, month - 1, day, hour, minute) < new Date();
        } catch (err) {
            return false;
        }
    };

    // --- AGGREGATIONS ---
    const deptStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const d = t.dept_assigned || 'Unknown';
            if (!stats[d]) stats[d] = { department: d, total: 0, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, Decline: 0 };
            stats[d].total += 1;
            if (stats[d][t.status] !== undefined) stats[d][t.status] += 1;
        });
        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [filteredTickets]);

    const statusBreakdown = useMemo(() => {
        const counts = { 'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Closed': 0, 'Decline': 0 };
        filteredTickets.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
        return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] }));
    }, [filteredTickets]);

    const locationLoad = useMemo(() => {
        const counts = {};
        filteredTickets.forEach(t => {
            if (t.location) {
                if (!counts[t.location]) counts[t.location] = { location: t.location, total: 0, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, Decline: 0 };
                counts[t.location].total += 1;
                if (counts[t.location][t.status] !== undefined) counts[t.location][t.status] += 1;
            }
        });
        return Object.values(counts).sort((a, b) => b.total - a.total).slice(0, 10);
    }, [filteredTickets]);

    const dateTrend = useMemo(() => {
        const counts = {};
        filteredTickets.forEach(t => {
            if (!t.timestamp) return;
            const date = t.timestamp.split(' ')[0];
            counts[date] = (counts[date] || 0) + 1;
        });
        return Object.keys(counts).sort((a, b) => {
            const [d1, m1, y1] = a.split('-'); const [d2, m2, y2] = b.split('-');
            return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
        }).map(date => ({ date, tickets: counts[date] }));
    }, [filteredTickets]);

    const severityBreakdown = useMemo(() => {
        let high = 0, normal = 0;
        filteredTickets.forEach(t => { if (t.total_score >= 10) high++; else normal++; });
        return [{ name: 'High (>=10)', value: high }, { name: 'Normal (<10)', value: normal }];
    }, [filteredTickets]);

    const slaBreachStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const d = t.dept_assigned || 'Unknown';
            if (!stats[d]) stats[d] = { department: d, 'On Time': 0, 'SLA Breached': 0 };
            if (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) stats[d]['SLA Breached'] += 1;
            else stats[d]['On Time'] += 1;
        });
        return Object.values(stats);
    }, [filteredTickets]);

    const solverRatings = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            if (!t.assigned_to || t.assigned_to === 'Unassigned') return;
            const r = parseFloat(t.solver_rating);
            if (!isNaN(r)) {
                if (!stats[t.assigned_to]) stats[t.assigned_to] = { solver: t.assigned_to.split('@')[0], total: 0, count: 0 };
                stats[t.assigned_to].total += r;
                stats[t.assigned_to].count += 1;
            }
        });
        return Object.values(stats)
            .map(s => ({ solver: s.solver, 'Avg Rating': parseFloat((s.total / s.count).toFixed(1)) }))
            .sort((a, b) => b['Avg Rating'] - a['Avg Rating'])
            .slice(0, 15); // Top 15 Solvers
    }, [filteredTickets]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

            <TicketFilterBar
                tickets={tickets}
                usersList={usersList || []}
                onFilter={setFilteredTickets}
                hideSort={true}
            />

            {/* GRAPHS MATRIX */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>

                {/* 1. Ticket Volume by Dept */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Ticket Volume by Department</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={deptStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Bar dataKey="total" fill="#184F7E" radius={[4, 4, 0, 0]} name="Total Tickets" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Timeline Trend */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Historical Ticket Volume Trend</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={dateTrend}>
                            <defs>
                                <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Area type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" name="Tickets Raised" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* 3. SLA Breaches by Dept */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>SLA Performance by Department</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={slaBreachStats} stackOffset="sign">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                            <Bar dataKey="On Time" stackId="a" fill="#184F7E" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="SLA Breached" stackId="a" fill="#F7941D" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 4. Dept Status Breakdown */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Department Status Breakdown (100%)</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={deptStats} stackOffset="expand">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={(tick) => `${tick * 100}%`} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                            <Bar dataKey="Open" stackId="a" fill={STATUS_COLORS['Open']} />
                            <Bar dataKey="In Progress" stackId="a" fill={STATUS_COLORS['In Progress']} />
                            <Bar dataKey="Resolved" stackId="a" fill={STATUS_COLORS['Resolved']} />
                            <Bar dataKey="Closed" stackId="a" fill={STATUS_COLORS['Closed']} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 5. Location Hotspots (Stacked by Status) */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Ticket Volume by Location (Top 10)</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={locationLoad} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <YAxis dataKey="location" type="category" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                            <Bar dataKey="Open" stackId="a" fill={STATUS_COLORS['Open']} />
                            <Bar dataKey="In Progress" stackId="a" fill={STATUS_COLORS['In Progress']} />
                            <Bar dataKey="Resolved" stackId="a" fill={STATUS_COLORS['Resolved']} />
                            <Bar dataKey="Closed" stackId="a" fill={STATUS_COLORS['Closed']} />
                            <Bar dataKey="Decline" stackId="a" fill={STATUS_COLORS['Decline']} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 6. Solver Average Ratings */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>CSAT: Solver Average Rating (Top 15)</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={solverRatings}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="solver" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={60} />
                            <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Bar dataKey="Avg Rating" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 7. Severity Distribution */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7', alignSelf: 'flex-start' }}>Priority & Severity Distribution</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie data={severityBreakdown} innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                                {severityBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 8. Global Status Pie */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7', alignSelf: 'flex-start' }}>Global Status Distribution</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie data={statusBreakdown} innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                                {statusBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

            </div>
        </div>
    );
};

export default AdminAnalytics;
