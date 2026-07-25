const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Structural change: Move renderActionForms() into the right column, make right column 380px wide.
// Also add minHeight: 0 and overflowY: 'auto' so it fits nicely.
const searchExpandedView = `<div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flex: 1 }}>
                                                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', minHeight: '200px' }}>
                                                    <strong style={{ display: 'block', marginBottom: '16px', color: '#111827', fontSize: '14px' }}>Issue Description:</strong>
                                                    <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                        {selectedTicket.description}
                                                    </div>
                                                </div>

                                                <div style={{ width: '250px' }}>`;

const replaceExpandedView = `<div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
                                                {/* Left side: Description */}
                                                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>
                                                    <strong style={{ display: 'block', marginBottom: '16px', color: 'var(--text-main)', fontSize: '14px' }}>Issue Description:</strong>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                        {selectedTicket.description}
                                                    </div>
                                                </div>

                                                {/* Right side: Attachment and Action Forms */}
                                                <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px' }}>`;

content = content.replace(searchExpandedView, replaceExpandedView);

// 2. Remove the old renderActionForms() call and insert it in the new right column
const searchFormsEnd = `                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '12px', color: '#9ca3af', padding: '12px', border: '1px dashed #e5e7eb', borderRadius: '8px', textAlign: 'center' }}>No attachment</div>
                                                    )}
                                                </div>
                                            </div>

                                            {renderActionForms()}
                                            
                                        </div>`;

const replaceFormsEnd = `                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center' }}>No attachment</div>
                                                    )}
                                                    
                                                    {/* Move Action Forms Here */}
                                                    <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
                                                        {renderActionForms()}
                                                    </div>

                                                </div>
                                            </div>
                                            
                                        </div>`;

content = content.replace(searchFormsEnd, replaceFormsEnd);


// 3. Make renderActionForms flex layout a bit more robust for tight spaces
// We change gridTemplateColumns: '1fr 2fr auto' to be display: 'flex', flexDirection: 'column' to ensure it NEVER overflows regardless of column width
const searchGridForm = `<form onSubmit={(e) => handleStatusUpdate(e, selectedTicket.ticket_id, selectedTicket.status, selectedTicket.solver_comments)} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '15px', alignItems: 'end', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>`;
const replaceGridForm = `<form onSubmit={(e) => handleStatusUpdate(e, selectedTicket.ticket_id, selectedTicket.status, selectedTicket.solver_comments)} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>`;

content = content.replace(searchGridForm, replaceGridForm);

fs.writeFileSync(file, content);
console.log('Optimized layout and removed scrolling requirement!');
