const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                                                                    </div>
            {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}`;

const replaceStr = `                                                                    </div>
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

            {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(file, content);
console.log('Restored deleted lines!');
