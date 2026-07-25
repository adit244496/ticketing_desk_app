// frontend/src/components/TicketTimeline.jsx
import React, { useState } from 'react';
import { PlusCircle, RefreshCw, MessageSquare, CheckCircle, AlertOctagon, ArrowRightLeft, ChevronDown, ChevronRight, Download, Star, ShieldAlert, Activity } from 'lucide-react';

const TicketTimeline = ({ logs = [], userRole = '' }) => {
    // --- COLLAPSE STATE ---
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState({});

    const toggleLog = (index) => {
        setExpandedLogs(prev => ({ ...prev, [index]: !prev[index] }));
    };

    // Helper to dynamically pick the right icon and color based on the EXACT actions in your CSV
    const getEventStyling = (action) => {
        const actionStr = String(action || '').toLowerCase();
        
        if (actionStr.includes('create')) 
            return { icon: <PlusCircle size={16} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }; // Green
            
        if (actionStr.includes('handover') || actionStr.includes('reassign')) 
            return { icon: <ArrowRightLeft size={16} />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }; // Purple
            
        if (actionStr.includes('status') || actionStr.includes('update')) 
            return { icon: <RefreshCw size={16} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }; // Yellow
            
        if (actionStr.includes('rate')) 
            return { icon: <Star size={16} />, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' }; // Yellow
            
        if (actionStr.includes('manager') || actionStr.includes('override')) 
            return { icon: <ShieldAlert size={16} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }; // Red
            
        if (actionStr.includes('escalation') || actionStr.includes('breach')) 
            return { icon: <Activity size={16} />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }; // Blue
        
        // Default Fallback
        return { icon: <MessageSquare size={16} />, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' }; 
    };

    // --- CSV EXPORT ENGINE ---
    const handleDownloadCSV = (e) => {
        e.stopPropagation(); 
        if (!logs || logs.length === 0) return;
        
        const headers = ['timestamp', 'ticket_id', 'user', 'action', 'details', 'remarks'];
        const csvRows = [headers.join(',')];
        
        for (const log of logs) {
            const values = headers.map(header => {
                const val = log[header] !== null && log[header] !== undefined ? log[header] : '';
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const tId = logs[0]?.ticket_id || 'Audit';
        link.setAttribute('download', `Ticket_${tId}_Logs.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Robust checker to ignore 'NaN', 'None', 'null' string literals from Pandas
    const isValidString = (str) => {
        if (!str) return false;
        const clean = String(str).trim().toLowerCase();
        return clean !== '' && clean !== 'nan' && clean !== 'null' && clean !== 'none';
    };

    if (!logs || logs.length === 0) {
        return (
            <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid rgba(161, 161, 170, 0.2)', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
                No audit logs available for this ticket yet.
            </div>
        );
    }

    return (
        <div>
            
            {/* COLLAPSIBLE HEADER & DOWNLOAD BUTTON */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    cursor: 'pointer', marginBottom: isExpanded ? '20px' : '0',
                    padding: '4px 0', userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Ticket Audit Trail
                    </h4>
                </div>
                
                {(userRole === 'Admin' || userRole === 'Super Admin') && (
                    <button 
                        onClick={handleDownloadCSV}
                        style={{ 
                            background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', 
                            color: '#4b5563', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', 
                            fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Download CSV"
                    >
                        <Download size={14} /> Export Logs
                    </button>
                )}
            </div>
            
            {/* TIMELINE CONTENT */}
            {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative', marginTop: '15px' }}>
                    <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '20px', width: '2px', backgroundColor: '#e5e7eb' }}></div>
                    
                    {logs.map((log, index) => {
                        const style = getEventStyling(log.action);
                        const isLast = index === logs.length - 1;
                        
                        const hasDetails = isValidString(log.details);
                        const hasRemarks = isValidString(log.remarks);
                        const isExpandedLog = expandedLogs[index];
                        
                        return (
                            <div key={index} style={{ display: 'flex', gap: '10px', position: 'relative', paddingBottom: isLast ? '0' : '10px' }}>
                                
                                {/* Icon Node */}
                                <div style={{ 
                                    width: '28px', height: '28px', borderRadius: '50%', 
                                    backgroundColor: style.bg, color: style.color, 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    zIndex: 1, border: `1px solid ${style.color}`,
                                    flexShrink: 0
                                }}>
                                    {style.icon}
                                </div>
                                
                                {/* Log Content Card */}
                                <div 
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: '#ffffff', 
                                        border: '1px solid #e5e7eb', 
                                        borderRadius: '8px', 
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div 
                                        onClick={() => toggleLog(index)}
                                        style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            padding: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#111827' }}>
                                            {log.action || 'System Action'}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                                {log.timestamp ? log.timestamp : ''}
                                            </span>
                                            {isExpandedLog ? <ChevronDown size={14} color="#9ca3af" style={{ transform: 'rotate(180deg)' }} /> : <ChevronDown size={14} color="#9ca3af" />}
                                        </div>
                                    </div>
                                    
                                    {/* Expanded Details */}
                                    {isExpandedLog && (
                                        <div style={{ padding: '0 12px 12px 12px' }}>
                                            <div style={{ borderTop: '1px solid #e5e7eb', margin: '0 -12px 12px -12px' }}></div>
                                            
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', marginBottom: '12px', color: '#374151' }}>
                                                <div>
                                                    <span style={{ fontWeight: 'bold' }}>Action By:</span> <span style={{ color: '#6b7280' }}>{log.user_id || log.user || 'System'}</span>
                                                </div>
                                                {hasDetails && log.details.includes('Assigned to') && (
                                                    <div>
                                                        <span style={{ fontWeight: 'bold' }}>Target:</span> <span style={{ color: '#3b82f6' }}>{log.details.split('Assigned to')[1].trim()}</span>
                                                    </div>
                                                )}
                                                {log.action === 'Chat' && (
                                                    <div>
                                                        <span style={{ fontWeight: 'bold' }}>Action:</span> <span style={{ color: '#3b82f6' }}>Message Sent</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#374151', lineHeight: '1.5', marginBottom: '12px' }}>
                                                {hasDetails && (
                                                    <div style={{ marginBottom: hasRemarks ? '6px' : '0' }}>
                                                        <span style={{ fontWeight: 'bold' }}>System Info:</span> {log.details}
                                                    </div>
                                                )}
                                                {hasRemarks && (
                                                    <div>
                                                        <span style={{ fontWeight: 'bold' }}>Remarks / Reason:</span> {log.remarks}
                                                    </div>
                                                )}
                                                {!hasDetails && !hasRemarks && (!log.attachment || String(log.attachment).toLowerCase() === 'nan') && (
                                                    <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>System recorded this event automatically.</div>
                                                )}
                                            </div>
                                            
                                            {log.attachment && String(log.attachment).toLowerCase() !== 'nan' && (
                                                <div>
                                                    <div 
                                                        style={{ 
                                                            width: '80px', height: '80px', borderRadius: '6px', 
                                                            overflow: 'hidden', cursor: 'pointer', border: '1px solid #e5e7eb'
                                                        }}
                                                        onClick={() => window.open(`/uploads/${log.attachment}`, '_blank')}
                                                    >
                                                        <img src={`/uploads/${log.attachment}`} alt="Log Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TicketTimeline;