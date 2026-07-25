const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Revert Save Update Button to just use .btn
content = content.replace(
    `<button type="submit" className="btn" style={{ fontSize: '11px', padding: '8px 12px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px' }}>Save Update</button>`,
    `<button type="submit" className="btn" style={{ fontSize: '11px', padding: '8px 12px' }}>Save Update</button>`
);

// 2. Revert Handover Request back to the shutter mask, but with the requested styles!
const handoverRegex = /<div style=\{\{ marginTop: '15px' \}\}>\s*\{!isHandoverUnlocked \? \(\s*<button[\s\S]*?<\/div>\s*\)\}\s*<\/div>/;

const shutterMaskCode = `<div style={{ 
                                                                backgroundColor: (!isHandoverUnlocked && !showHandoverConfirm) ? 'transparent' : 'var(--bg-main)', 
                                                                padding: !isHandoverUnlocked ? '0' : '15px', 
                                                                height: !isHandoverUnlocked ? (showHandoverConfirm ? '85px' : '44px') : 'auto',
                                                                borderRadius: '6px', 
                                                                border: (!isHandoverUnlocked && !showHandoverConfirm) ? 'none' : '1px dashed var(--border)', 
                                                                position: 'relative', 
                                                                overflow: (!isHandoverUnlocked && !showHandoverConfirm) ? 'visible' : 'hidden', 
                                                                marginTop: '15px',
                                                                transition: 'all 0.3s ease'
                                                            }}>
                                                                <div 
                                                                    style={{ 
                                                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
                                                                        transform: isHandoverUnlocked ? 'translateX(100%)' : 'translateX(0)',
                                                                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                        pointerEvents: isHandoverUnlocked ? 'none' : 'auto'
                                                                    }}
                                                                >
                                                                    {/* The shutter mask */}
                                                                    <div 
                                                                        onClick={() => !showHandoverConfirm && setShowHandoverConfirm(true)}
                                                                        onMouseOver={(e) => {
                                                                            if (!showHandoverConfirm) {
                                                                                e.currentTarget.style.backgroundColor = '#f97316';
                                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                                            }
                                                                        }}
                                                                        onMouseOut={(e) => {
                                                                            if (!showHandoverConfirm) {
                                                                                e.currentTarget.style.backgroundColor = 'var(--primary)';
                                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
                                                                            backgroundColor: showHandoverConfirm ? 'var(--bg-card)' : 'var(--primary)',
                                                                            color: showHandoverConfirm ? 'var(--text-main)' : '#fff',
                                                                            borderRadius: showHandoverConfirm ? '0' : '6px',
                                                                            boxShadow: showHandoverConfirm ? 'none' : 'var(--shadow-sm)',
                                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                            backdropFilter: showHandoverConfirm ? 'blur(4px)' : 'none',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            borderLeft: showHandoverConfirm ? '1px solid var(--border)' : 'none',
                                                                            cursor: showHandoverConfirm ? 'default' : 'pointer'
                                                                        }}
                                                                    >
                                                                        {!showHandoverConfirm ? (
                                                                            <span style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', userSelect: 'none' }}>
                                                                                Click to request handover
                                                                            </span>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 'bold' }}>Do you want to request handover?</span>
                                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                                    <button 
                                                                                        onClick={() => setIsHandoverUnlocked(true)}
                                                                                        style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '4px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
                                                                                    >Yes</button>
                                                                                    <button 
                                                                                        onClick={() => setShowHandoverConfirm(false)}
                                                                                        style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '4px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                                                                    >No</button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {isHandoverUnlocked && (
                                                                    <div style={{ opacity: isHandoverUnlocked ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: '0.1s' }}>
                                                                        <h5 style={{ margin: '0 0 10px 0', fontSize: '11px', color: 'var(--text-muted)' }}>🔄 Request Handover</h5>
                                                                        <form onSubmit={(e) => handleHandoverRequest(e, selectedTicket.ticket_id)} style={{ display: 'flex', gap: '10px' }}>
                                                                            <select
                                                                                className="form-control"
                                                                                style={{ flex: 1, backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', margin: 0, fontSize: '11px', padding: '8px' }}
                                                                                value={handoverForms[selectedTicket.ticket_id]?.target || ''}
                                                                                onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'target', e.target.value)}
                                                                            >
                                                                                <option value="" disabled>Select peer...</option>
                                                                                {peers.map(p => <option key={p.employee_id} value={p.employee_id}>{p.name}</option>)}
                                                                            </select>
                                                                            <input
                                                                                type="text"
                                                                                className="form-control"
                                                                                style={{ flex: 2, backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', margin: 0, fontSize: '11px', padding: '8px' }}
                                                                                placeholder="Reason for handover (Required)"
                                                                                value={handoverForms[selectedTicket.ticket_id]?.reason || ''}
                                                                                onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'reason', e.target.value)}
                                                                            />
                                                                            <button type="submit" className="btn" style={{ fontSize: '11px', padding: '8px 12px' }}>Request</button>
                                                                        </form>
                                                                    </div>
                                                                )}
                                                            </div>`;

content = content.replace(handoverRegex, shutterMaskCode);

fs.writeFileSync(file, content);
console.log('Restored buttons perfectly.');
