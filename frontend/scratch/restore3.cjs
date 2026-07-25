const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('placeholder="Reason for handover (Required)"'));
const endIdx = lines.findIndex(l => l.includes('<span className="rating-badge"'));

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `                                                                                placeholder="Reason for handover (Required)"
                                                                                value={handoverForms[selectedTicket.ticket_id]?.reason || ''}
                                                                                onChange={(e) => handleHandoverFormChange(selectedTicket.ticket_id, 'reason', e.target.value)}
                                                                            />
                                                                            <button type="submit" className="btn" style={{ fontSize: '10px', padding: '6px 10px' }}>Request</button>
                                                                        </form>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
    );

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={setActiveTab}>

            {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}
            <div style={{ paddingRight: selectedTicket ? (isPanelExpanded ? '0' : '434px') : '0', transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>

                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px' }}><Wrench size={22} color="#3b82f6" /> My Priority Queue</h2>`;

    lines.splice(startIdx, endIdx - startIdx, ...replacement.split('\n'));
    fs.writeFileSync(file, lines.join('\n'));
    console.log("Success! Replaced correctly.");
} else {
    console.log("Failed to find indices", startIdx, endIdx);
}
