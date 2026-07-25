const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);

// Fix 1: Remove Download Timeline Button
let dlStart = lines.findIndex(l => l.includes('onClick={handleDownloadTimeline}'));
if (dlStart !== -1) {
    let dlEnd = dlStart;
    while(dlEnd < lines.length && !lines[dlEnd].includes('</button>')) dlEnd++;
    // We want to delete from {isPanelExpanded && ( to )}
    dlStart = dlStart - 2;
    dlEnd = dlEnd + 1; // include )}
    lines.splice(dlStart, dlEnd - dlStart + 1);
    console.log("Removed Download Timeline Button");
}

// Fix 2: Replace Handover Box with Sleek Button and Form
let handoverStart = lines.findIndex(l => l.includes("backgroundColor: (!isHandoverUnlocked && !showHandoverConfirm) ? 'transparent' : 'var(--bg-main)'"));
if (handoverStart !== -1) {
    handoverStart = handoverStart - 1; // Include the <div style={{
    let handoverEnd = handoverStart;
    let openDivs = 0;
    // We will replace up to the form closing
    // A simpler way: we know it ends around </form></div>)}</div>
    let formEnd = lines.findIndex((l, idx) => idx > handoverStart && l.includes('</form>'));
    if (formEnd !== -1) {
        handoverEnd = formEnd + 2; // </form> \n </div> \n )}
        const newHandoverBlock = `                                                            <div style={{ marginTop: '15px' }}>
                                                                {!isHandoverUnlocked ? (
                                                                    <button
                                                                        onClick={() => setIsHandoverUnlocked(true)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '12px',
                                                                            backgroundColor: 'var(--primary)',
                                                                            color: '#fff',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            fontSize: '13px',
                                                                            fontWeight: '600',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                            boxShadow: 'var(--shadow-sm)'
                                                                        }}
                                                                        onMouseOver={(e) => {
                                                                            e.currentTarget.style.backgroundColor = '#f97316';
                                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                                        }}
                                                                        onMouseOut={(e) => {
                                                                            e.currentTarget.style.backgroundColor = 'var(--primary)';
                                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                                                        }}
                                                                    >
                                                                        Click to request handover
                                                                    </button>
                                                                ) : (
                                                                    <div style={{ 
                                                                        backgroundColor: '#ffffff', 
                                                                        padding: '15px', 
                                                                        borderRadius: '8px', 
                                                                        border: '1px solid #e5e7eb',
                                                                        animation: 'fadeIn 0.4s ease'
                                                                    }}>
                                                                        <h5 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#64748b' }}>🔄 Request Handover</h5>
                                                                        <form onSubmit={(e) => handleHandoverRequest(e, selectedTicket.ticket_id)} style={{ display: 'flex', gap: '10px' }}>
                                                                            <select
                                                                                className="form-control"
                                                                                style={{ flex: 1, backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', margin: 0, fontSize: '11px', padding: '8px' }}
                                                                                value={handoverForms[selectedTicket.ticket_id]?.target || ''}
                                                                                onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'target', e.target.value)}
                                                                            >
                                                                                <option value="" disabled>Select peer...</option>
                                                                                {peers.map(p => <option key={p.employee_id} value={p.employee_id}>{p.name}</option>)}
                                                                            </select>
                                                                            <input
                                                                                type="text"
                                                                                className="form-control"
                                                                                style={{ flex: 2, backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', margin: 0, fontSize: '11px', padding: '8px' }}
                                                                                placeholder="Reason for handover (Required)"
                                                                                value={handoverForms[selectedTicket.ticket_id]?.reason || ''}
                                                                                onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'reason', e.target.value)}
                                                                            />
                                                                            <button type="submit" className="btn" style={{ fontSize: '11px', padding: '8px 12px', backgroundColor: 'var(--primary)' }}>Request</button>
                                                                        </form>
                                                                    </div>
                                                                )}`;
        lines.splice(handoverStart, handoverEnd - handoverStart + 1, ...newHandoverBlock.split('\\n'));
        console.log("Replaced Handover Box");
    }
}

fs.writeFileSync(file, lines.join('\\n'));
console.log('Update complete.');
