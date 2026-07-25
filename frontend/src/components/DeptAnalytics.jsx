// frontend/src/components/DeptAnalytics.jsx
import React, { useState, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, 
    ResponsiveContainer, CartesianGrid, AreaChart, Area, ComposedChart 
} from 'recharts';
import { Filter, XCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_COLORS = { 'Open': '#f59e0b', 'In Progress': '#3b82f6', 'Resolved': '#10b981', 'Closed': '#6b7280', 'Decline': '#ef4444' };

// --- CUSTOM ENTERPRISE SEARCH DROPDOWN ---
const SearchSelect = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    
    // Safely cast to string to prevent any toLowerCase undefined errors
    const filtered = options.filter(o => 
        o && String(o).toLowerCase().includes(String(search).toLowerCase())
    );

    return (
        <div style={{ position: 'relative' }}>
            <input 
                type="text" 
                className="form-control" 
                placeholder={placeholder} 
                value={isOpen ? search : value} 
                onChange={e => { 
                    setSearch(e.target.value); 
                    setIsOpen(true); 
                    onChange(e.target.value); 
                }} 
                onFocus={() => { 
                    setIsOpen(true); 
                    setSearch(''); 
                }} 
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                style={{ 
                    padding: '8px 12px', 
                    fontSize: '12px', 
                    borderBottomLeftRadius: isOpen ? 0 : 6, 
                    borderBottomRightRadius: isOpen ? 0 : 6,
                    margin: 0,
                    width: '100%'
                }}
            />
            {isOpen && (
                <div style={{ 
                    position: 'absolute', top: '100%', left: 0, width: '100%', 
                    backgroundColor: '#09090b', border: '1px solid #3f3f46', borderTop: 'none', 
                    zIndex: 1000, maxHeight: '200px', overflowY: 'auto', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', borderRadius: '0 0 6px 6px' 
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '6px 12px', fontSize: '12px', color: '#71717a' }}>No results</div>
                    ) : (
                        filtered.map(opt => (
                            <div 
                                key={opt} 
                                onClick={() => onChange(opt)} 
                                style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#ededed', borderBottom: '1px solid #18181b' }} 
                                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#2563eb'; e.currentTarget.style.color = '#fff'; }} 
                                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#ededed'; }}
                            >
                                {opt}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const DeptAnalytics = ({ tickets }) => {
    const [showFilters, setShowFilters] = useState(false);
    
    const [filterIssue, setFilterIssue] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');

    const uniqueIssues = [...new Set(tickets.map(t => t.issue_type).filter(Boolean))];
    const uniqueLocations = [...new Set(tickets.map(t => t.location).filter(Boolean))];
    const uniqueStatuses = [...new Set(tickets.map(t => t.status).filter(Boolean))];
    const uniqueAssignees = [...new Set(tickets.map(t => t.assigned_to).filter(Boolean))];

    const isLate = (ticket) => {
        if (!ticket.deadline || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        try {
            const [datePart, timePart] = ticket.deadline.split(' ');
            const [day, month, year] = datePart.split('-');
            const [hour, minute] = timePart ? timePart.split(':') : [0, 0];
            return new Date(year, month - 1, day, hour, minute) < new Date(); 
        } catch (err) { return false; }
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const matchIssue = !filterIssue || (t.issue_type && t.issue_type.toLowerCase().includes(filterIssue.toLowerCase()));
            const matchLocation = !filterLocation || (t.location && t.location.toLowerCase().includes(filterLocation.toLowerCase()));
            const matchStatus = !filterStatus || (t.status && t.status.toLowerCase().includes(filterStatus.toLowerCase()));
            const matchAssignee = !filterAssignee || (t.assigned_to && t.assigned_to.toLowerCase().includes(filterAssignee.toLowerCase()));
            
            return matchIssue && matchLocation && matchStatus && matchAssignee;
        });
    }, [tickets, filterIssue, filterLocation, filterStatus, filterAssignee]);

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
            const r = parseFloat(t.raiser_rating_solver);
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
        return Object.values(stats).sort((a, b) => (b['On Time'] + b['SLA Breached']) - (a['On Time'] + a['SLA Breached']));
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
                <button className="btn btn-filter" onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Filter Department Analytics'}
                </button>
            </div>

            {/* STRAIGHT GRID FILTERS */}
            {showFilters && (
                <div className="card filter-container" style={{ padding: '20px', marginBottom: 0, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '15px', alignItems: 'flex-end' }}>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Issue Type</label>
                        <SearchSelect options={uniqueIssues} value={filterIssue} onChange={setFilterIssue} placeholder="Type..." />
                    </div>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Location</label>
                        <SearchSelect options={uniqueLocations} value={filterLocation} onChange={setFilterLocation} placeholder="Type..." />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Status</label>
                        <SearchSelect options={uniqueStatuses} value={filterStatus} onChange={setFilterStatus} placeholder="Type..." />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Assignee</label>
                        <SearchSelect options={uniqueAssignees} value={filterAssignee} onChange={setFilterAssignee} placeholder="Type email..." />
                    </div>
                    
                    <div style={{ display: 'flex', width: '100%' }}>
                        <button 
                            className="btn" 
                            onClick={() => { setFilterIssue(''); setFilterLocation(''); setFilterStatus(''); setFilterAssignee(''); }} 
                            style={{ backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', fontSize: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <XCircle size={14} /> Clear
                        </button>
                    </div>
                </div>
            )}

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
                
            </div>
        </div>
    );
};

export default DeptAnalytics;
