import os
import re

file_path = r'c:\Users\abhirup.dutta\Downloads\Ambuja Desk_Puroshottam\Ambuja Desk_Puroshottam\ambuja_desk_2\frontend\src\pages\DeptHeadDashboard.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add API imports
content = content.replace("fetchMasterRules, updateMasterRule", "fetchMasterRules, updateMasterRule, fetchTicketLogs")

# 2. Add Lucide imports
content = content.replace("Zap, Cog } from 'lucide-react';", "Zap, Cog, X, Maximize2, Minimize2, FileText, Clock, MessageSquare, AlertTriangle, CheckCircle2, Paperclip } from 'lucide-react';")

# 3. Add state variables
state_vars = """
    // --- TICKET PANEL STATE ---
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState('details');
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
"""
if "const [selectedTicket" not in content:
    content = content.replace("const [rulesList, setRulesList]", state_vars.lstrip() + "\n    const [rulesList, setRulesList]")

# 4. Add handleTicketClick and format helpers
handlers = """
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
"""
if "handleTicketClick" not in content:
    content = content.replace("const getDisplayName =", handlers.lstrip() + "\n    const getDisplayName =")

# 5. Modify the table row
old_tr = "<tr key={t.ticket_id} style={{ borderBottom: '1px solid #27272a' }}>"
new_tr = "<tr key={t.ticket_id} onClick={() => handleTicketClick(t)} style={{ borderBottom: '1px solid #27272a', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>"
content = content.replace(old_tr, new_tr)

# 6. Add the panel JSX at the bottom before closing main div
panel_jsx = """
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
                                    <span style={{ backgroundColor: selectedTicket.status === 'Closed' ? '#27272a' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedTicket.status === 'Closed' ? '#a1a1aa' : selectedTicket.status === 'Resolved' ? '#10b981' : '#60a5fa', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>{selectedTicket.status}</span>
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
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#71717a' }}>Date Raised</span>
                                            <span style={{ fontSize: '11px', color: '#ededed', fontWeight: '500' }}>📅 {selectedTicket.timestamp}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#71717a' }}>Requestor</span>
                                            <span style={{ fontSize: '11px', color: '#ededed', fontWeight: '500' }}>👤 {getDisplayName(selectedTicket.raiser_email)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#71717a' }}>Assigned To</span>
                                            <span style={{ fontSize: '11px', color: '#ededed', fontWeight: '500' }}>🔧 {getDisplayName(selectedTicket.assigned_to)}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#71717a' }}>Location / Outlet</span>
                                            <span style={{ fontSize: '11px', color: '#ededed', fontWeight: '500' }}>📍 {selectedTicket.location}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#71717a' }}>SLA Score</span>
                                            <span style={{ fontSize: '11px', fontWeight: '500', color: selectedTicket.total_score >= 10 ? '#ef4444' : '#10b981' }}>⚠️ {selectedTicket.total_score} points</span>
                                        </div>
                                        {selectedTicket.deadline && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontSize: '10px', color: '#71717a' }}>Deadline</span>
                                                <span style={{ fontSize: '11px', fontWeight: '500', color: '#10b981' }}>⏰ {selectedTicket.deadline}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="detail-box" style={{ fontSize: '11px', marginBottom: '16px', padding: '12px', borderRadius: '6px', lineHeight: '1.6', backgroundColor: '#18181b', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ color: '#71717a', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Description</strong>
                                            {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (
                                                <button onClick={() => { const attachStr = String(selectedTicket.attachment); window.open(attachStr.startsWith('data:') ? attachStr : `http://localhost:5000/uploads/${attachStr}`, '_blank'); }} style={{ background: '#3b82f6', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'bold' }}><Paperclip size={10} /> View Image</button>
                                            )}
                                        </div>
                                        <span style={{ color: '#ededed', whiteSpace: 'pre-wrap' }}>{selectedTicket.description}</span>
                                    </div>
                                </div>
                            ) : activePanelTab === 'timeline' ? (
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    <div className="timeline-container">
                                        {logsLoading ? <p style={{ color: '#71717a', fontSize: '11px' }}>Loading timeline...</p> : (
                                            ticketLogs.map((log, i) => (
                                                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '6px', flexShrink: 0 }}></div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{log.action}</div>
                                                        <div style={{ fontSize: '11px', color: '#a1a1aa', margin: '4px 0' }}>{log.details || log.remarks}</div>
                                                        <div style={{ fontSize: '9px', color: '#71717a' }}>{log.timestamp} • by {log.user || log.user_id}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#18181b' }}>
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
"""

if "{/* INLINE TICKET PANEL (Mirrors Admin Dashboard) */}" not in content:
    content = content.replace("            {/* ENTERPRISE DIALOG MODAL", panel_jsx.lstrip() + "\n            {/* ENTERPRISE DIALOG MODAL")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("File patched successfully!")
