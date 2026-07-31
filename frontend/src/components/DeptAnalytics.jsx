// frontend/src/components/DeptAnalytics.jsx
import React, { useState, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, 
    ResponsiveContainer, CartesianGrid, AreaChart, Area, ComposedChart 
} from 'recharts';
import TicketFilterBar from './TicketFilterBar';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_COLORS = { 'Open': '#f59e0b', 'In Progress': '#3b82f6', 'Resolved': '#10b981', 'Closed': '#6b7280', 'Decline': '#ef4444' };

const DeptAnalytics = ({ tickets, usersList }) => {
    const [filteredTickets, setFilteredTickets] = useState(tickets || []);

    const isLate = (ticket) => {
        if (!ticket.deadline || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        try {
            const [datePart, timePart] = ticket.deadline.split(' ');
            const [day, month, year] = datePart.split('-');
            const [hour, minute] = timePart ? timePart.split(':') : [0, 0];
            return new Date(year, month - 1, day, hour, minute) < new Date(); 
        } catch (err) { return false; }
    };

    const solverWorkload = useMemo(() => {
        const counts = {};
        filteredTickets.forEach(t => {
            if (!t.assigned_to || t.assigned_to === 'Unassigned') return;
            const solverName = t.assigned_to.split('@')[0];
            if (!counts[solverName]) counts[solverName] = { solver: solverName, 'Active Tasks': 0, 'Closed Tasks': 0 };
            if (t.status === 'Closed' || t.status === 'Resolved') counts[solverName]['Closed Tasks'] += 1;
            else counts[solverName]['Active Tasks'] += 1;
        });
        return Object.values(counts).sort((a, b) => (b['Active Tasks'] + b['Closed Tasks']) - (a['Active Tasks'] + a['Closed Tasks']));
    }, [filteredTickets]);

    const statusBreakdown = useMemo(() => {
        const counts = { 'Open': 0, 'In Progress': 0, 'Resolved': 0, 'Closed': 0, 'Decline': 0 };
        filteredTickets.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
        return Object.keys(counts).filter(key => counts[key] > 0).map(key => ({ name: key, value: counts[key] }));
    }, [filteredTickets]);

    const issueFrequency = useMemo(() => {
        const counts = {};
        filteredTickets.forEach(t => {
            if (!t.issue_type) return;
            counts[t.issue_type] = (counts[t.issue_type] || 0) + 1;
        });
        return Object.keys(counts).map(key => ({ issue: key, count: counts[key] })).sort((a, b) => b.count - a.count).slice(0, 10);
    }, [filteredTickets]);

    const solverRatings = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            if (!t.assigned_to || t.assigned_to === 'Unassigned') return;
            const r = parseFloat(t.solver_rating);
            if (!isNaN(r)) {
                const solver = t.assigned_to.split('@')[0];
                if (!stats[solver]) stats[solver] = { solver, total: 0, count: 0 };
                stats[solver].total += r;
                stats[solver].count += 1;
            }
        });
        return Object.values(stats)
            .map(s => ({ solver: s.solver, 'Avg Rating': parseFloat((s.total / s.count).toFixed(1)) }))
            .sort((a, b) => b['Avg Rating'] - a['Avg Rating']);
    }, [filteredTickets]);

    const slaStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            if (!t.assigned_to || t.assigned_to === 'Unassigned') return;
            const solver = t.assigned_to.split('@')[0];
            if (!stats[solver]) stats[solver] = { solver, 'On Time': 0, 'SLA Breached': 0 };
            if (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) stats[solver]['SLA Breached'] += 1;
            else stats[solver]['On Time'] += 1;
        });
        return Object.values(stats);
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

    // NEW LOCATION WISE TICKETS BY STATUS
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <TicketFilterBar 
                tickets={tickets} 
                usersList={usersList || []} 
                onFilter={setFilteredTickets} 
                hideSort={true}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Solver Workload & Output</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={solverWorkload}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="solver" tick={{fontSize: 10, fill: '#a1a1aa'}} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={60} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                            <Bar dataKey="Active Tasks" stackId="a" fill="#f59e0b" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="Closed Tasks" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Team Customer Satisfaction (CSAT)</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={solverRatings} layout="vertical" margin={{ left: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                            <XAxis type="number" domain={[0, 5]} tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis dataKey="solver" type="category" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Bar dataKey="Avg Rating" fill="#3b82f6" barSize={20} radius={[0, 4, 4, 0]} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>SLA Performance by Solver</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={slaStats} stackOffset="sign">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="solver" tick={{fontSize: 10, fill: '#a1a1aa'}} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={60} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                            <Bar dataKey="On Time" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="SLA Breached" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Department Ticket Volume Trend</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={dateTrend}>
                            <defs>
                                <linearGradient id="colorDeptTickets" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="date" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Area type="monotone" dataKey="tickets" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorDeptTickets)" name="Tickets Raised" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7', alignSelf: 'flex-start' }}>Issue Status Breakdown</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={statusBreakdown} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                {statusBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Top Issue Type Frequencies</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={issueFrequency}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="issue" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Times Raised" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 5. Location Hotspots (Stacked by Status) */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Ticket Volume by Location (Top 10)</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={locationLoad} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                            <XAxis type="number" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis dataKey="location" type="category" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
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
                
            </div>
        </div>
    );
};

export default DeptAnalytics;
