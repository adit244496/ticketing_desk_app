import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, RefreshCw, SortDesc } from 'lucide-react';

// --- CUSTOM ENTERPRISE SEARCH DROPDOWN ---
export const SearchSelect = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = options.filter(o =>
        o && String(o).toLowerCase().includes(String(search).toLowerCase())
    );

    return (
        <div style={{ position: 'relative', width: '100%' }}>
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
                    fontSize: '11px',
                    borderBottomLeftRadius: isOpen ? 0 : 5,
                    borderBottomRightRadius: isOpen ? 0 : 5,
                    width: '100%',
                    boxSizing: 'border-box',
                    margin: 0
                }}
            />
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%',
                    backgroundColor: 'var(--bg-solid)', border: '1px solid var(--border)', borderTop: 'none',
                    zIndex: 1000, maxHeight: '160px', overflowY: 'auto',
                    boxShadow: '0 8px 12px -2px rgba(0,0,0,0.5)', borderRadius: '0 0 5px 5px'
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: '#71717a' }}>No results</div>
                    ) : (
                        filtered.map(opt => (
                            <div
                                key={opt}
                                onMouseDown={(e) => {
                                    // use onMouseDown instead of onClick to prevent onBlur from firing first
                                    e.preventDefault();
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                style={{ padding: '8px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}
                                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; }}
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

const TicketFilterBar = ({ tickets, onFilter, usersList = [], rightActions }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [showSort, setShowSort] = useState(false);
    const [activeFilterKeys, setActiveFilterKeys] = useState([]);
    const [globalSearch, setGlobalSearch] = useState('');

    // Sort specific state
    const [sortField, setSortField] = useState('ticket_id');
    const [sortOrder, setSortOrder] = useState('desc');

    // Specific Filters
    const [fTicketId, setFTicketId] = useState('');
    const [fDept, setFDept] = useState('');
    const [fIssue, setFIssue] = useState('');
    const [fStatus, setFStatus] = useState('');
    const [fSolver, setFSolver] = useState('');
    const [fRaiser, setFRaiser] = useState('');

    const getUserDetails = (emailOrId) => {
        if (!emailOrId) return '';
        const u = usersList.find(u => String(u.employee_id) === String(emailOrId) || String(u.email) === String(emailOrId));
        return u ? `${u.name} (${u.phone || 'N/A'})` : emailOrId;
    };

    // Derived Dropdown Options
    const uniqueTicketIds = useMemo(() => [...new Set(tickets.map(t => String(t.ticket_id)))].filter(Boolean), [tickets]);
    const uniqueDepts = useMemo(() => [...new Set(tickets.map(t => t.department || t.dept_assigned))].filter(Boolean), [tickets]);
    const uniqueIssues = useMemo(() => [...new Set(tickets.map(t => t.issue_type))].filter(Boolean), [tickets]);
    const uniqueStatuses = useMemo(() => [...new Set(tickets.map(t => t.status))].filter(Boolean), [tickets]);

    const uniqueSolvers = useMemo(() => {
        const ids = new Set();
        tickets.forEach(t => {
            if (t.assigned_to) {
                String(t.assigned_to).split(',').forEach(id => ids.add(getUserDetails(id.trim())));
            }
        });
        return [...ids].filter(Boolean);
    }, [tickets, usersList]);

    const uniqueRaisers = useMemo(() => {
        const emails = new Set(tickets.map(t => getUserDetails(t.raiser_email)));
        return [...emails].filter(Boolean);
    }, [tickets, usersList]);

    // Apply Filters
    useEffect(() => {
        if (!tickets) return;

        let result = tickets.filter(t => {
            // Global Search
            const searchStr = globalSearch.toLowerCase();
            const matchesGlobal = !searchStr || (
                String(t.ticket_id).toLowerCase().includes(searchStr) ||
                String(t.department || t.dept_assigned || '').toLowerCase().includes(searchStr) ||
                String(t.issue_type || '').toLowerCase().includes(searchStr) ||
                String(t.status || '').toLowerCase().includes(searchStr) ||
                String(t.location || '').toLowerCase().includes(searchStr) ||
                getUserDetails(t.raiser_email).toLowerCase().includes(searchStr) ||
                (t.assigned_to && getUserDetails(String(t.assigned_to).split(',')[0].trim()).toLowerCase().includes(searchStr))
            );

            // Specific Filters
            const matchesId = !fTicketId || String(t.ticket_id) === fTicketId;
            const matchesDept = !fDept || (t.department || t.dept_assigned) === fDept;
            const matchesIssue = !fIssue || t.issue_type === fIssue;
            const matchesStatus = !fStatus || t.status === fStatus;

            const solverStr = t.assigned_to ? String(t.assigned_to).split(',').map(s => getUserDetails(s.trim())).join(' ') : '';
            const matchesSolver = !fSolver || solverStr.includes(fSolver);

            const matchesRaiser = !fRaiser || getUserDetails(t.raiser_email) === fRaiser;

            return matchesGlobal && matchesId && matchesDept && matchesIssue && matchesStatus && matchesSolver && matchesRaiser;
        });

        // Apply Sorting
        result.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (sortField === 'ticket_id') {
                valA = Number(valA);
                valB = Number(valB);
            } else if (sortField === 'timestamp' || sortField === 'deadline') {
                const parseDate = (dStr) => {
                    if (!dStr) return 0;
                    const parts = String(dStr).split(' ');
                    if (!parts[0]) return 0;
                    const dParts = parts[0].split('-');
                    const tParts = parts[1] ? parts[1].split(':') : ['0', '0'];
                    if (dParts.length < 3) return 0;
                    return new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]).getTime();
                };
                valA = parseDate(valA);
                valB = parseDate(valB);
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        onFilter(result);
    }, [tickets, globalSearch, fTicketId, fDept, fIssue, fStatus, fSolver, fRaiser, usersList, sortField, sortOrder]);

    const handleClear = () => {
        setGlobalSearch('');
        setFTicketId('');
        setFDept('');
        setFIssue('');
        setFStatus('');
        setFSolver('');
        setFRaiser('');
        setActiveFilterKeys([]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px', width: '100%' }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search all tickets..."
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        style={{ padding: '6px 10px 6px 32px', fontSize: '10px', margin: 0, width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                    {/* Sort Button and Modal */}
                    <div style={{ position: 'relative' }}>
                        <button className="btn" onClick={() => { setShowSort(!showSort); setShowFilters(false); }} style={{ padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: showSort ? '#3b82f6' : '#27272a', border: 'none' }}>
                            <SortDesc size={12} /> Sort
                        </button>
                        {showSort && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                backgroundColor: 'var(--bg-solid)', border: '1px solid var(--border)',
                                borderRadius: '8px', padding: '12px', zIndex: 9999,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.2)', minWidth: '220px',
                                display: 'flex', flexDirection: 'column', gap: '12px'
                            }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>SORT TICKETS BY</div>

                                <div>
                                    <label style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>Field</label>
                                    <select className="form-control" value={sortField} onChange={e => setSortField(e.target.value)} style={{ fontSize: '11px', padding: '6px', width: '100%' }}>
                                        <option value="ticket_id">Ticket ID</option>
                                        <option value="status">Status</option>
                                        <option value="assigned_to">Assigned To</option>
                                        <option value="timestamp">Date Raised</option>
                                        <option value="deadline">Deadline</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>Order</label>
                                    <select className="form-control" value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ fontSize: '11px', padding: '6px', width: '100%' }}>
                                        <option value="desc">Ascending (Oldest/Lowest First)</option>
                                        <option value="asc">Descending (Newest/Highest First)</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filter Button and Modal */}
                    <div style={{ position: 'relative' }}>
                        <button className="btn" onClick={() => { setShowFilters(!showFilters); setShowSort(false); }} style={{ padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: showFilters || activeFilterKeys.length > 0 ? '#3b82f6' : '#27272a', border: 'none' }}>
                            <Filter size={12} /> Filters {activeFilterKeys.length > 0 ? `(${activeFilterKeys.length})` : ''}
                        </button>
                        {showFilters && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                backgroundColor: 'var(--bg-solid)', border: '1px solid var(--border)',
                                borderRadius: '8px', padding: '12px', zIndex: 9999,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.2)', minWidth: '220px',
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px', paddingBottom: '6px', borderBottom: '1px solid var(--border)', letterSpacing: '0.5px' }}>SELECT FILTERS TO APPLY</div>
                                {[
                                    { id: 'ticket_id', label: 'Ticket ID' },
                                    { id: 'department', label: 'Department' },
                                    { id: 'issue_type', label: 'Issue Type' },
                                    { id: 'status', label: 'Status' },
                                    { id: 'assigned_solver', label: 'Assigned Solver' },
                                    { id: 'raised_by', label: 'Raised By' }
                                ].map(f => (
                                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer', padding: '4px 0' }}>
                                        <input
                                            type="checkbox"
                                            style={{ accentColor: '#3b82f6', width: '14px', height: '14px', cursor: 'pointer' }}
                                            checked={activeFilterKeys.includes(f.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setActiveFilterKeys([...activeFilterKeys, f.id]);
                                                } else {
                                                    setActiveFilterKeys(activeFilterKeys.filter(x => x !== f.id));
                                                    if (f.id === 'ticket_id') setFTicketId('');
                                                    if (f.id === 'department') setFDept('');
                                                    if (f.id === 'issue_type') setFIssue('');
                                                    if (f.id === 'status') setFStatus('');
                                                    if (f.id === 'assigned_solver') setFSolver('');
                                                    if (f.id === 'raised_by') setFRaiser('');
                                                }
                                            }}
                                        />
                                        {f.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    {rightActions && <div>{rightActions}</div>}
                </div>
            </div>

            {/* Active Filters Display */}
            {activeFilterKeys.length > 0 && (
                <div className="card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    {activeFilterKeys.includes('ticket_id') && (
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticket ID</label>
                            <SearchSelect options={uniqueTicketIds} value={fTicketId} onChange={setFTicketId} placeholder="Search ID..." />
                        </div>
                    )}
                    {activeFilterKeys.includes('department') && (
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</label>
                            <SearchSelect options={uniqueDepts} value={fDept} onChange={setFDept} placeholder="Search Dept..." />
                        </div>
                    )}
                    {activeFilterKeys.includes('issue_type') && (
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Type</label>
                            <SearchSelect options={uniqueIssues} value={fIssue} onChange={setFIssue} placeholder="Search Issue..." />
                        </div>
                    )}
                    {activeFilterKeys.includes('status') && (
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                            <SearchSelect options={uniqueStatuses} value={fStatus} onChange={setFStatus} placeholder="Search Status..." />
                        </div>
                    )}
                    {activeFilterKeys.includes('assigned_solver') && (
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned Solver</label>
                            <SearchSelect options={uniqueSolvers} value={fSolver} onChange={setFSolver} placeholder="Search Solver..." />
                        </div>
                    )}
                    {activeFilterKeys.includes('raised_by') && (
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raised By</label>
                            <SearchSelect options={uniqueRaisers} value={fRaiser} onChange={setFRaiser} placeholder="Search Raiser..." />
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 100%', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button className="btn" onClick={handleClear} style={{ padding: '8px 20px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px' }}>
                            <RefreshCw size={12} /> Clear All Filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TicketFilterBar;
