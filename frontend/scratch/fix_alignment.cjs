const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the modal container logic
const oldModalContainer = `<div className={!isPanelExpanded ? "slide-in-right-panel" : ""} style={{
                        position: 'fixed', 
                        right: 0, 
                        top: '52px', 
                        bottom: 0, 
                        width: isPanelExpanded ? '65vw' : '450px',
                        margin: 0, 
                        borderLeft: '1px solid var(--border)',
                        overflowY: 'auto', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        padding: '24px',
                        zIndex: 1000, 
                        boxShadow: isPanelExpanded ? '-20px 0 50px rgba(0,0,0,0.3)' : '-10px 0 30px rgba(0,0,0,0.05)',
                        backgroundColor: 'var(--bg-card)', 
                        backdropFilter: 'var(--glass-blur)',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s ease'
                    }}>`;

const newModalContainer = `<div className={!isPanelExpanded ? "slide-in-right-panel" : ""} style={{
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
                        zIndex: 1000, backgroundColor: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>`;

content = content.replace(oldModalContainer, newModalContainer);


// Replace the Resolution Details form styles
const oldResolutionFormStart = `<h4 style={{ margin: '0 0 10px 0', borderTop: '1px solid #27272a', paddingTop: '15px' }}>Resolution Details</h4>`;
const oldResolutionFormRegex = /<h4 style=\{\{ margin: '0 0 10px 0', borderTop: '1px solid #27272a', paddingTop: '15px' \}\}>Resolution Details<\/h4>[\s\S]*?<button type="submit" className="btn" style=\{\{ fontSize: '10px', padding: '6px 10px' \}\}>Save Update<\/button>[\s\S]*?<\/form>/;

const newResolutionForm = `<h4 style={{ margin: '0 0 10px 0', borderTop: '1px solid var(--border)', paddingTop: '15px', color: 'var(--text-main)' }}>Resolution Details</h4>
                                                        <form onSubmit={(e) => handleStatusUpdate(e, selectedTicket.ticket_id, selectedTicket.status, selectedTicket.solver_comments)} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '15px', alignItems: 'end', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '500' }}>Update Status To</label>
                                                                <select
                                                                    className="form-control"
                                                                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '11px', padding: '8px', width: '100%' }}
                                                                    value={updateForms[selectedTicket.ticket_id]?.status !== undefined ? updateForms[selectedTicket.ticket_id].status : selectedTicket.status}
                                                                    onChange={(e) => handleUpdateFormChange(selectedTicket.ticket_id, 'status', e.target.value)}
                                                                >
                                                                    {(selectedTicket.status === 'Resolved' ? ['Resolved'] : ["In Progress", "Resolved", "Decline"]).map(s => <option key={s} value={s}>{s}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '500' }}>Resolution Notes / Remarks</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    placeholder="Enter notes for the requestor..."
                                                                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '11px', padding: '8px', width: '100%' }}
                                                                    value={updateForms[selectedTicket.ticket_id]?.remarks !== undefined ? updateForms[selectedTicket.ticket_id].remarks : (selectedTicket.solver_comments && selectedTicket.solver_comments !== 'nan' ? selectedTicket.solver_comments : '')}
                                                                    onChange={(e) => handleUpdateFormChange(selectedTicket.ticket_id, 'remarks', e.target.value)}
                                                                />
                                                            </div>
                                                            <button type="submit" className="btn" style={{ fontSize: '11px', padding: '8px 12px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px' }}>Save Update</button>
                                                        </form>`;

content = content.replace(oldResolutionFormRegex, newResolutionForm);

fs.writeFileSync(file, content);
console.log('Fixed container alignment and resolution form styles.');
