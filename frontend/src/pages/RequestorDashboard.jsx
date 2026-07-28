// frontend/src/pages/RequestorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api, { fetchTickets, createTicket, updateTicketStatus, fetchLocations, fetchMasterRules, fetchUsers, fetchTicketLogs } from '../api';
import Layout from '../components/Layout';
import TicketTimeline from '../components/TicketTimeline';
import { Clock, Paperclip, AlertCircle, CheckCircle2, Filter, Star, MessageSquare, Ticket, PlusCircle, ClipboardList, RefreshCw, FileText, Maximize2, Minimize2, X } from 'lucide-react';

import TicketFilterBar from '../components/TicketFilterBar';

const RequestorDashboard = ({ user, setUser }) => {
    const [tickets, setTickets] = useState([]);
    const [locations, setLocations] = useState([]);
    const [masterRules, setMasterRules] = useState([]);
    const [usersList, setUsersList] = useState([]);

    const [activeTab, setActiveTab] = useState('history');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Reopen Modal State
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [reopenTicketId, setReopenTicketId] = useState(null);
    const [reopenReason, setReopenReason] = useState('');

    // Close & Rate Modal State
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closeTicketId, setCloseTicketId] = useState(null);
    const [closeRating, setCloseRating] = useState(0);
    const [closeRemark, setCloseRemark] = useState('');
    const [hoverRating, setHoverRating] = useState(0);

    // Modal & Chat State
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState('details');
    const [chatInput, setChatInput] = useState('');
    const [chatFile, setChatFile] = useState(null);

    // Raise Ticket State
    const [dept, setDept] = useState('');
    const [issue, setIssue] = useState('');
    const [location, setLocation] = useState(user.outlet || '');
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [fileName, setFileName] = useState('');
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [expectedDeadline, setExpectedDeadline] = useState(null);

    // Filter & Search State
    const [filteredTickets, setFilteredTickets] = useState([]);

    const routerLocation = useLocation();

    // Reset expanded panel and selected ticket when navigating
    useEffect(() => {
        setSelectedTicket(null);
        setIsPanelExpanded(false);
    }, [routerLocation.key]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [ticketData, locationData, rulesData, usersData] = await Promise.all([
                fetchTickets(),
                fetchLocations(),
                fetchMasterRules(),
                fetchUsers()
            ]);

            let safeTickets = ticketData?.data || ticketData;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);

            setTickets(Array.isArray(safeTickets) ? safeTickets.filter(t => t.raiser_email === user.email) : []);
            setLocations(locationData);
            setMasterRules(rulesData);
            setUsersList(usersData);

            if (rulesData.length > 0) {
                const uniqueDepts = [...new Set(rulesData.map(r => r.department))];
                if (uniqueDepts.length > 0) setDept(uniqueDepts[0]);
            }
        } catch (err) {
            setError("Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    };
    const getAssigneeDetails = (empId) => {
        if (!empId || String(empId).toLowerCase() === 'nan' || String(empId).toLowerCase() === 'unassigned') {
            return <span style={{ color: '#71717a' }}>Unassigned</span>;
        }
        const cleanId = String(empId).replace(/\.0$/, '');
        const u = usersList.find(u => String(u.employee_id) === cleanId || String(u.email) === cleanId);
        if (u) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{u.name}</span>
                    <span style={{ fontSize: '9px', color: '#a1a1aa' }}>{u.phone_no || 'N/A'}</span>
                </div>
            );
        }
        return cleanId;
    };

    useEffect(() => {
        if (dept && issue && masterRules.length > 0) {
            const rule = masterRules.find(r => r.department === dept && r.issue_type === issue);
            setExpectedDeadline(rule && rule.deadline_hours ? rule.deadline_hours : 24);
        } else {
            setExpectedDeadline(null);
        }
    }, [dept, issue, masterRules]);

    const handleTicketClick = async (ticket) => {
        setSelectedTicket(ticket);
        setIsPanelExpanded(false);
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

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert("Only .jpg, .jpeg, or .png files can be uploaded.");
            e.target.value = '';
            setAttachment(null);
            setFileName('');
            setAttachmentPreview(null);
            return;
        }

        const MAX_SIZE_MB = 0.02;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
        setFileName(file.name);

        setIsCompressing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                setAttachmentPreview(event.target.result);
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    const max_dim = 960;

                    if (width > max_dim || height > max_dim) {
                        if (width > height) {
                            height *= max_dim / width; width = max_dim;
                        } else {
                            width *= max_dim / height; height = max_dim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let quality = 0.9;
                    const attemptCompression = () => {
                        canvas.toBlob((blob) => {
                            if (blob.size > MAX_SIZE_BYTES && quality > 0.1) {
                                quality -= 0.15;
                                attemptCompression();
                            } else {
                                const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                                setAttachment(compressedFile);
                                setIsCompressing(false);
                            }
                        }, 'image/jpeg', quality);
                    };
                    attemptCompression();
                };
            };
        } catch (err) {
            alert("Failed to process image.");
            e.target.value = '';
            setAttachment(null);
            setFileName('');
            setAttachmentPreview(null);
            setIsCompressing(false);
        }
    };

    const handleRaiseTicket = async (e) => {
        e.preventDefault();
        if (isCompressing) return alert("Please wait for the image to finish compressing.");

        try {
            const formData = new FormData();
            formData.append('raiser_email', user.email);
            formData.append('user_grade', user.grade);
            formData.append('critical_rating', user.critical_user_rating || 0);
            formData.append('dept', dept);
            formData.append('issue', issue);
            formData.append('location', location);
            formData.append('description', description);

            if (expectedDeadline) formData.append('deadline_hours', expectedDeadline);
            if (attachment) formData.append('attachment', attachment);

            const response = await createTicket(formData);
            alert(`Ticket Raised Successfully! Assigned to: ${response.assigned_to_display}`);

            setIssue(''); setDescription(''); setAttachment(null); setFileName(''); setAttachmentPreview(null);
            loadDashboardData();
            setActiveTab('history');
        } catch (err) {
            alert(err.response?.data?.error || "Failed to raise ticket");
        }
    };

    const handleReopenSubmit = async () => {
        if (!reopenReason.trim()) return alert("Please provide a reason for reopening.");
        try {
            await updateTicketStatus({ ticket_id: reopenTicketId, status: 'Reopened', remarks: reopenReason });
            alert("Ticket successfully reopened.");
            setIsReopenModalOpen(false);
            setReopenReason('');
            setSelectedTicket(null); // Close the detail modal
            loadDashboardData();
        } catch (err) {
            alert("Failed to reopen ticket.");
        }
    };

    const handleCloseSubmit = async () => {
        if (closeRating === 0) return alert("Please select a star rating for the solver before closing.");
        try {
            await updateTicketStatus({
                ticket_id: closeTicketId,
                status: 'Closed',
                rating: closeRating,
                remarks: closeRemark
            });
            alert("Ticket closed and solver rated successfully!");
            setIsCloseModalOpen(false);
            setCloseRating(0);
            setCloseRemark('');
            setSelectedTicket(null);
            loadDashboardData();
        } catch (err) {
            alert("Failed to close ticket.");
        }
    };

    const getSolverDetails = (solverId) => {
        if (!solverId || String(solverId).toLowerCase() === 'nan' || solverId === 'Unassigned') return 'Pending Routing';
        const solver = usersList.find(u => String(u.employee_id) === String(solverId) || String(u.email) === String(solverId));
        if (solver) return `${solver.name} (${solver.phone || 'N/A'})`;
        return solverId;
    };

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

    // filteredTickets is now managed by TicketFilterBar

    const kpi = {
        total: filteredTickets.length,
        open: filteredTickets.filter(t => ['Open', 'Reopened'].includes(t.status)).length,
        inProgress: filteredTickets.filter(t => t.status === 'In Progress').length,
        resolved: filteredTickets.filter(t => t.status === 'Resolved').length,
        declined: filteredTickets.filter(t => t.status === 'Decline').length,
        closed: filteredTickets.filter(t => t.status === 'Closed').length,
        late: filteredTickets.filter(t => isLate(t)).length
    };

    const ratedTickets = tickets.filter(t => t.solver_rating && !isNaN(t.solver_rating));
    const avgRating = ratedTickets.length > 0
        ? (ratedTickets.reduce((sum, t) => sum + Number(t.solver_rating), 0) / ratedTickets.length).toFixed(1)
        : 'New';

    const uniqueDepts = [...new Set(masterRules.map(r => r.department))];
    const deptIssues = [...new Set(masterRules.filter(r => r.department === dept).map(r => r.issue_type))];
    const uniqueStatuses = [...new Set(tickets.map(t => t.status).filter(Boolean))];
    const uniqueFilterDepts = [...new Set(tickets.map(t => t.department || t.dept_assigned).filter(Boolean))];

    const sidebarTabs = [
        { id: 'history', label: <><ClipboardList size={12} /> My Ticket History</> },
        { id: 'raise', label: <><PlusCircle size={12} /> Raise New Ticket</> }
    ];

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedTicket(null); setIsPanelExpanded(false); }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}
                <div style={{ paddingRight: selectedTicket ? (isPanelExpanded ? '0' : '434px') : '0', transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flex: 1, display: 'flex', flexDirection: 'column' }}>

                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}><Ticket size={22} color="#3b82f6" /> Requestor Portal</h2>
                        <span className="rating-badge" style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Star size={11} fill="#f59e0b" color="#f59e0b" /> {avgRating} Rating
                        </span>
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

                    {/* RAISE TICKET TAB */}
                    {activeTab === 'raise' && !loading && (
                        <div className="card" style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Raise a New Support Ticket</h3>
                            <form onSubmit={handleRaiseTicket}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '13px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '10px' }}>Department</label>
                                        <select className="form-control" style={{ padding: '6px 10px', fontSize: '10px', minHeight: '32px' }} value={dept} onChange={(e) => { setDept(e.target.value); setIssue(''); }}>
                                            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '10px' }}>Issue Type</label>
                                        <select className="form-control" style={{ padding: '6px 10px', fontSize: '10px', minHeight: '32px' }} required value={issue} onChange={(e) => setIssue(e.target.value)}>
                                            <option value="" disabled>Select Issue...</option>
                                            {deptIssues.map(i => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '10px' }}>Location (Outlet)</label>
                                        <select className="form-control" style={{ padding: '6px 10px', fontSize: '10px', minHeight: '32px' }} required value={location} onChange={(e) => setLocation(e.target.value)}>
                                            <option value="" disabled>Select Location...</option>
                                            {locations.map(l => <option key={l.outlet} value={l.outlet}>{l.brand} ({l.outlet})</option>)}
                                        </select>
                                    </div>
                                </div>

                                {expectedDeadline && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '8px 11px', borderRadius: '5px', marginBottom: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <Clock size={13} />
                                        <span style={{ fontSize: '10px', fontWeight: '500' }}>Expected Resolution Time: <strong>{expectedDeadline} Hours</strong></span>
                                    </div>
                                )}

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '10px' }}>Description of Issue</label>
                                    <textarea className="form-control" required rows="4" style={{ fontSize: '10px', padding: '10px' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Please provide detailed information..."></textarea>
                                </div>

                                <div className="form-group" style={{ border: '1px dashed var(--border)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px', color: '#a1a1aa', fontSize: '10px' }}><Paperclip size={11} /> Supporting Attachment (Max 20KB, JPG/PNG only)</label>
                                    <input type="file" id="file-upload" style={{ display: 'none' }} accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={handleFileChange} />
                                    {attachmentPreview && !isCompressing ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                            <div style={{ position: 'relative', width: '60px', height: '60px', border: '1px solid #10b981', borderRadius: '6px', overflow: 'hidden', padding: '2px', backgroundColor: '#f0fdf4' }}>
                                                <img src={attachmentPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => { setAttachment(null); setFileName(''); setAttachmentPreview(null); document.getElementById('file-upload').value = ''; }}
                                                    style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white', border: 'none', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderBottomLeftRadius: '4px' }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                            <span style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                                <CheckCircle2 size={16} /> {fileName}
                                            </span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <label htmlFor="file-upload" className="btn btn-filter" style={{ fontSize: '10px', padding: '6px 13px', cursor: 'pointer' }}>Browse Images</label>
                                            {isCompressing ? <span style={{ fontSize: '10px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} /> Optimizing image to 20KB...</span> : <span style={{ fontSize: '10px', color: '#71717a' }}>No file selected.</span>}
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="btn btn-full" disabled={isCompressing} style={{ marginTop: '8px', fontSize: '10px', padding: '10px' }}>Submit Ticket</button>
                            </form>
                        </div>
                    )}

                    {/* UPGRADED TICKET HISTORY TAB (TABLE LAYOUT) */}
                    {activeTab === 'history' && !loading && (
                        <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                            <div style={{ flex: 1, minWidth: 0, transition: 'all 0.3s', display: 'flex', flexDirection: 'column' }}>

                                <div className="card" style={{ padding: '16px', zIndex: 10, marginBottom: '16px' }}>
                                    <TicketFilterBar tickets={tickets} onFilter={setFilteredTickets} usersList={usersList} />
                                </div>
                                {/* NEW ENTERPRISE TABLE LAYOUT */}
                                <div className="card" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                            <thead style={{ backgroundColor: '#18181b', borderBottom: '2px solid #27272a', position: 'sticky', top: 0 }}>
                                                <tr>
                                                    <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Ticket ID</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Image</th>
                                                    <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Department</th>
                                                    <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Issue Type</th>
                                                    <th style={{ padding: '10px', textAlign: 'left', color: '#a1a1aa', border: '1px solid #27272a' }}>Assigned To</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Date Raised</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Deadline</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTickets.length === 0 ? (
                                                    <tr><td colSpan="8" style={{ padding: '16px', textAlign: 'center', color: '#71717a' }}>No tickets found matching your criteria.</td></tr>
                                                ) : (
                                                    filteredTickets.slice().reverse().map(ticket => (
                                                        <tr
                                                            key={ticket.ticket_id}
                                                            onClick={() => handleTicketClick(ticket)}
                                                            style={{
                                                                borderBottom: '1px solid #27272a',
                                                                cursor: 'pointer',
                                                                transition: 'background-color 0.2s',
                                                                borderLeft: ticket.total_score >= 10 ? '2px solid #ef4444' : '2px solid transparent'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'}
                                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
                                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#fff', border: '1px solid #27272a' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    #{ticket.ticket_id}
                                                                    {ticket.SLA_Breach && <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>SLA BREACH</span>}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>
                                                                {ticket.attachment && String(ticket.attachment).toLowerCase() !== 'nan' ? (
                                                                    <img src={String(ticket.attachment).startsWith('data:') ? String(ticket.attachment) : `/uploads/${ticket.attachment}`} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3f3f46' }} alt="Attachment" />
                                                                ) : <span style={{ color: '#52525b' }}>-</span>}
                                                            </td>
                                                            <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{ticket.dept_assigned}</td>
                                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{ticket.issue_type}</td>
                                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{getAssigneeDetails(ticket.assigned_to)}</td>
                                                            <td style={{ padding: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{ticket.timestamp}</td>
                                                            <td style={{ padding: '10px', textAlign: 'center', color: '#10b981', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{ticket.deadline || 'N/A'}</td>
                                                            <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>
                                                                <span style={{
                                                                    backgroundColor: ticket.status === 'Open' ? 'rgba(245, 158, 11, 0.1)' : ticket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : ticket.closure_type === 'Declined' ? 'rgba(239, 68, 68, 0.1)' : ticket.status === 'Closed' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                                    color: ticket.status === 'Open' ? '#f59e0b' : ticket.status === 'Resolved' ? '#10b981' : ticket.closure_type === 'Declined' ? '#ef4444' : ticket.status === 'Closed' ? '#14b8a6' : '#3b82f6',
                                                                    padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold'
                                                                }}>
                                                                    {ticket.closure_type === 'Declined' ? 'Declined' : ticket.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                                borderBottom: isPanelExpanded ? 'none' : '1px solid #27272a',
                                transition: 'padding 0.4s ease'
                            }}>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        #{selectedTicket.ticket_id}
                                        <span style={{
                                            backgroundColor: selectedTicket.closure_type === 'Declined' ? 'rgba(239, 68, 68, 0.1)' : selectedTicket.status === 'Closed' ? '#27272a' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                            color: selectedTicket.closure_type === 'Declined' ? '#ef4444' : selectedTicket.status === 'Closed' ? '#a1a1aa' : selectedTicket.status === 'Resolved' ? '#10b981' : '#60a5fa',
                                            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold'
                                        }}>{selectedTicket.closure_type === 'Declined' ? 'Declined' : selectedTicket.status}</span>
                                    </h3>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button onClick={() => setIsPanelExpanded(!isPanelExpanded)} style={{ background: 'none', border: 'none', color: isPanelExpanded ? '#4b5563' : '#a1a1aa', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                        {isPanelExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                    </button>
                                    <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '16px', cursor: 'pointer' }}>✕</button>
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
                                <button
                                    onClick={() => setActivePanelTab('details')}
                                    style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'details' ? '#3b82f6' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <FileText size={16} /> Details
                                </button>
                                <button
                                    onClick={() => setActivePanelTab('timeline')}
                                    style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'timeline' ? '#3b82f6' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Clock size={16} /> Timeline
                                </button>
                                <button
                                    onClick={() => setActivePanelTab('chat')}
                                    style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'chat' ? '#3b82f6' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <MessageSquare size={16} /> Chat
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: isPanelExpanded ? '0 30px 30px 30px' : '0', display: 'flex', flexDirection: 'column' }}>
                                {activePanelTab === 'chat' ? (
                                    /* --- NEW CONVERSATION INTERFACE --- */
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                        <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {logsLoading ? (
                                                <p style={{ color: '#71717a', fontSize: '10px', textAlign: 'center' }}>Loading conversation...</p>
                                            ) : ticketLogs.length === 0 ? (
                                                <p style={{ color: '#71717a', fontSize: '10px', textAlign: 'center' }}>No history available yet.</p>
                                            ) : (
                                                ticketLogs.map((log, i) => {
                                                    // Identify if the log is a standard text chat message
                                                    const isChat = log.action === 'Chat' || log.action === 'Message';
                                                    // Identify if the current user sent it
                                                    const isMe = log.user === user.email || log.user === user.name || log.user_id === user.email || log.user_id === user.employee_id;

                                                    if (!isChat) return null;

                                                    // Render Chat Messages as WhatsApp-style Bubbles
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
                                                    placeholder="Type a message to the solver..."
                                                    style={{ margin: 0, flex: 1, fontSize: '10px', padding: '8px 12px' }}
                                                />
                                                <button type="submit" className="btn" style={{ backgroundColor: '#10b981', fontSize: '10px', padding: '8px 16px' }}>Send</button>
                                            </form>
                                        )}
                                    </div>
                                ) : activePanelTab === 'details' ? (
                                    /* --- COMPACT TICKET DETAILS VIEW --- */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
                                        {/* METADATA GRID (Stacked Labels) */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '20px', columnGap: '16px', padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raised On</span>
                                                <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>{selectedTicket.timestamp ? selectedTicket.timestamp.split(' ')[0] : 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</span>
                                                <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{getSolverDetails(selectedTicket.assigned_to)}</span>
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

                                        {/* ACTION FORMS INSIDE SCROLLABLE AREA */}
                                        {!isPanelExpanded && (selectedTicket.status === 'Closed' || selectedTicket.status === 'Resolved') && (
                                            <div style={{
                                                marginTop: '8px',
                                                paddingTop: '12px',
                                                borderTop: '1px solid var(--border)',
                                                backgroundColor: 'var(--bg-card)'
                                            }}>
                                                {selectedTicket.status === 'Closed' && (
                                                    <div>
                                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: 'var(--text-muted)' }}>Your Feedback</h4>
                                                        {selectedTicket.closure_type === 'Declined' ? (
                                                            <div style={{ color: '#ef4444', fontSize: '11px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                                ❌ Ticket was declined. (Reason: {selectedTicket.solver_comments})
                                                            </div>
                                                        ) : selectedTicket.solver_rating ? (
                                                            <div style={{ color: '#10b981', fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Star size={12} fill="#10b981" color="#10b981" /> You rated the solver {selectedTicket.solver_rating}/5.
                                                            </div>
                                                        ) : (
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', backgroundColor: 'var(--bg-main)', padding: '8px', borderRadius: '4px', border: '1px dashed var(--border)' }}>
                                                                Ticket closed without rating.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {selectedTicket.status === 'Resolved' && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => { setCloseTicketId(selectedTicket.ticket_id); setIsCloseModalOpen(true); }} className="btn btn-success" style={{ padding: '8px 12px', fontSize: '11px', flex: 1 }}>
                                                            <CheckCircle2 size={14} /> Accept & Close
                                                        </button>
                                                        <button onClick={() => { setReopenTicketId(selectedTicket.ticket_id); setIsReopenModalOpen(true); }} className="btn btn-danger" style={{ padding: '8px 12px', fontSize: '11px', flex: 1 }}>
                                                            <RefreshCw size={14} /> Reopen Issue
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : activePanelTab === 'timeline' ? (
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                        {!logsLoading && ticketLogs.length > 0 ? (
                                            <TicketTimeline logs={ticketLogs} userRole={user?.role} />
                                        ) : (
                                            <p style={{ color: '#71717a', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No timeline history available.</p>
                                        )}
                                    </div>
                                ) : null}
                            </div>


                        </div>
                    </>
                )}


                {/* REOPEN DIALOG MODAL */}
                {isReopenModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ backgroundColor: '#18181b', padding: '20px', borderRadius: '6px', border: '1px solid #3f3f46', width: '360px', maxWidth: '90%', boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px' }}>Reopen Ticket #{reopenTicketId}</h3>
                            <div className="form-group">
                                <label style={{ fontSize: '10px' }}>Reason for Reopening</label>
                                <textarea className="form-control" rows="4" style={{ fontSize: '10px', padding: '8px' }} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Please provide details..." required />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                <button type="button" className="btn" onClick={() => { setIsReopenModalOpen(false); setReopenReason(''); }} style={{ fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                <button type="button" className="btn" onClick={handleReopenSubmit} style={{ fontSize: '10px', padding: '6px 10px' }}>Confirm Reopen</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* RATE & CLOSE DIALOG MODAL */}
                {isCloseModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ backgroundColor: '#18181b', padding: '20px', borderRadius: '6px', border: '1px solid #3f3f46', width: '360px', maxWidth: '90%', boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px' }}>Close Ticket #{closeTicketId}</h3>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                        key={star} size={26} style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                        fill={star <= (hoverRating || closeRating) ? "#f59e0b" : "transparent"} color={star <= (hoverRating || closeRating) ? "#f59e0b" : "#3f3f46"}
                                        onClick={() => setCloseRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                                    />
                                ))}
                            </div>
                            <div className="form-group">
                                <label style={{ fontSize: '10px' }}>Additional Feedback (Optional)</label>
                                <textarea className="form-control" rows="3" style={{ fontSize: '10px', padding: '8px' }} value={closeRemark} onChange={(e) => setCloseRemark(e.target.value)} placeholder="Leave a remark for the solver..." />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                <button type="button" className="btn" onClick={() => { setIsCloseModalOpen(false); setCloseRating(0); setCloseRemark(''); }} style={{ fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                <button type="button" className="btn" onClick={handleCloseSubmit} style={{ fontSize: '10px', padding: '6px 10px' }}>Submit & Close</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
};

export default RequestorDashboard;