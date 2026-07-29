// frontend/src/pages/DeptHeadDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    fetchDeptOverview, fetchPendingApprovals, fetchUsers, 
    processTransfer, forceReassign, 
    fetchMasterRules, updateMasterRule, fetchTicketLogs 
} from '../api';
import Layout from '../components/Layout';
import DeptAnalytics from '../components/DeptAnalytics';
import TicketTimeline from '../components/TicketTimeline';
import { Filter, Briefcase, TrendingUp, BarChart2, CheckCircle, XCircle, Zap, Cog, X, Maximize2, Minimize2, FileText, Clock, MessageSquare, AlertTriangle, CheckCircle2, Paperclip, Search } from 'lucide-react';

import TicketFilterBar from '../components/TicketFilterBar';

const DeptHeadDashboard = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('analytics');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); 

    const [deptTickets, setDeptTickets] = useState([]);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [deptSolvers, setDeptSolvers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [overrideForms, setOverrideForms] = useState({});

    // --- RULES UI STATE ---
    // --- TICKET PANEL STATE ---
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState('details');
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const [rulesList, setRulesList] = useState([]);
    const [ruleSearchQuery, setRuleSearchQuery] = useState('');
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const defaultRule = { department: user.department, issue_type: '', outlet: '', base_priority: 3, assigned_solver: '', deadline_hours: 24 };
    const [editRule, setEditRule] = useState(defaultRule);

    const [filteredOverviewTickets, setFilteredOverviewTickets] = useState([]);

    const location = useLocation();

    // Reset expanded panel and selected ticket when navigating
    useEffect(() => {
        setSelectedTicket(null);
        setIsPanelExpanded(false);
    }, [location.key]);

    useEffect(() => {
        loadDashboardData();
    }, [user.department]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [overviewData, approvalsData, usersData, rulesData] = await Promise.all([
                fetchDeptOverview(user.department), 
                fetchPendingApprovals(user.department), 
                fetchUsers(),
                fetchMasterRules()
            ]);
            
            let safeTickets = overviewData.tickets;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);
            
            setDeptTickets(Array.isArray(safeTickets) ? safeTickets : []);
            setPendingApprovals(approvalsData);
            setDeptSolvers(usersData.filter(u => u.department === user.department && u.role && (String(u.role).toLowerCase() === 'solver' || String(u.role).toLowerCase().includes('head'))));
            setAllUsers(usersData);
            
            // Strictly filter rules to ONLY show this Dept Head's rules
            setRulesList(rulesData.filter(r => r.department === user.department));
        } catch (err) {
            setError("Failed to load department data.");
        } finally {
            setLoading(false);
        }
    };

    const handleTicketClick = async (ticket) => {
        setSelectedTicket(ticket);
        setActivePanelTab('details');
        setIsPanelExpanded(false);
        setLogsLoading(true);
        try {
            const logs = await fetchTicketLogs(ticket.ticket_id);
            setTicketLogs(logs);
        } catch (err) {
            console.error("Failed to fetch logs", err);
        } finally {
            setLogsLoading(false);
        }
    };

    const getDisplayName = (identifier) => {
        if (!identifier || String(identifier).toLowerCase() === 'nan') return 'Unassigned';
        const cleanId = String(identifier).replace(/\.0$/, '');
        const targetUser = allUsers.find(u => 
            String(u.employee_id) === cleanId || 
            String(u.email).toLowerCase() === cleanId.toLowerCase()
        );
        if (targetUser) {
            return targetUser.phone_no 
                ? `${targetUser.name} (${targetUser.phone_no})` 
                : targetUser.name;
        }
        return cleanId;
    };

    const handleApprovalAction = async (ticketId, action) => {
        try { await processTransfer({ ticket_id: ticketId, action }); alert(`Transfer request ${action}d successfully.`); loadDashboardData(); } 
        catch (err) { alert("Failed to process transfer request."); }
    };

    const handleForceReassign = async (e, ticketId) => {
        e.preventDefault();
        const newAssignee = overrideForms[ticketId];
        if (!newAssignee) return alert("You must select a new solver to assign the ticket to.");
        
        if (window.confirm("Are you sure you want to forcefully reassign this ticket?")) {
            try { await forceReassign({ ticket_id: ticketId, new_assignee: newAssignee }); alert("Ticket reassigned successfully."); loadDashboardData(); } 
            catch (err) { alert("Failed to reassign ticket."); }
        }
    };

    // --- RULE MANAGEMENT HANDLERS ---
    const handleUpdateRule = async (e) => {
        e.preventDefault();
        try { 
            // Create a sanitized copy of the rule before sending
            const payload = {
                ...editRule,
                // Ensure numbers are strictly integers
                base_priority: parseInt(editRule.base_priority, 10),
                deadline_hours: parseInt(editRule.deadline_hours || 24, 10),
                // Ensure empty outlets are sent as empty strings, not undefined/null
                outlet: editRule.outlet && String(editRule.outlet).toLowerCase() !== 'nan' ? editRule.outlet : '',
                // Ensure assigned solvers are clean comma-separated strings without trailing spaces
                assigned_solver: editRule.assigned_solver ? String(editRule.assigned_solver).split(',').map(s => s.trim()).filter(Boolean).join(',') : ''
            };

            await updateMasterRule(payload); 
            alert(`Rule updated successfully.`); 
            setIsRuleModalOpen(false); 
            loadDashboardData(); // (or loadSystemData() for Admin)
        } 
        catch (err) { 
            console.error("Rule Update Error:", err.response?.data || err);
            alert(err.response?.data?.error || "Failed to update rule. Check the console for details."); 
        }
    };

    const openRuleModal = (rule) => {
        setEditRule({ 
            ...rule,
            original_department: rule.department,
            original_issue_type: rule.issue_type,
            original_outlet: rule.outlet
        });
        setIsRuleModalOpen(true);
    };

    const handleSolverToggle = (empId) => {
        let currentSolvers = editRule.assigned_solver 
            ? String(editRule.assigned_solver).split(',').map(s => s.trim()).filter(Boolean) 
            : [];
            
        if (currentSolvers.includes(empId)) {
            currentSolvers = currentSolvers.filter(id => id !== empId);
        } else {
            currentSolvers.push(empId);
        }
        setEditRule({ ...editRule, assigned_solver: currentSolvers.join(',') });
    };

    const isLate = (ticket) => {
        if (!ticket.deadline || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        
        try {
            const [datePart, timePart] = ticket.deadline.split(' ');
            const [day, month, year] = datePart.split('-');
            const [hour, minute] = timePart ? timePart.split(':') : [0, 0];
            
            const exactDeadline = new Date(year, month - 1, day, hour, minute);
            return exactDeadline < new Date(); 
        } catch (err) {
            return false;
        }
    };

    // filteredOverviewTickets is managed by TicketFilterBar

    const activeOverrideTickets = deptTickets.filter(t => t.status !== 'Closed');
    const filteredOverrideTickets = activeOverrideTickets.filter(t => 
        (t.issue_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.assigned_to || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(t.ticket_id).includes(searchTerm)
    );

    const filteredRules = rulesList.filter(r => {
        const q = ruleSearchQuery.toLowerCase();
        return (
            (r.issue_type && r.issue_type.toLowerCase().includes(q)) ||
            (r.outlet && String(r.outlet).toLowerCase().includes(q)) ||
            (r.assigned_solver && String(r.assigned_solver).toLowerCase().includes(q))
        );
    });

    // =========================================================================
    // GLOBAL KPI ENGINE (PINNED TO TOP OF ALL TABS)
    // =========================================================================
    const globalKPI = useMemo(() => {
        const counts = {
            total: deptTickets.length,
            open: 0,
            inProgress: 0,
            resolved: 0,
            closed: 0,
            declined: 0,
            late: 0
        };

        deptTickets.forEach(t => {
            const stat = t.status ? t.status.toLowerCase() : '';
            if (stat === 'open') counts.open++;
            else if (stat === 'in progress') counts.inProgress++;
            else if (stat === 'resolved') counts.resolved++;
            else if (stat === 'closed') {
                if (t.closure_type === 'Declined') counts.declined++;
                else counts.closed++;
            }
            if (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) counts.late++;
        });

        return counts;
    }, [deptTickets]);

    const uniqueStatuses = [...new Set(deptTickets.map(t => t.status).filter(Boolean))];
    const uniqueAssignees = [...new Set(deptTickets.map(t => t.assigned_to).filter(Boolean))];
    const uniqueIssues = [...new Set(deptTickets.map(t => t.issue_type).filter(Boolean))];

    const sidebarTabs = [
        { id: 'analytics', label: <><TrendingUp size={12} /> Analytics</> },
        { id: 'overview', label: <><BarChart2 size={12} /> Dept Overview</> },
        { id: 'approvals', label: <><CheckCircle size={12} /> Approvals {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}</> },
        { id: 'override', label: <><Zap size={12} /> Manager Override</> },
        { id: 'rules', label: <><Cog size={12} /> Dept Routing Rules</> }
    ];

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedTicket(null); setIsPanelExpanded(false); }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}
                <div style={{ paddingRight: selectedTicket ? (isPanelExpanded ? '0' : '434px') : '0', transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}><Briefcase size={22} color="#3b82f6" /> {user.department} Department Hub</h2>
                </div>
            
            {error && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '3px', marginBottom: '12px', fontSize: '10px' }}>
                    {error}
                </div>
            )}

            {/* --- GLOBAL KPI METRICS BOARD (ALWAYS VISIBLE) --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '20px', flexShrink: 0 }}>
                <div className="card kpi-blue" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.total}</h2>
                </div>
                <div className="card kpi-amber" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Open</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.open}</h2>
                </div>
                <div className="card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>In Progress</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.inProgress}</h2>
                </div>
                <div className="card kpi-teal" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Resolved</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.resolved}</h2>
                </div>
                <div className="card kpi-green" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Closed</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.closed}</h2>
                </div>
                <div className="card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #6b7280', background: 'linear-gradient(180deg, rgba(107,114,128,0.25) 0%, rgba(107,114,128,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Declined</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.declined}</h2>
                </div>
                <div className="card kpi-red" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 100%)' }}>
                    <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>SLA Breach</p>
                    <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.late}</h2>
                </div>
            </div>
            
            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && !loading && (
                <DeptAnalytics tickets={deptTickets} />
            )}

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && !loading && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="card" style={{ padding: '16px', zIndex: 10, marginBottom: '16px' }}>
                        <TicketFilterBar tickets={deptTickets} onFilter={setFilteredOverviewTickets} usersList={allUsers} />
                    </div>

                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                        <h3 style={{ marginBottom: '12px', fontSize: '14px', flexShrink: 0 }}>Department Workload List</h3>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#18181b', color: '#a1a1aa' }}>
                                    <tr>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'left', fontWeight: '600' }}>Ticket ID</th>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'left', fontWeight: '600' }}>Issue Type</th>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'left', fontWeight: '600' }}>Assigned To</th>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'center', fontWeight: '600' }}>Date Raised</th>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'center', fontWeight: '600' }}>Deadline</th>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                                        <th style={{ borderBottom: '2px solid #27272a', border: '1px solid #27272a', padding: '8px', textAlign: 'left', fontWeight: '600' }}>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOverviewTickets.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#a1a1aa' }}>No tickets match your filter criteria.</td></tr>
                                    ) : (
                                        filteredOverviewTickets.map(t => (
                                            <tr key={t.ticket_id} onClick={() => handleTicketClick(t)} style={{ borderBottom: '1px solid #27272a', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #27272a' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        #{t.ticket_id}
                                                        {t.SLA_Breach && <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>SLA BREACH</span>}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}>{t.issue_type}</td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}>{t.assigned_to ? getDisplayName(t.assigned_to) : <span style={{color: '#ef4444'}}>Unassigned</span>}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{t.timestamp}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#10b981', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{t.deadline || 'N/A'}</td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}><span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{t.closure_type === 'Declined' ? 'Declined' : t.status}</span></td>
                                                <td style={{ color: t.total_score > 10 ? '#ef4444' : 'inherit', fontWeight: t.total_score > 10 ? 'bold' : 'normal', padding: '8px', border: '1px solid #27272a' }}>{t.total_score}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* APPROVALS TAB */}
            {activeTab === 'approvals' && !loading && (
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '14px', flexShrink: 0 }}>Handover Requests</h3>
                    <p style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '16px', flexShrink: 0 }}>Review and approve peer-to-peer ticket transfer requests.</p>
                    
                    {pendingApprovals.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', backgroundColor: '#18181b', borderRadius: '5px' }}>No pending requests.</div>
                    ) : (
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingApprovals.map(t => (
                                <div key={t.ticket_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #27272a', borderRadius: '6px', padding: '12px 16px', backgroundColor: '#18181b', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <strong style={{ fontSize: '13px', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{t.ticket_id} - {t.issue_type}</strong>
                                            <span style={{ fontSize: '10px', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '12px', whiteSpace: 'nowrap' }}>Sev: {t.total_score}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Reason: "{t.reassign_reason}"</p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 24px', borderLeft: '1px solid #3f3f46', borderRight: '1px solid #3f3f46', minWidth: 'fit-content' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '9px', color: '#71717a', textTransform: 'uppercase' }}>From</p>
                                            <strong style={{ fontSize: '11px', color: '#d4d4d8' }}>{getDisplayName(t.assigned_to)}</strong>
                                        </div>
                                        <div style={{ color: '#3b82f6' }}>➔</div>
                                        <div style={{ textAlign: 'left' }}>
                                            <p style={{ margin: 0, fontSize: '9px', color: '#71717a', textTransform: 'uppercase' }}>To</p>
                                            <strong style={{ color: '#60a5fa', fontSize: '11px' }}>{getDisplayName(t.reassign_requested_to)}</strong>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', minWidth: 'fit-content' }}>
                                        <button onClick={() => handleApprovalAction(t.ticket_id, 'approve')} className="btn btn-success" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}><CheckCircle size={14} /> Approve</button>
                                        <button onClick={() => handleApprovalAction(t.ticket_id, 'reject')} className="btn btn-danger" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}><XCircle size={14} /> Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* OVERRIDE TAB */}
            {activeTab === 'override' && !loading && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>Manager Override (Force Reassign)</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Search ticket #, issue, or solver..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '224px', padding: '6px 10px', fontSize: '10px' }}
                            />
                        </div>
                    </div>

                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#18181b' }}>
                                <tr style={{ borderBottom: '2px solid #27272a', color: '#a1a1aa', fontSize: '10px' }}>
                                    <th style={{ padding: '10px', border: '1px solid #27272a' }}>Ticket #</th>
                                    <th style={{ padding: '10px', border: '1px solid #27272a' }}>Issue Type</th>
                                    <th style={{ padding: '10px', border: '1px solid #27272a' }}>Current Solver</th>
                                    <th style={{ padding: '10px', border: '1px solid #27272a', textAlign: 'center' }}>Date Raised</th>
                                    <th style={{ padding: '10px', border: '1px solid #27272a', textAlign: 'center' }}>Deadline</th>
                                    <th style={{ padding: '10px', border: '1px solid #27272a' }}>New Solver</th>
                                    <th style={{ padding: '10px', border: '1px solid #27272a' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOverrideTickets.map(t => (
                                    <tr key={t.ticket_id} style={{ borderBottom: '1px solid #27272a', fontSize: '11px' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #27272a' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                #{t.ticket_id}
                                                {t.SLA_Breach && <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>SLA BREACH</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #27272a' }}>{t.issue_type}</td>
                                        <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{t.assigned_to ? getDisplayName(t.assigned_to) : 'Unassigned'}</td>
                                        <td style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{t.timestamp}</td>
                                        <td style={{ padding: '10px', textAlign: 'center', color: '#10b981', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{t.deadline || 'N/A'}</td>
                                        <td style={{ padding: '10px', border: '1px solid #27272a' }}>
                                            <select 
                                                className="form-control" 
                                                style={{ width: '160px', padding: '5px 10px', fontSize: '10px', margin: 0 }}
                                                onChange={(e) => setOverrideForms(prev => ({...prev, [t.ticket_id]: e.target.value}))}
                                                value={overrideForms[t.ticket_id] || ''}
                                            >
                                                <option value="" disabled>Select new assignee...</option>
                                                {deptSolvers.map(s => (
                                                    <option key={s.email} value={s.email} disabled={s.email === t.assigned_to}>{s.name} ({s.email})</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #27272a' }}>
                                            <button onClick={(e) => handleForceReassign(e, t.ticket_id)} className="btn" style={{ padding: '5px 10px', fontSize: '10px', backgroundColor: '#3b82f6' }}>Execute</button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredOverrideTickets.length === 0 && (
                                    <tr><td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#71717a', fontSize: '10px' }}>No active tickets available matching your search.</td></tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            )}

            {/* RULES TAB */}
            {activeTab === 'rules' && !loading && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '14px', margin: 0 }}>{user.department} Routing Rules</h3>
                        <div style={{ flex: 0.5 }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Filter rules by Issue, Location, or Solver..." 
                                    value={ruleSearchQuery}
                                    onChange={(e) => setRuleSearchQuery(e.target.value)}
                                    style={{ padding: '6px 10px 6px 30px', fontSize: '10px' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#18181b' }}>
                                <tr>
                                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Issue Type</th>
                                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Location</th>
                                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Priority</th>
                                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Deadline</th>
                                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Assigned Solver(s)</th>
                                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRules.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#71717a' }}>No rules match your search.</td></tr>
                                ) : (
                                    filteredRules.map((r, idx) => (
                                        <tr 
                                            key={idx} 
                                            style={{ borderBottom: '1px solid #27272a', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            onClick={() => openRuleModal(r)}
                                        >
                                            <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #27272a' }}>{r.issue_type}</td>
                                            <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{r.outlet && String(r.outlet).toLowerCase() !== 'nan' && !String(r.outlet).toLowerCase().includes('global') ? r.outlet : 'Unassigned'}</td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{r.base_priority}</td>
                                            <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold', border: '1px solid #27272a' }}>{r.deadline_hours || 24} Hrs</td>
                                            <td style={{ padding: '10px', color: '#60a5fa', border: '1px solid #27272a' }}>
                                                {r.assigned_solver && String(r.assigned_solver).toLowerCase() !== 'nan' 
                                                    ? String(r.assigned_solver).split(',').map(s => getDisplayName(s.trim())).join(', ') 
                                                    : <span style={{ color: '#ef4444' }}>Unassigned</span>}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #27272a' }}>
                                                <button className="btn" style={{ padding: '3px 6px', fontSize: '10px', backgroundColor: '#3f3f46' }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}

                </div>
            {/* INLINE TICKET PANEL (Mirrors Admin Dashboard) */}
            {selectedTicket && (
                <>
                    {/* Backdrop */}
                    {isPanelExpanded && (
                        <div className="glass-overlay blur-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setIsPanelExpanded(false)} />
                    )}
                    <div className={!isPanelExpanded ? "card glass-panel slide-in-right-panel" : "card glass-panel"} style={{
                        ...(isPanelExpanded ? { position: 'fixed', top: '5%', bottom: '5%', left: '10%', right: '10%', width: 'auto', margin: 'auto', border: '1px solid #27272a', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' } : { position: 'fixed', right: 0, top: '52px', bottom: 0, width: '450px', margin: 0, borderLeft: '1px solid #27272a', boxShadow: '-10px 0 30px rgba(0,0,0,0.05)' }),
                        overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '24px', zIndex: isPanelExpanded ? 9999 : 1000, backgroundColor: '#09090b', backdropFilter: 'blur(10px)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isPanelExpanded ? '20px 30px' : '0 0 16px 0', marginBottom: isPanelExpanded ? '0' : '16px', borderBottom: isPanelExpanded ? 'none' : '1px solid #27272a', transition: 'padding 0.4s ease' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                                    #{selectedTicket.ticket_id}
                                    <span style={{ backgroundColor: selectedTicket.closure_type === 'Declined' ? 'rgba(239, 68, 68, 0.1)' : selectedTicket.status === 'Closed' ? '#27272a' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedTicket.closure_type === 'Declined' ? '#ef4444' : selectedTicket.status === 'Closed' ? '#a1a1aa' : selectedTicket.status === 'Resolved' ? '#10b981' : '#60a5fa', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>{selectedTicket.closure_type === 'Declined' ? 'Declined' : selectedTicket.status}</span>
                                </h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button onClick={() => setIsPanelExpanded(!isPanelExpanded)} style={{ background: 'none', border: 'none', color: isPanelExpanded ? '#a1a1aa' : '#71717a', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    {isPanelExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: '#71717a', fontSize: '18px', cursor: 'pointer' }}><X size={18} /></button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: isPanelExpanded ? 'center' : 'flex-start', width: '100%', borderBottom: '1px solid #27272a', padding: isPanelExpanded ? '0 30px' : '0', marginBottom: '20px' }}>
                            <button onClick={() => setActivePanelTab('details')} style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'details' ? '#3b82f6' : '#a1a1aa', border: 'none', borderBottom: activePanelTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><FileText size={16} /> Details</button>
                            <button onClick={() => setActivePanelTab('timeline')} style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'timeline' ? '#3b82f6' : '#a1a1aa', border: 'none', borderBottom: activePanelTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Clock size={16} /> Timeline</button>
                            <button onClick={() => setActivePanelTab('chat')} style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'chat' ? '#3b82f6' : '#a1a1aa', border: 'none', borderBottom: activePanelTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><MessageSquare size={16} /> Chat</button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: isPanelExpanded ? '0 30px 30px 30px' : '0', display: 'flex', flexDirection: 'column' }}>
                            {activePanelTab === 'details' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
                                    {/* METADATA GRID (Stacked Labels) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '20px', columnGap: '16px', padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raised On</span>
                                            <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>{selectedTicket.timestamp ? selectedTicket.timestamp.split(' ')[0] : 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requestor</span>
                                            <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{getDisplayName(selectedTicket.raiser_email)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</span>
                                            <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{getDisplayName(selectedTicket.assigned_to)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</span>
                                            <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{selectedTicket.location}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Type</span>
                                            <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{selectedTicket.issue_type}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Score</span>
                                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: selectedTicket.total_score >= 10 ? '#ef4444' : '#10b981' }}>{selectedTicket.total_score} pts</span>
                                        </div>
                                        {selectedTicket.deadline && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline</span>
                                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>{selectedTicket.deadline.split(' ')[1] || selectedTicket.deadline.split(' ')[0] || selectedTicket.deadline}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* ISSUE DESCRIPTION & ATTACHMENT ROW */}
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
                                        <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--bg-card)' }}>
                                            <strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: 'var(--text-main)' }}>Issue Description:</strong>
                                            <div style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto', paddingRight: '4px', fontSize: '13px', lineHeight: '1.6' }}>{selectedTicket.description}</div>
                                        </div>
                                        {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (
                                            <div style={{ width: '100px', flexShrink: 0 }}>
                                                <strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: 'var(--text-main)' }}>Attached File:</strong>
                                                <img 
                                                    src={String(selectedTicket.attachment).startsWith('data:') ? String(selectedTicket.attachment) : `/uploads/${selectedTicket.attachment}`}
                                                    onClick={() => {
                                                        const attachStr = String(selectedTicket.attachment);
                                                        window.open(attachStr.startsWith('data:') ? attachStr : `/uploads/${attachStr}`, '_blank');
                                                    }}
                                                    style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                                    alt="Attachment"
                                                    title="Click to view full size"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activePanelTab === 'timeline' ? (
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    <TicketTimeline logs={ticketLogs} userRole={user?.role} />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {logsLoading ? <p style={{ color: '#71717a', fontSize: '11px', textAlign: 'center' }}>Loading conversation...</p> : (
                                            ticketLogs.map((log, i) => {
                                                const isChat = log.action === 'Chat' || log.action === 'Message';
                                                if (!isChat) return null;
                                                const isMe = log.user === user.email || log.user === user.name || log.user_id === user.email || log.user_id === user.employee_id;
                                                return (
                                                    <div key={i} className={isMe ? 'chat-bubble-me' : 'chat-bubble-other'} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', borderRadius: '8px', padding: '10px 12px', backgroundColor: isMe ? '#1e3a8a' : '#27272a', border: '1px solid #3f3f46' }}>
                                                        <div style={{ fontSize: '10px', marginBottom: '4px', fontWeight: 'bold', color: '#fff' }}>{log.user || log.user_id || 'System'}</div>
                                                        <div style={{ fontSize: '12px', lineHeight: '1.4', color: '#ededed' }}>{log.remarks || log.details}</div>
                                                        <div style={{ fontSize: '9px', marginTop: '6px', textAlign: 'right', color: '#a1a1aa' }}>{log.timestamp}</div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ENTERPRISE DIALOG MODAL (Moved outside main tabs for proper viewport centering) */}
            {isRuleModalOpen && (
                <div className="glass-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-modal" style={{ padding: '20px', borderRadius: '5px', width: '480px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Edit Routing Rule</h3>
                            <button onClick={() => setIsRuleModalOpen(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '16px', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleUpdateRule}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '10px' }}>Issue Type</label>
                                    <input type="text" className="form-control" disabled value={editRule.issue_type} style={{ backgroundColor: '#09090b', color: '#71717a', fontSize: '10px', padding: '6px 10px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '10px' }}>Location / Outlet</label>
                                    <input type="text" className="form-control" disabled value={editRule.outlet && String(editRule.outlet).toLowerCase() !== 'nan' && !String(editRule.outlet).toLowerCase().includes('global') ? editRule.outlet : 'Unassigned'} style={{ backgroundColor: '#09090b', color: '#71717a', fontSize: '10px', padding: '6px 10px' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '10px' }}>Base Priority (1-5)</label>
                                    <input type="number" className="form-control" required value={editRule.base_priority} onChange={e => setEditRule({...editRule, base_priority: parseInt(e.target.value)})} style={{ fontSize: '10px', padding: '6px 10px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label style={{ fontSize: '10px' }}>Deadline (Hours)</label>
                                    <input type="number" className="form-control" required value={editRule.deadline_hours || 24} onChange={e => setEditRule({...editRule, deadline_hours: parseInt(e.target.value)})} style={{ fontSize: '10px', padding: '6px 10px' }} />
                                </div>
                            </div>

                            {/* CHECKBOX UI FOR SOLVERS */}
                            <div className="form-group">
                                <label style={{ color: '#60a5fa', marginBottom: '6px', display: 'block', fontSize: '10px' }}>Assign Solvers (Round Robin)</label>
                                <div style={{ 
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', 
                                    maxHeight: '128px', overflowY: 'auto', backgroundColor: '#09090b', 
                                    padding: '10px', borderRadius: '5px', border: '1px solid #27272a' 
                                }}>
                                    {deptSolvers.filter(u => u.is_active !== false).map(u => {
                                        const isSelected = editRule.assigned_solver && String(editRule.assigned_solver).includes(String(u.employee_id));
                                        return (
                                            <label key={u.employee_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', cursor: 'pointer', color: isSelected ? '#fff' : '#a1a1aa' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => handleSolverToggle(String(u.employee_id))}
                                                    style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: '#3b82f6' }}
                                                />
                                                {u.name} ({u.employee_id})
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #27272a' }}>
                                <button type="button" className="btn" onClick={() => setIsRuleModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '10px', padding: '6px 10px' }}>Save Changes</button>
                            </div>
                        </form>

                    </div>
                </div>
            )}
            </div>
        </Layout>
    );
};

export default DeptHeadDashboard;