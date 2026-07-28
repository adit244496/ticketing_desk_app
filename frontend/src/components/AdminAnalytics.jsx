// frontend/src/components/AdminAnalytics.jsx
import React, { useState, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, 
    ResponsiveContainer, AreaChart, Area, CartesianGrid, ComposedChart 
} from 'recharts';
import { Filter, XCircle } from 'lucide-react';

const COLORS = ['#184F7E', '#F7941D', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_COLORS = { 'Open': '#F7941D', 'In Progress': '#184F7E', 'Resolved': '#10b981', 'Closed': '#6b7280', 'Decline': '#ef4444' };
const SEVERITY_COLORS = { 'High (>=10)': '#ef4444', 'Normal (<10)': '#3b82f6' };

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

const AdminAnalytics = ({ tickets }) => {
    const [showFilters, setShowFilters] = useState(false);
    
    // Filters
    const [filterDept, setFilterDept] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterIssue, setFilterIssue] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');

    const uniqueDepts = [...new Set(tickets.map(t => t.dept_assigned).filter(Boolean))];
    const uniqueLocations = [...new Set(tickets.map(t => t.location).filter(Boolean))];
    const uniqueIssues = [...new Set(tickets.map(t => t.issue_type).filter(Boolean))];
    const uniqueStatuses = [...new Set(tickets.map(t => t.status).filter(Boolean))];

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

    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const matchDept = !filterDept || (t.dept_assigned && t.dept_assigned.toLowerCase().includes(filterDept.toLowerCase()));
            const matchLocation = !filterLocation || (t.location && t.location.toLowerCase().includes(filterLocation.toLowerCase()));
            const matchIssue = !filterIssue || (t.issue_type && t.issue_type.toLowerCase().includes(filterIssue.toLowerCase()));
            const matchStatus = !filterStatus || (t.status && t.status.toLowerCase().includes(filterStatus.toLowerCase()));
            
            let matchSeverity = true;
            if (filterSeverity === 'High (>=10)') matchSeverity = t.total_score >= 10;
            if (filterSeverity === 'Normal (<10)') matchSeverity = t.total_score < 10;

            return matchDept && matchLocation && matchIssue && matchStatus && matchSeverity;
        });
    }, [tickets, filterDept, filterLocation, filterIssue, filterStatus, filterSeverity]);

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
        filteredTickets.forEach(t => { if (t.location) counts[t.location] = (counts[t.location] || 0) + 1; });
        return Object.keys(counts).map(k => ({ location: k, tickets: counts[k] })).sort((a, b) => b.tickets - a.tickets).slice(0, 10);
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

            {/* TOGGLE FILTERS */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
                <button className="btn btn-filter" onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Search & Filter Analytics'}
                </button>
            </div>

            {/* UPGRADED STRAIGHT-LINE FILTER GRID */}
            {showFilters && (
                <div className="card filter-container" style={{ padding: '20px', marginBottom: 0, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '15px', alignItems: 'flex-end' }}>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Dept</label>
                        <SearchSelect options={uniqueDepts} value={filterDept} onChange={setFilterDept} placeholder="Type..." />
                    </div>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Location</label>
                        <SearchSelect options={uniqueLocations} value={filterLocation} onChange={setFilterLocation} placeholder="Type..." />
                    </div>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Issue</label>
                        <SearchSelect options={uniqueIssues} value={filterIssue} onChange={setFilterIssue} placeholder="Type..." />
                    </div>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Search Status</label>
                        <SearchSelect options={uniqueStatuses} value={filterStatus} onChange={setFilterStatus} placeholder="Type..." />
                    </div>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'block' }}>Severity Score</label>
                        <select className="form-control" style={{ padding: '8px 12px', fontSize: '12px', margin: 0 }} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                            <option value="">All Scores</option>
                            <option value="High (>=10)">High (≥ 10)</option>
                            <option value="Normal (<10)">Normal (&lt; 10)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', width: '100%' }}>
                        <button 
                            className="btn" 
                            onClick={() => { 
                                setFilterDept(''); 
                                setFilterLocation(''); 
                                setFilterIssue(''); 
                                setFilterStatus(''); 
                                setFilterSeverity(''); 
                            }} 
                            style={{ backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', fontSize: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <XCircle size={14} /> Clear
                        </button>
                    </div>

                </div>
            )}

            {/* GRAPHS MATRIX */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                
                {/* 1. Ticket Volume by Dept */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Ticket Volume by Department</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={deptStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="department" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
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
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="date" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
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
                            <XAxis dataKey="department" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
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
                            <XAxis dataKey="department" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} tickFormatter={(tick) => `${tick * 100}%`} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                            <Bar dataKey="Open" stackId="a" fill={STATUS_COLORS['Open']} />
                            <Bar dataKey="In Progress" stackId="a" fill={STATUS_COLORS['In Progress']} />
                            <Bar dataKey="Resolved" stackId="a" fill={STATUS_COLORS['Resolved']} />
                            <Bar dataKey="Closed" stackId="a" fill={STATUS_COLORS['Closed']} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 5. Location Hotspots */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>Ticket Volume by Location (Top 10)</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={locationLoad} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                            <XAxis type="number" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <YAxis dataKey="location" type="category" tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={false} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#ededed' }} />
                            <Bar dataKey="tickets" fill="#8b5cf6" barSize={20} radius={[0, 4, 4, 0]} name="Tickets" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* 6. Solver Average Ratings */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, border: '1px solid #27272a' }}>
                    <h4 style={{ marginBottom: '20px', fontSize: '14px', color: '#e4e4e7' }}>CSAT: Solver Average Rating (Top 15)</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={solverRatings}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="solver" tick={{fontSize: 10, fill: '#a1a1aa'}} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={60} />
                            <YAxis domain={[0, 5]} tick={{fontSize: 11, fill: '#a1a1aa'}} tickLine={false} axisLine={false} />
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