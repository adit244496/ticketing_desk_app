const fs = require('fs');
const file = 'src/pages/SolverDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const actionFormsLines = lines.slice(577, 738);
const actionFormsContent = actionFormsLines.join('\n');

const returnIndex = content.indexOf('return (');
const renderActionFormsFunc = `\n    const renderActionForms = () => (\n${actionFormsContent}\n    );\n\n    `;
content = content.slice(0, returnIndex) + renderActionFormsFunc + content.slice(returnIndex);

content = content.replace(actionFormsContent, '                                            {renderActionForms()}');

const placeholderStart = `{/* City Skyline Placeholder at Bottom */}`;
const placeholderEndRegex = /<div style=\{\{ marginTop: 'auto', height: '150px'[\s\S]*?\/>/;

content = content.replace(placeholderStart, '{renderActionForms()}');
content = content.replace(placeholderEndRegex, '');

const layoutSearch = `<div className={!isPanelExpanded ? "slide-in-right-panel" : ""} style={{
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

const layoutReplace = `<div style={{
                        ...(isPanelExpanded ? {
                            position: 'fixed', top: '5%', bottom: '5%', left: '5%', right: '5%',
                            backgroundColor: 'var(--bg-card)', borderRadius: '12px', zIndex: 1000,
                            boxShadow: '0 10px 50px rgba(0,0,0,0.5)', overflowY: 'auto',
                            display: 'flex', flexDirection: 'column'
                        } : {
                            position: 'fixed', right: 0, top: '52px', bottom: 0, width: '450px',
                            margin: 0, borderLeft: '1px solid var(--border)',
                            overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '24px',
                            zIndex: 100, boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
                            backgroundColor: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)'
                        })
                    }}>`;

content = content.replace(layoutSearch, layoutReplace);

fs.writeFileSync(file, content);
console.log('Success');
