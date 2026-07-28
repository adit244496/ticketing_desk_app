// frontend/src/pages/SolverDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api, { fetchTickets, updateTicketStatus, requestTicketHandover, rateRequestor, fetchUsers, fetchTicketLogs } from '../api';
import Layout from '../components/Layout';
import TicketTimeline from '../components/TicketTimeline';
import TicketFilterBar from '../components/TicketFilterBar';
import { Paperclip, Star, MessageSquare, Wrench, Zap, CheckCircle, FileText, Clock, Maximize2, Minimize2, Download, X, ChevronRight, CheckSquare, ArrowRightLeft } from 'lucide-react';

const SolverDashboard = ({ user, setUser }) => {
    const [tickets, setTickets] = useState([]);
    const [filteredTickets, setFilteredTickets] = useState([]);
    const [peers, setPeers] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [activeTab, setActiveTab] = useState('active');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State to handle form inputs dynamically per ticket
    const [updateForms, setUpdateForms] = useState({});
    const [handoverForms, setHandoverForms] = useState({});
    const [ratingForms, setRatingForms] = useState({});

    // Modal & Chat State
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [hoverRating, setHoverRating] = useState(0);
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState('details');
    const [chatInput, setChatInput] = useState('');
    const [chatFile, setChatFile] = useState(null);
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [isHandoverUnlocked, setIsHandoverUnlocked] = useState(false);
    const [showHandoverConfirm, setShowHandoverConfirm] = useState(false);
    
    const location = useLocation();

    // Reset expanded panel and selected ticket when navigating (even to the same route)
    useEffect(() => {
        setSelectedTicket(null);
        setIsPanelExpanded(false);
    }, [location.key]);

    const handleDownloadTimeline = () => {
        if (!ticketLogs || ticketLogs.length === 0) return;
        const headers = ['timestamp', 'ticket_id', 'user', 'action', 'details', 'remarks'];
        const csvRows = [headers.join(',')];
        for (const log of ticketLogs) {
            const values = headers.map(header => {
                const val = log[header] !== null && log[header] !== undefined ? log[header] : '';
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }
        const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Ticket_${selectedTicket?.ticket_id}_Logs.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [ticketData, userData] = await Promise.all([
                fetchTickets(),
                fetchUsers()
            ]);

            setUsersList(userData);

            let safeTickets = ticketData?.data || ticketData;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);

            // Allow exact match with the new "Name (Phone)" format or raw ID
            const myTickets = safeTickets.filter(t => {
                const assignedRaw = String(t.assigned_to);
                return assignedRaw.includes(user.name) ||
                    assignedRaw.includes(String(user.employee_id)) ||
                    assignedRaw === String(user.email);
            });
            setTickets(myTickets);

            const deptPeers = userData.filter(u =>
                u.department === user.department &&
                u.email !== user.email &&
                String(u.employee_id) !== String(user.employee_id)
            );
            setPeers(deptPeers);
        } catch (err) {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    const handleTicketClick = async (ticket) => {
        setUpdateForms(prev => ({ ...prev, [ticket.ticket_id]: { status: ticket.status, remarks: ticket.solver_comments && ticket.solver_comments !== 'nan' ? ticket.solver_comments : '' } }));
        setSelectedTicket(ticket);
        setIsHandoverUnlocked(false);
        setShowHandoverConfirm(false);
        setActivePanelTab('details'); // Default to details view
        setLogsLoading(true);
        try {
            const logs = await fetchTicketLogs(ticket.ticket_id);
            setTicketLogs(logs);
        } catch (err) {
            console.error("Failed to load logs", err);
            setTicketLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleSendChat = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() && !chatFile) return;

        try {
            if (chatFile) {
                const formData = new FormData();
                formData.append('ticket_id', selectedTicket.ticket_id);
                formData.append('user_email', user.email);
                formData.append('message', chatInput);
                formData.append('file', chatFile);
                await fetch('/api/tickets/chat', {
                    method: 'POST',
                    body: formData
                });
            } else {
                await api.post('/tickets/chat', {
                    ticket_id: selectedTicket.ticket_id,
                    user_email: user.email,
                    message: chatInput
                });
            }
            
            setChatInput('');
            setChatFile(null);

            // Refresh logs seamlessly
            const logs = await fetchTicketLogs(selectedTicket.ticket_id);
            setTicketLogs(logs);
        } catch (err) {
            alert("Failed to send message. Ensure your backend is updated.");
        }
    };

    const getUserDetails = (identifier) => {
        if (!identifier || String(identifier).toLowerCase() === 'nan') return 'Unknown';
        const foundUser = usersList.find(u => String(u.email) === String(identifier) || String(u.employee_id) === String(identifier));
        return foundUser ? `${foundUser.name} (${foundUser.phone || 'N/A'})` : identifier;
    };

    const handleStatusUpdate = async (e, ticketId, currentStatus, currentRemarks) => {
        e.preventDefault();
        const formState = updateForms[ticketId] || {};
        const newStatus = formState.status !== undefined ? formState.status : currentStatus;
        const remarks = formState.remarks !== undefined ? formState.remarks : '';
        const file = formState.file;

        if (newStatus === 'Open') {
            alert("Please select a valid status from the dropdown to update this ticket.");
            return;
        }

        if (newStatus === 'Decline' && !remarks.trim()) {
            alert("Remarks are mandatory when declining a ticket.");
            return;
        }

        try {
            if (file) {
                const formData = new FormData();
                formData.append('ticket_id', ticketId);
                formData.append('status', newStatus);
                formData.append('remarks', remarks);
                formData.append('file', file);
                await updateTicketStatus(formData);
            } else {
                await updateTicketStatus({ ticket_id: ticketId, status: newStatus, remarks });
            }
            alert("Ticket updated successfully!");
            setUpdateForms(prev => {
                const next = { ...prev };
                delete next[ticketId];
                return next;
            });
            setSelectedTicket(null); // Close modal on success
            loadDashboardData();
        } catch (err) {
            alert("Failed to update ticket.");
        }
    };

    const handleHandoverRequest = async (e, ticketId) => {
        e.preventDefault();
        const formState = handoverForms[ticketId] || {};
        const targetId = formState.target || (peers.length > 0 ? peers[0].employee_id : '');
        const reason = formState.reason || '';

        if (!reason.trim()) {
            alert("You must provide a reason for the handover.");
            return;
        }

        try {
            await requestTicketHandover({ ticket_id: ticketId, target_email: targetId, reason });
            alert("Handover request submitted to your Department Head.");
            setHandoverForms(prev => {
                const next = { ...prev };
                delete next[ticketId];
                return next;
            });
            setSelectedTicket(null); // Close modal
            loadDashboardData();
        } catch (err) {
            const errorMsg = err.response?.data?.error || "Failed to submit handover request.";
            alert(errorMsg);
        }
    };

    const handleRateRequestor = async (e, ticketId) => {
        e.preventDefault();
        const formState = ratingForms[ticketId] || {};
        const rating = formState.rating || 0; // Default to 0
        const remark = formState.remark || '';

        if (rating === 0) {
            alert("Please select a star rating.");
            return;
        }


        try {
            await rateRequestor({ ticket_id: ticketId, rating, remark });
            alert("Rating submitted successfully!");
            setRatingForms(prev => {
                const next = { ...prev };
                delete next[ticketId];
                return next;
            });
            setSelectedTicket(null); // Close modal
            loadDashboardData();
        } catch (err) {
            alert("Failed to submit rating.");
        }
    };

    const handleUpdateFormChange = (ticketId, field, value) => {
        setUpdateForms(prev => ({ ...prev, [ticketId]: { ...prev[ticketId] || {}, [field]: value } }));
    };
    const handleHandoverFormChange = (ticketId, field, value) => {
        setHandoverForms(prev => ({ ...prev, [ticketId]: { ...prev[ticketId] || {}, [field]: value } }));
    };
    const handleRatingFormChange = (ticketId, field, value) => {
        setRatingForms(prev => ({ ...prev, [ticketId]: { ...prev[ticketId] || {}, [field]: value } }));
    };

    const activeTickets = filteredTickets.filter(t => t.status !== 'Closed').sort((a, b) => b.total_score - a.total_score);
    const closedTickets = filteredTickets.filter(t => t.status === 'Closed');

    const isLate = (ticket) => {
        if (!ticket.deadline || String(ticket.deadline).toLowerCase() === 'nan' || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        try {
            const [datePart, timePart] = String(ticket.deadline).split(' ');
            const [day, month, year] = datePart.split('-');
            const [hours, minutes] = timePart ? timePart.split(':') : [0, 0];
            const deadlineDate = new Date(year, month - 1, day, hours, minutes);
            return deadlineDate < new Date();
        } catch (e) { return false; }
    };

    const kpi = {
        total: tickets.length,
        open: tickets.filter(t => ['Open', 'Reopened'].includes(t.status)).length,
        inProgress: tickets.filter(t => t.status === 'In Progress').length,
        resolved: tickets.filter(t => t.status === 'Resolved').length,
        declined: tickets.filter(t => t.status === 'Decline').length,
        closed: tickets.filter(t => t.status === 'Closed').length,
        late: tickets.filter(t => isLate(t)).length
    };

    const ratedTickets = closedTickets.filter(t => t.solver_rating && !isNaN(t.solver_rating));
    const avgRating = ratedTickets.length > 0
        ? (ratedTickets.reduce((sum, t) => sum + Number(t.solver_rating), 0) / ratedTickets.length).toFixed(1)
        : 'New';

    const sidebarTabs = [
        { id: 'active', label: <><Zap size={12} /> Active Tasks ({activeTickets.length})</> },
        { id: 'closed', label: <><CheckCircle size={12} /> Closed Tasks ({closedTickets.length})</> }
    ];

    const renderTicketTable = (ticketList) => (
        <div className="card" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead style={{ backgroundColor: '#18181b', borderBottom: '2px solid #27272a', position: 'sticky', top: 0 }}>
                        <tr>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Ticket ID</th>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Date Raised</th>
                            <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Image</th>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Department</th>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Issue Type</th>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Location</th>
                            <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Severity</th>
                            <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Deadline</th>
                            <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ticketList.length === 0 ? (
                            <tr><td colSpan="9" style={{ padding: '16px', textAlign: 'center', color: '#71717a' }}>No tickets found in this queue.</td></tr>
                        ) : (
                            ticketList.map(t => (
                                <tr
                                    key={t.ticket_id}
                                    onClick={() => handleTicketClick(t)}
                                    style={{
                                        borderBottom: '1px solid #27272a',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s',
                                        borderLeft: activeTab === 'active' && t.total_score >= 10 ? '2px solid #ef4444' : '2px solid transparent'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#fff', border: '1px solid #27272a' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            #{t.ticket_id}
                                            {t.SLA_Breach && <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>SLA BREACH</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{t.timestamp}</td>
                                    <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>
                                        {t.attachment && String(t.attachment).toLowerCase() !== 'nan' ? (
                                            <img src={String(t.attachment).startsWith('data:') ? String(t.attachment) : `/uploads/${t.attachment}`} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3f3f46' }} alt="Attachment" />
                                        ) : <span style={{ color: '#52525b' }}>-</span>}
                                    </td>
                                    <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{t.dept_assigned}</td>
                                    <td style={{ padding: '10px', border: '1px solid #27272a' }}>{t.issue_type}</td>
                                    <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{t.location}</td>
                                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: t.total_score >= 10 ? '#ef4444' : '#10b981', border: '1px solid #27272a' }}>{t.total_score}</td>
                                    <td style={{ padding: '10px', color: '#10b981', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{t.deadline || 'N/A'}</td>
                                    <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold',
                                            backgroundColor: t.status === 'Open' ? 'rgba(245, 158, 11, 0.1)' : t.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : t.closure_type === 'Declined' ? 'rgba(239, 68, 68, 0.1)' : t.status === 'Closed' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                            color: t.status === 'Open' ? '#f59e0b' : t.status === 'Resolved' ? '#10b981' : t.closure_type === 'Declined' ? '#ef4444' : t.status === 'Closed' ? '#14b8a6' : '#3b82f6'
                                        }}>
                                            {t.closure_type === 'Declined' ? 'Declined' : t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    
    const renderActionForms = () => (
        <div style={{ marginTop: '0px' }}>
            {selectedTicket.status === 'Closed' ? (
                <div>
                    <h4 style={{ margin: '0 0 10px 0' }}>Action & Ratings</h4>
                    {selectedTicket.closure_type === 'Declined' ? (
                        <div style={{ color: '#ef4444', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            ❌ You declined this ticket. (Reason: {selectedTicket.solver_comments})
                        </div>
                    ) : selectedTicket.requestor_rating ? (
                        <div style={{ color: '#10b981', fontSize: '13px', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Star size={16} fill="#10b981" color="#10b981" /> You rated the requestor {selectedTicket.requestor_rating}/5.
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#09090b', padding: '15px', borderRadius: '6px', border: '1px dashed #3f3f46' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                        key={star}
                                        size={28}
                                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                        fill={star <= (hoverRating || (ratingForms[selectedTicket.ticket_id]?.rating || 0)) ? "#f59e0b" : "transparent"}
                                        color={star <= (hoverRating || (ratingForms[selectedTicket.ticket_id]?.rating || 0)) ? "#f59e0b" : "#3f3f46"}
                                        onClick={() => handleRatingFormChange(selectedTicket.ticket_id, 'rating', star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                    />
                                ))}
                            </div>
                            <form onSubmit={(e) => handleRateRequestor(e, selectedTicket.ticket_id)} style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    style={{ flex: 1, backgroundColor: '#18181b', color: '#fff', border: '1px solid #27272a', margin: 0 }}
                                    placeholder="Reason for rating..."
                                    value={ratingForms[selectedTicket.ticket_id]?.remark || ''}
                                    onChange={(e) => handleRatingFormChange(selectedTicket.ticket_id, 'remark', e.target.value)}
                                />
                                <button type="submit" className="btn">Submit Rating</button>
                            </form>
                        </div>
                    )}
                </div>
            ) : (
                /* ACTIVE TICKET VIEW */
                <div>
                    {selectedTicket.reassign_requested_to && String(selectedTicket.reassign_requested_to).toLowerCase() !== 'nan' && String(selectedTicket.reassign_requested_to).trim() !== '' ? (
                        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '16px', borderRadius: '6px', fontSize: '11px', border: '1px solid rgba(59, 130, 246, 0.2)', marginTop: '20px', textAlign: 'center' }}>
                            ⏳ <strong>Handover Pending Approval</strong><br/>
                            <span style={{color: '#a1a1aa', fontSize: '10px'}}>This ticket is locked while waiting for your Department Head to approve the transfer.</span>
                        </div>
                    ) : selectedTicket.status === 'Resolved' ? (
                        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '16px', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '10px', textAlign: 'center' }}>
                            ✅ <strong>Ticket Resolved</strong><br/>
                            <span style={{color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'inline-block'}}>Status updates are locked while awaiting closure by the requestor.</span>
                        </div>
                    ) : (
                        <>
                            <form onSubmit={(e) => handleStatusUpdate(e, selectedTicket.ticket_id, selectedTicket.status, selectedTicket.solver_comments)} style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '6px', marginBottom: '8px' }}>
                                {/* ROW 1 */}
                                <select
                                    className="form-control"
                                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '11px', padding: '0 10px', height: '32px', width: '100%', margin: 0, borderRadius: '6px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)', fontWeight: '500' }}
                                    value={updateForms[selectedTicket.ticket_id]?.status !== undefined ? updateForms[selectedTicket.ticket_id].status : selectedTicket.status}
                                    onChange={(e) => handleUpdateFormChange(selectedTicket.ticket_id, 'status', e.target.value)}
                                >
                                    {selectedTicket.status === 'Open' && <option value="Open" disabled hidden>Select Status</option>}
                                    {(selectedTicket.status === 'Resolved' ? ['Resolved'] : ["In Progress", "Resolved", "Decline"]).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>

                                {!updateForms[selectedTicket.ticket_id]?.file ? (
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', border: '1px solid var(--border)', padding: '0', borderRadius: '6px', fontSize: '11px', color: 'var(--text-main)', backgroundColor: 'var(--bg-main)', margin: 0, transition: 'all 0.2s', fontWeight: '600', height: '32px', width: '100%', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }} onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-main)'; }}>
                                        <Paperclip size={12} /> Attach
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleUpdateFormChange(selectedTicket.ticket_id, 'file', e.target.files[0])}
                                        />
                                    </label>
                                ) : (
                                    <div style={{ position: 'relative', width: '100%', height: '32px', borderRadius: '6px', border: '2px solid #3b82f6', padding: '2px', backgroundColor: 'var(--bg-card)', boxShadow: '0 2px 8px rgba(59,130,246,0.15)' }}>
                                        <img 
                                            src={URL.createObjectURL(updateForms[selectedTicket.ticket_id].file)} 
                                            alt="Preview" 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px', cursor: 'pointer', transition: 'opacity 0.2s' }} 
                                            onClick={() => window.open(URL.createObjectURL(updateForms[selectedTicket.ticket_id].file), '_blank')}
                                            onMouseOver={e => e.currentTarget.style.opacity = 0.8}
                                            onMouseOut={e => e.currentTarget.style.opacity = 1}
                                            title="Click to preview"
                                        />
                                        <button type="button" onClick={() => handleUpdateFormChange(selectedTicket.ticket_id, 'file', null)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 10, transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'} title="Remove image">
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}

                                {/* ROW 2 */}
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Resolution Notes..."
                                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '11px', padding: '0 10px', height: '32px', width: '100%', margin: 0, borderRadius: '6px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                                    value={updateForms[selectedTicket.ticket_id]?.remarks !== undefined ? updateForms[selectedTicket.ticket_id].remarks : ''}
                                    onChange={(e) => handleUpdateFormChange(selectedTicket.ticket_id, 'remarks', e.target.value)}
                                />
                                <button type="submit" className="btn" style={{ fontSize: '11px', padding: '0', borderRadius: '6px', backgroundColor: '#10b981', fontWeight: '700', boxShadow: '0 2px 4px rgba(16,185,129,0.2)', transition: 'all 0.2s', height: '32px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>Save</button>
                            </form>

                            {!isHandoverUnlocked ? (
                                <button 
                                    onClick={() => setIsHandoverUnlocked(true)} 
                                    style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '600' }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-main)'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                >
                                    <ArrowRightLeft size={12} /> Request Handover
                                </button>
                            ) : (
                                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', backgroundColor: 'var(--bg-main)', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-main)' }}><ArrowRightLeft size={12} color="#3b82f6" /> Handover Request</span>
                                        <button onClick={() => setIsHandoverUnlocked(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}><X size={12} /></button>
                                    </div>
                                    <form onSubmit={(e) => handleHandoverRequest(e, selectedTicket.ticket_id)} style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '6px' }}>
                                        <select
                                            className="form-control"
                                            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', margin: 0, fontSize: '11px', padding: '0 10px', height: '32px', borderRadius: '6px', fontWeight: '500', gridColumn: '1 / -1', width: '100%' }}
                                            value={handoverForms[selectedTicket.ticket_id]?.target || ''}
                                            onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'target', e.target.value)}
                                        >
                                            <option value="" disabled>Select peer...</option>
                                            {peers.map(p => <option key={p.employee_id} value={p.employee_id}>{p.name}</option>)}
                                        </select>
                                        
                                        <input
                                            type="text"
                                            className="form-control"
                                            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', margin: 0, fontSize: '11px', padding: '0 10px', height: '32px', borderRadius: '6px', width: '100%' }}
                                            placeholder="Reason (Required)"
                                            value={handoverForms[selectedTicket.ticket_id]?.reason || ''}
                                            onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'reason', e.target.value)}
                                        />
                                        <button type="submit" className="btn" style={{ fontSize: '11px', padding: '0', borderRadius: '6px', backgroundColor: '#3b82f6', fontWeight: '700', height: '32px', width: '100%', boxShadow: '0 2px 4px rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Request</button>
                                    </form>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedTicket(null); setIsPanelExpanded(false); }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

                {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}
                <div style={{ paddingRight: selectedTicket ? (isPanelExpanded ? '0' : '434px') : '0', transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flex: 1, display: 'flex', flexDirection: 'column' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckSquare size={20} color="#3b82f6" />
                            My Assigned Tasks
                        </h2>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '11px' }}>
                            <span style={{ color: '#a1a1aa' }}>Average Rating:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px', color: '#10b981', fontWeight: 'bold' }}>
                                <Star size={12} fill="#10b981" />
                                {avgRating} {avgRating !== 'New' && '/ 5.0'}
                            </div>
                        </div>
                    </div>

                    {/* GLOBAL KPI TILES */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '16px', flexShrink: 0 }}>
                        <div className="card kpi-blue" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.total}</h2>
                        </div>
                        <div className="card kpi-amber" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Open</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.open}</h2>
                        </div>
                        <div className="card kpi-blue" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #6366f1', background: 'linear-gradient(180deg, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>In Progress</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.inProgress}</h2>
                        </div>
                        <div className="card kpi-green" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Resolved</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.resolved}</h2>
                        </div>
                        <div className="card kpi-amber" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #f97316', background: 'linear-gradient(180deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Declined</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.declined}</h2>
                        </div>
                        <div className="card kpi-green" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Closed</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.closed}</h2>
                        </div>
                        <div className="card kpi-red" style={{ padding: '10px', margin: 0, textAlign: 'center', borderTop: '2px solid #ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Late</p>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{kpi.late}</h2>
                        </div>
                    </div>

                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '3px', marginBottom: '12px', fontSize: '10px' }}>{error}</div>}
                {loading && <p style={{ color: '#a1a1aa', fontSize: '10px' }}>Loading your tasks...</p>}

                <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                    <div style={{ flex: 1, minWidth: 0, transition: 'all 0.3s', display: 'flex', flexDirection: 'column' }}>
                        <div className="card" style={{ padding: '16px', zIndex: 10, marginBottom: '16px' }}>
                            <TicketFilterBar tickets={tickets} onFilter={setFilteredTickets} usersList={usersList} />
                        </div>
                        {!selectedTicket ? (
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                {!loading && activeTab === 'active' && renderTicketTable(activeTickets)}
                                {!loading && activeTab === 'closed' && renderTicketTable(closedTickets)}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                {!loading && activeTab === 'active' && renderTicketTable(activeTickets)}
                                {!loading && activeTab === 'closed' && renderTicketTable(closedTickets)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* NEW Master-Detail Right Panel (FIXED SIDEBAR) */}
            {selectedTicket && (
                <>
                    {/* OVERLAY FOR EXPANDED VIEW */}
                    {isPanelExpanded && (
                        <div
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
                            onClick={() => setIsPanelExpanded(false)}
                        />
                    )}
                    <div className={!isPanelExpanded ? "slide-in-right-panel" : ""} style={{
                        ...(isPanelExpanded ? {
                            position: 'fixed', top: '5%', bottom: '5%', left: '10%', right: '10%', width: 'auto',
                            margin: 'auto', border: '1px solid var(--border)', borderRadius: '12px',
                            boxShadow: 'var(--shadow-lg)'
                        } : {
                            position: 'fixed', right: 0, top: '52px', bottom: 0, width: '450px',
                            margin: 0, borderLeft: '1px solid var(--border)',
                            boxShadow: '-10px 0 30px rgba(0,0,0,0.05)'
                        }),
                        overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '24px',
                        zIndex: isPanelExpanded ? 9999 : 1000, backgroundColor: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>

                        {/* Modal Header with View Toggle */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: isPanelExpanded ? '20px 30px' : '0 0 16px 0',
                            marginBottom: isPanelExpanded ? '0' : '16px',
                            borderBottom: isPanelExpanded ? 'none' : '1px solid var(--border)',
                            transition: 'padding 0.4s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <h3 style={{ margin: '0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)' }}>
                                    #{selectedTicket.ticket_id}
                                    <span style={{
                                        backgroundColor: selectedTicket.status === 'Closed' ? 'var(--bg-main)' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                        color: selectedTicket.status === 'Closed' ? 'var(--text-muted)' : selectedTicket.status === 'Resolved' ? '#10b981' : '#3b82f6',
                                        padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
                                    }}>{selectedTicket.closure_type === 'Declined' ? 'Declined' : selectedTicket.status}</span>
                                </h3>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <button onClick={() => setIsPanelExpanded(!isPanelExpanded)} style={{ background: 'none', border: 'none', color: isPanelExpanded ? '#4b5563' : '#a1a1aa', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    {isPanelExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: isPanelExpanded ? '#4b5563' : '#a1a1aa', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* --- PANEL TABS --- */}
                        <div style={{
                            display: 'flex',
                            justifyContent: isPanelExpanded ? 'center' : 'flex-start',
                            width: '100%',
                            borderBottom: '1px solid #e5e7eb',
                            padding: isPanelExpanded ? '0 30px' : '0',
                            marginBottom: '20px'
                        }}>
                            <div style={{ display: 'flex', width: isPanelExpanded ? '60%' : '100%' }}>
                                <button
                                    onClick={() => setActivePanelTab('details')}
                                    style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'details' ? 'var(--primary)' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'details' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <FileText size={16} /> Details
                                </button>
                                <button
                                    onClick={() => setActivePanelTab('timeline')}
                                    style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'timeline' ? 'var(--primary)' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'timeline' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Clock size={16} /> Timeline
                                </button>
                                <button
                                    onClick={() => setActivePanelTab('chat')}
                                    style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'chat' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <MessageSquare size={16} /> Chat
                                </button>
                            </div>
                        </div>

                        {/* Tab Content Wrap */}
                        <div style={{ flex: activePanelTab === 'details' ? 'none' : 1, overflowY: 'auto', padding: isPanelExpanded ? '0 30px 30px 30px' : '0', display: 'flex', flexDirection: 'column' }}>
                            {activePanelTab === 'chat' ? (
                                <>
                                    {isPanelExpanded ? (
                                        <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flex: 1, minHeight: 0, paddingBottom: '12px' }}>
                                            {/* TILE 1: CHAT */}
                                            <div style={{ flex: '1', minWidth: '300px', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', minHeight: 0 }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                    <div style={{ padding: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <MessageSquare size={14} color="#3b82f6" />
                                                    </div>
                                                    Conversation
                                                </h4>
                                                <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                                                    {logsLoading ? (
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>Loading conversation...</p>
                                                    ) : ticketLogs.length === 0 ? (
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>No history available yet.</p>
                                                    ) : (
                                                        ticketLogs.map((log, i) => {
                                                            const isChat = log.action === 'Chat' || log.action === 'Message';
                                                            const isMe = log.user === user.email || log.user === user.name || log.user_id === user.email || log.user_id === user.employee_id;
                                                            if (!isChat) return null;
                                                            return (
                                                                <div key={i} className={isMe ? 'chat-bubble-me' : 'chat-bubble-other'} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                                                                    <div className="chat-bubble-user" style={{ fontSize: '11px', marginBottom: '4px', fontWeight: 'bold' }}>{log.user || log.user_id || 'System'}</div>
                                                                    
                                                                    {log.attachment && String(log.attachment).toLowerCase() !== 'nan' && (
                                                                        <div style={{ marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', maxWidth: '100%' }} onClick={() => window.open(`/uploads/${log.attachment}`, '_blank')}>
                                                                            <img src={`/uploads/${log.attachment}`} alt="Attached" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover' }} />
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <div className="chat-bubble-text" style={{ fontSize: '12px', lineHeight: '1.4' }}>{log.remarks || log.details}</div>
                                                                    <div className="chat-bubble-time" style={{ fontSize: '10px', marginTop: '6px', textAlign: 'right' }}>{log.timestamp}</div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                                {selectedTicket.status === 'Closed' ? (
                                                    <div style={{ marginTop: '16px', padding: '12px', textAlign: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                                        This ticket is closed. New messages cannot be sent.
                                                    </div>
                                                ) : (
                                                    <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px', flexShrink: 0, alignItems: 'center' }}>
                                                        {!chatFile ? (
                                                            <label style={{ cursor: 'pointer', padding: '10px 14px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach Image">
                                                                <Paperclip size={16} color="var(--text-muted)" />
                                                                <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => setChatFile(e.target.files[0])} />
                                                            </label>
                                                        ) : (
                                                            <div style={{ position: 'relative', height: '36px', width: '48px', borderRadius: '6px', border: '2px solid #10b981', flexShrink: 0 }}>
                                                                <img src={URL.createObjectURL(chatFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                                                <button type="button" onClick={() => setChatFile(null)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', borderRadius: '50%', zIndex: 10 }}>
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={chatInput}
                                                            onChange={e => setChatInput(e.target.value)}
                                                            placeholder="Type a message to the requestor..."
                                                            style={{ margin: 0, flex: 1, fontSize: '12px', padding: '10px 14px', borderRadius: '8px' }}
                                                        />
                                                        <button type="submit" className="btn" style={{ backgroundColor: '#10b981', fontSize: '12px', padding: '10px 20px', borderRadius: '8px', fontWeight: '600' }}>Send</button>
                                                    </form>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                            <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {logsLoading ? (
                                                    <p style={{ color: '#71717a', fontSize: '10px', textAlign: 'center' }}>Loading conversation...</p>
                                                ) : ticketLogs.length === 0 ? (
                                                    <p style={{ color: '#71717a', fontSize: '10px', textAlign: 'center' }}>No history available yet.</p>
                                                ) : (
                                                    ticketLogs.map((log, i) => {
                                                        const isChat = log.action === 'Chat' || log.action === 'Message';
                                                        const isMe = log.user === user.email || log.user === user.name || log.user_id === user.email || log.user_id === user.employee_id;
                                                        if (!isChat) return null;
                                                        return (
                                                            <div key={i} className={isMe ? 'chat-bubble-me' : 'chat-bubble-other'} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                                                                <div className="chat-bubble-user" style={{ fontSize: '10px', marginBottom: '4px', fontWeight: 'bold' }}>{log.user || log.user_id || 'System'}</div>
                                                                
                                                                {log.attachment && String(log.attachment).toLowerCase() !== 'nan' && (
                                                                    <div style={{ marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', maxWidth: '100%' }} onClick={() => window.open(`/uploads/${log.attachment}`, '_blank')}>
                                                                        <img src={`/uploads/${log.attachment}`} alt="Attached" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover' }} />
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="chat-bubble-text" style={{ fontSize: '11px', lineHeight: '1.4' }}>{log.remarks || log.details}</div>
                                                                <div className="chat-bubble-time" style={{ fontSize: '9px', marginTop: '6px', textAlign: 'right' }}>{log.timestamp}</div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            {selectedTicket.status === 'Closed' ? (
                                                <div style={{ marginTop: '12px', padding: '10px', textAlign: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                                                    This ticket is closed. New messages cannot be sent.
                                                </div>
                                            ) : (
                                                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                                                    {!chatFile ? (
                                                        <label style={{ cursor: 'pointer', padding: '6px 8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach Image">
                                                            <Paperclip size={14} color="var(--text-muted)" />
                                                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => setChatFile(e.target.files[0])} />
                                                        </label>
                                                    ) : (
                                                        <div style={{ position: 'relative', height: '28px', width: '36px', borderRadius: '4px', border: '1px solid #10b981', flexShrink: 0 }}>
                                                            <img src={URL.createObjectURL(chatFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }} />
                                                            <button type="button" onClick={() => setChatFile(null)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', borderRadius: '50%', zIndex: 10 }}>
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={chatInput}
                                                        onChange={e => setChatInput(e.target.value)}
                                                        placeholder="Type a message to the requestor..."
                                                        style={{ margin: 0, flex: 1, fontSize: '10px', padding: '8px 12px' }}
                                                    />
                                                    <button type="submit" className="btn" style={{ backgroundColor: '#10b981', fontSize: '10px', padding: '8px 16px' }}>Send</button>
                                                </form>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : activePanelTab === 'details' ? (
                                <>
                                    {isPanelExpanded ? (
                                        /* --- EXPANDED HORIZONTAL DETAILS VIEW --- */
                                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                                            {/* ULTRA-MODERN METADATA HEADER */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px', flexShrink: 0 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Raised On</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{selectedTicket.timestamp}</span>
                                                </div>
                                                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }}></div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Raiser</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#3b82f6' }}>{getUserDetails(selectedTicket.raiser_email)}</span>
                                                </div>
                                                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }}></div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Assigned To</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#3b82f6' }}>{getUserDetails(selectedTicket.assigned_to)}</span>
                                                </div>
                                                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }}></div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Location</span>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{selectedTicket.location}</span>
                                                </div>
                                                {selectedTicket.deadline && (
                                                    <>
                                                        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }}></div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Deadline</span>
                                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#ef4444' }}>{selectedTicket.deadline}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
                                                
                                                {/* TILE 1: IMAGE PREVIEW (If any) */}
                                                {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (() => {
                                                    const attachStr = String(selectedTicket.attachment);
                                                    const isImage = attachStr.startsWith('data:image/') || attachStr.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                                    const fileUrl = attachStr.startsWith('data:') ? attachStr : `/uploads/${attachStr}`;

                                                    if (isImage) {
                                                        return (
                                                            <div 
                                                                style={{ flex: '0.8', minWidth: '220px', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '1px solid var(--border)', backgroundColor: '#000', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                                                                onClick={() => window.open(fileUrl, '_blank')}
                                                                title="Click to view full size"
                                                            >
                                                                <img src={fileUrl} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95, transition: 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)' }} onMouseOver={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseOut={e => { e.currentTarget.style.opacity = 0.95; e.currentTarget.style.transform = 'scale(1)'; }} />
                                                                <div style={{ position: 'absolute', bottom: 12, right: 12, padding: '6px 12px', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', color: 'white', fontSize: '11px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                                                    <Maximize2 size={12} /> View Full
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                {/* TILE 2: DESCRIPTION */}
                                                <div style={{ flex: '1.2', minWidth: '280px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', backgroundColor: 'var(--bg-card)', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', minHeight: 0 }}>
                                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '14px', fontWeight: '700', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                        <div style={{ padding: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <FileText size={14} color="#3b82f6" />
                                                        </div>
                                                        Issue Description
                                                    </h4>
                                                    
                                                    <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-main)', lineHeight: '1.7', whiteSpace: 'pre-wrap', overflowY: 'auto', paddingRight: '8px', minHeight: 0 }}>
                                                        {selectedTicket.description}
                                                    </div>

                                                    {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (() => {
                                                        const attachStr = String(selectedTicket.attachment);
                                                        const isImage = attachStr.startsWith('data:image/') || attachStr.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                                        const fileUrl = attachStr.startsWith('data:') ? attachStr : `/uploads/${attachStr}`;

                                                        if (!isImage) {
                                                            return (
                                                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                                                                    <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Attached Documents</h5>
                                                                    <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', color: '#3b82f6', textDecoration: 'none', fontSize: '11px', fontWeight: '600', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; }} onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
                                                                        <Paperclip size={14} /> Download File
                                                                    </a>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>

                                                {/* TILE 3: ACTION PANEL */}
                                                <div style={{ flex: '1.4', minWidth: '320px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', backgroundColor: 'var(--bg-card)', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', minHeight: 0 }}>
                                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', letterSpacing: '-0.01em', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                        <div style={{ padding: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Zap size={14} color="#10b981" />
                                                        </div>
                                                        Take Action
                                                    </h4>
                                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }}>
                                                        {renderActionForms()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* --- ORIGINAL TICKET DETAILS VIEW --- */
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
                                            {/* METADATA GRID (Stacked Labels) */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '20px', columnGap: '16px', padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raised On</span>
                                                    <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>{selectedTicket.timestamp ? selectedTicket.timestamp.split(' ')[0] : 'N/A'}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requestor</span>
                                                    <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{getUserDetails(selectedTicket.raiser_email)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</span>
                                                    <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{selectedTicket.location}</span>
                                                </div>
                                                {selectedTicket.deadline && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline</span>
                                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>{selectedTicket.deadline.split(' ')[0] || selectedTicket.deadline.split(' ')[1] || selectedTicket.deadline}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: selectedTicket.deadline ? 'auto' : '1 / -1' }}>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Type</span>
                                                    <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{selectedTicket.issue_type}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Score</span>
                                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: selectedTicket.total_score >= 10 ? '#ef4444' : '#10b981' }}>{selectedTicket.total_score} pts</span>
                                                </div>
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

                                            {/* --- VERTICAL AUDIT TRAIL TIMELINE --- */}
                                            {logsLoading && <p style={{ color: '#71717a', fontSize: '12px', padding: '10px 0' }}>Loading ticket history...</p>}

                                            {/* ACTION FORMS INSIDE SCROLLABLE AREA */}
                                            {!isPanelExpanded && (
                                                <div style={{ 
                                                    borderTop: '1px solid var(--border)', 
                                                    paddingTop: '12px', 
                                                    marginTop: '8px'
                                                }}>
                                                    {renderActionForms()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : activePanelTab === 'timeline' ? (
                                <>
                                    {isPanelExpanded ? (
                                        <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flex: 1, minHeight: 0, paddingBottom: '12px' }}>
                                            {/* TILE 1: TIMELINE */}
                                            <div style={{ flex: '1', minWidth: '300px', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', minHeight: 0 }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                    <div style={{ padding: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <FileText size={14} color="#3b82f6" />
                                                    </div>
                                                    Ticket Timeline
                                                </h4>
                                                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', minHeight: 0 }}>
                                                    {!logsLoading && ticketLogs.length > 0 ? (
                                                        <TicketTimeline logs={ticketLogs} userRole={user?.role} />
                                                    ) : (
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>No timeline history available.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            {!logsLoading && ticketLogs.length > 0 ? (
                                                <TicketTimeline logs={ticketLogs} userRole={user?.role} />
                                            ) : (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No timeline history available.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                        
                    </div>
                </>
            )}
            </div>
        </Layout>
    );
};

export default SolverDashboard;