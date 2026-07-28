// frontend/src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, LayoutDashboard, Ticket, CheckSquare, Settings, Bell, CheckCircle2, Sun, Moon, ChevronDown, ChevronRight, TrendingUp, Clock, Users, MapPin, Cog, PlusCircle, ClipboardList, Zap, CheckCircle, BarChart2, Calendar, Menu } from 'lucide-react';
import CalendarModal from './CalendarModal';

const TABS_CONFIG = {
    '/admin': [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> },
        { id: 'masters', label: <><Settings size={12} /> Master Creations</> }
    ],
    '/dept-head': [
        { id: 'analytics', label: <><TrendingUp size={12} /> Analytics</> },
        { id: 'overview', label: <><BarChart2 size={12} /> Dept Overview</> },
        { id: 'approvals', label: <><CheckCircle size={12} /> Approvals</> },
        { id: 'override', label: <><Zap size={12} /> Manager Override</> },
        { id: 'rules', label: <><Cog size={12} /> Dept Routing Rules</> }
    ],
    '/requestor': [
        { id: 'history', label: <><ClipboardList size={12} /> My Ticket History</> },
        { id: 'raise', label: <><PlusCircle size={12} /> Raise New Ticket</> }
    ],
    '/solver': [
        { id: 'active', label: <><Zap size={12} /> Active Tasks</> },
        { id: 'closed', label: <><CheckCircle size={12} /> Closed Tasks</> }
    ]
};
import api from '../api';

const Layout = ({ children, user, setUser, sidebarTabs, activeTab, setActiveTab }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // --- THEME STATE ---
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const hour = new Date().getHours();
        const minute = new Date().getMinutes();
        // Light mode: 12:00 AM to 12:00 PM
        if (hour < 12 || (hour === 12 && minute === 0)) {
            return false;
        }
        // Dark mode: 12:01 PM to 11:59 PM
        return true;
    });

    // --- SIDEBAR STATE ---
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });
    
    const [hoveredNav, setHoveredNav] = useState(null);
    const hoverTimeoutRef = useRef(null);

    const handleMouseEnter = (path) => {
        if (!isSidebarCollapsed) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setHoveredNav(path);
    };

    const handleMouseLeave = () => {
        if (!isSidebarCollapsed) return;
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredNav(null);
        }, 500);
    };

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);

    // --- NOTIFICATION STATE ---
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false); // To handle dropdown expansion in sidebar
    const [showCalendar, setShowCalendar] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const notifRef = useRef(null);

    const [openNavMenus, setOpenNavMenus] = useState({});
    const [mountedPath, setMountedPath] = useState(null);
    const lastPath = sessionStorage.getItem('lastPath') || null;

    useEffect(() => {
        const timer = setTimeout(() => {
            setMountedPath(location.pathname);
            sessionStorage.setItem('lastPath', location.pathname);
        }, 10);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    // Dynamic Theme Variables for Native Elements - ENHANCED CONTRAST
    const t = isDarkMode ? {
        bg: '#1e1e1e',
        surface: '#1e1e1e',
        card: '#252526',
        border: '#333333',
        borderHover: '#444444',
        text: '#d4d4d4',
        textMuted: '#a1a1aa',
        textSub: '#71717a',
        navActiveBg: '#ededed',
        navActiveText: '#000000',
        dangerBg: 'rgba(239, 68, 68, 0.1)',
        dangerText: '#ef4444'
    } : {
        bg: '#fdba74', // Neotia Orange Tint
        surface: '#ffffff',
        card: '#ffffff',
        border: '#cbd5e1', // Crisp, visible borders
        borderHover: '#94a3b8',
        text: '#0f172a', // Bold dark slate
        textMuted: '#475569', // Highly readable dark gray
        textSub: '#64748b', // Medium gray
        navActiveBg: '#e2e8f0',
        navActiveText: '#0f172a',
        dangerBg: '#fef2f2',
        dangerText: '#b91c1c'
    };

    const sb = isDarkMode ? {
        bg: t.surface,
        border: t.border,
        borderLight: t.border,
        text: t.text,
        textMuted: t.textMuted,
        textSub: t.textSub,
        card: t.card,
        navActiveBg: t.navActiveBg,
        navActiveText: t.navActiveText,
        navHoverBg: t.card,
        navHoverText: t.text
    } : {
        bg: '#184F7E',
        border: 'rgba(255, 255, 255, 0.1)',
        borderLight: 'rgba(255, 255, 255, 0.05)',
        text: '#ffffff',
        textMuted: 'rgba(255, 255, 255, 0.7)',
        textSub: 'rgba(255, 255, 255, 0.5)',
        card: 'rgba(0, 0, 0, 0.2)',
        navActiveBg: 'rgba(255, 255, 255, 0.2)',
        navActiveText: '#ffffff',
        navHoverBg: 'rgba(255, 255, 255, 0.1)',
        navHoverText: '#ffffff'
    };

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.remove('light-mode');
            document.body.style.backgroundColor = '#1e1e1e';
        } else {
            document.body.classList.add('light-mode');
            document.body.style.backgroundColor = 'var(--bg-main)';
        }

        return () => {
            document.body.classList.remove('light-mode');
            document.body.style.backgroundColor = '';
        };
    }, [isDarkMode]);

    useEffect(() => {
        const fetchNotifs = async () => {
            if (!user?.email) return;
            try {
                const response = await api.get(`/notifications?email=${user.email}`);
                const sorted = response.data.sort((a, b) => b.notif_id - a.notif_id);
                setNotifications(sorted);
            } catch (err) { console.error("Notification fetch failed"); }
        };

        fetchNotifs();
        const interval = setInterval(fetchNotifs, 30000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifs(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (notifId) => {
        try {
            await api.post('/notifications/mark-read', { notif_id: notifId });
            setNotifications(notifications.map(n => n.notif_id === notifId ? { ...n, is_read: true } : n));
        } catch (err) { console.error("Failed to mark as read"); }
    };

    const markAllAsRead = async () => {
        if (!user || !user.email) return;
        try {
            await api.post('/notifications/mark-all-read', { email: user.email });
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        } catch (err) { console.error("Failed to mark all as read"); }
    };

    const handleLogout = () => {
        localStorage.removeItem('ticket_user');
        if (setUser) setUser(null);
        navigate('/');
    };

    if (!user) {
        return (
            <div style={{ minHeight: '100%', backgroundColor: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
                <p>Authenticating session...</p>
            </div>
        );
    }

    const getNavLinks = () => {
        const links = [];
        const rawRole = String(user.role || '').toLowerCase().replace(/\s+/g, '');
        let normRole = rawRole;
        if (rawRole === 'user' || rawRole === 'requester') normRole = 'requestor';

        if (['admin', 'superadmin', 'audit'].includes(normRole)) {
            links.push({ name: 'System Admin', path: '/admin', icon: <Settings size={13} /> });
        }
        if (['dept.head'].includes(normRole)) {
            links.push({ name: 'Department Head', path: '/dept-head', icon: <LayoutDashboard size={13} /> });
        }
        if (['requestor', 'dept.head'].includes(normRole)) {
            links.push({ name: 'Raise Ticket', path: '/requestor', icon: <Ticket size={13} /> });
        }
        if (['solver', 'dept.head'].includes(normRole)) {
            links.push({ name: 'My Tasks', path: '/solver', icon: <CheckSquare size={13} /> });
        }
        return links;
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const toggleNavMenu = (path) => {
        setOpenNavMenus(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    return (
        <div className="app-layout" style={{ display: 'flex', minHeight: '100%', backgroundColor: t.bg, color: t.text, transition: 'background-color 0.3s' }}>

            {/* GLOBAL CSS OVERRIDE ENGINE FOR LIGHT MODE */}
            <style>{`
                body.light-mode .dashboard-wrapper div[style*="background-color: rgb(24, 24, 27)"],
                body.light-mode .dashboard-wrapper div[style*="background-color: #18181b"],
                body.light-mode .dashboard-wrapper div[style*="background-color: rgb(9, 9, 11)"],
                body.light-mode .dashboard-wrapper div[style*="background-color: #09090b"],
                body.light-mode .dashboard-wrapper div[style*="backgroundColor: #18181b"],
                body.light-mode .dashboard-wrapper div[style*="background-color: #000000"],
                body.light-mode .dashboard-wrapper div[style*="background-color: rgb(0, 0, 0)"] {
                    background-color: #ffffff !important;
                    border-color: #cbd5e1 !important; 
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06) !important; 
                }

                body.light-mode .dashboard-wrapper div[style*="rgba(0, 0, 0, 0.75)"],
                body.light-mode .dashboard-wrapper div[style*="rgba(0, 0, 0, 0.85)"] {
                    background-color: rgba(15, 23, 42, 0.5) !important;
                    backdrop-filter: blur(4px) !important;
                }

                body.light-mode .dashboard-wrapper,
                body.light-mode .dashboard-wrapper h1, 
                body.light-mode .dashboard-wrapper h2, 
                body.light-mode .dashboard-wrapper h3, 
                body.light-mode .dashboard-wrapper h4, 
                body.light-mode .dashboard-wrapper h5, 
                body.light-mode .dashboard-wrapper h6, 
                body.light-mode .dashboard-wrapper strong,
                body.light-mode .dashboard-wrapper .card h2,
                body.light-mode .dashboard-wrapper .card h3 {
                    color: #0f172a !important;
                }

                body.light-mode .dashboard-wrapper [style*="color: rgb(255, 255, 255)"],
                body.light-mode .dashboard-wrapper [style*="color: rgb(237, 237, 237)"],
                body.light-mode .dashboard-wrapper [style*="color: rgb(212, 212, 216)"],
                body.light-mode .dashboard-wrapper [style*="color: #fff"],
                body.light-mode .dashboard-wrapper [style*="color: #ffffff"],
                body.light-mode .dashboard-wrapper [style*="color: #ededed"],
                body.light-mode .dashboard-wrapper [style*="color: #d4d4d8"] {
                    color: #0f172a !important;
                }

                body.light-mode .dashboard-wrapper [style*="color: rgb(161, 161, 170)"],
                body.light-mode .dashboard-wrapper [style*="color: rgb(113, 113, 122)"],
                body.light-mode .dashboard-wrapper [style*="color: #a1a1aa"],
                body.light-mode .dashboard-wrapper [style*="color: #71717a"] {
                    color: #475569 !important;
                    font-weight: 600 !important;
                }

                body.light-mode .dashboard-wrapper input,
                body.light-mode .dashboard-wrapper select,
                body.light-mode .dashboard-wrapper textarea,
                body.light-mode .dashboard-wrapper .form-control {
                    background-color: #f8fafc !important;
                    color: #0f172a !important;
                    border: 1px solid #94a3b8 !important;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.05) !important;
                }
                body.light-mode .dashboard-wrapper input::placeholder,
                body.light-mode .dashboard-wrapper textarea::placeholder {
                    color: #94a3b8 !important;
                }

                body.light-mode .dashboard-wrapper table {
                    color: #0f172a !important;
                }
                body.light-mode .dashboard-wrapper table thead,
                body.light-mode .dashboard-wrapper table th {
                    background-color: #f1f5f9 !important;
                    color: #1e293b !important;
                    border-bottom: 2px solid #94a3b8 !important;
                    font-weight: 700 !important;
                }
                body.light-mode .dashboard-wrapper table tr {
                    border-bottom: 1px solid #cbd5e1 !important;
                }
                body.light-mode .dashboard-wrapper table td {
                    color: #0f172a !important;
                    font-weight: 500 !important;
                }
                body.light-mode .dashboard-wrapper table tr:hover {
                    background-color: #f1f5f9 !important;
                }

                body.light-mode .dashboard-wrapper table td[style*="color: rgb(255, 255, 255)"],
                body.light-mode .dashboard-wrapper table td[style*="color: rgb(161, 161, 170)"] {
                    color: #0f172a !important;
                }

                body.light-mode .dashboard-wrapper [style*="border-bottom: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="border-top: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="border: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="border: 1px solid #3f3f46"],
                body.light-mode .dashboard-wrapper [style*="border-bottom: 2px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="borderBottom: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="borderTop: 1px solid #27272a"] {
                    border-color: #cbd5e1 !important;
                }

                body.light-mode .dashboard-wrapper span[style*="background-color: rgba(59, 130, 246, 0.1)"] {
                    background-color: #eff6ff !important;
                    color: #1d4ed8 !important;
                    border: 1px solid #bfdbfe !important;
                }
                body.light-mode .dashboard-wrapper span[style*="background-color: rgba(16, 185, 129, 0.1)"] {
                    background-color: #ecfdf5 !important;
                    color: #047857 !important;
                    border: 1px solid #a7f3d0 !important;
                }
                body.light-mode .dashboard-wrapper span[style*="background-color: rgba(239, 68, 68, 0.1)"] {
                    background-color: #fef2f2 !important;
                    color: #b91c1c !important;
                    border: 1px solid #fecaca !important;
                }
                
                /* Prevent any SVG icon in the sidebar from shrinking */
                .sidebar svg {
                    flex-shrink: 0 !important;
                }
            `}</style>

            {/* SIDEBAR NAVIGATION */}
            <aside className="sidebar" style={{
                width: isSidebarCollapsed ? '64px' : '200px', backgroundColor: sb.bg, borderRight: `1px solid ${sb.border}`,
                position: 'fixed', height: '100%', display: 'flex', flexDirection: 'column', zIndex: 10, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s, border-color 0.3s'
            }}>
                <div style={{ padding: '0 16px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', overflow: 'hidden' }}>
                    {!isSidebarCollapsed && (
                        <h2 style={{ fontSize: '11px', color: sb.text, margin: 0, fontWeight: '700', letterSpacing: '0.05em', lineHeight: '1.3' }}>
                            HOSPITALITY<br/>TICKETING TOOL
                        </h2>
                    )}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: sb.textMuted, padding: '6px', borderRadius: '5px',
                            transition: 'all 0.2s', flexShrink: 0
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = sb.navHoverBg}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Toggle Sidebar"
                    >
                        <Menu size={18} />
                    </button>
                </div>



                <div style={{ flex: 1, padding: isSidebarCollapsed ? '8px 6px' : '8px 13px', overflowY: isSidebarCollapsed ? 'visible' : 'auto', overflowX: isSidebarCollapsed ? 'visible' : 'hidden' }}>
                    {!isSidebarCollapsed && (
                        <p style={{ fontSize: '10px', fontWeight: '600', color: sb.textSub, marginBottom: '10px', marginTop: '8px', textTransform: 'uppercase', paddingLeft: '6px', letterSpacing: '0.05em' }}>
                            Navigation
                        </p>
                    )}
                    {getNavLinks().map((link) => {
                        const isActiveRoute = location.pathname.startsWith(link.path);
                        const wasActive = lastPath && lastPath.startsWith(link.path);
                        
                        let isOpen = false;
                        if (mountedPath === location.pathname) {
                            isOpen = openNavMenus[link.path] !== undefined ? openNavMenus[link.path] : isActiveRoute;
                        } else {
                            isOpen = openNavMenus[link.path] !== undefined ? openNavMenus[link.path] : wasActive;
                        }

                        const linkTabs = isActiveRoute ? sidebarTabs : TABS_CONFIG[link.path];
                        const hasTabs = linkTabs && linkTabs.length > 0;

                        return (
                            <div 
                                key={link.path} 
                                style={{ position: 'relative' }}
                                onMouseEnter={() => handleMouseEnter(link.path)}
                                onMouseLeave={handleMouseLeave}
                            >
                                <Link
                                    to={link.path}
                                    onClick={(e) => {
                                        if (isActiveRoute) {
                                            e.preventDefault();
                                        }
                                        toggleNavMenu(link.path);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', textDecoration: 'none',
                                        borderRadius: '6px', marginBottom: '8px',
                                        backgroundColor: isActiveRoute ? sb.navActiveBg : 'transparent',
                                        color: isActiveRoute ? sb.navActiveText : sb.textMuted,
                                        fontWeight: isActiveRoute ? '600' : '500',
                                        fontSize: '13px',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseOver={(e) => { if (!isActiveRoute) { e.currentTarget.style.backgroundColor = sb.navHoverBg; e.currentTarget.style.color = sb.navHoverText; } }}
                                    onMouseOut={(e) => { if (!isActiveRoute) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = sb.textMuted; } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', flexShrink: 0 }} title={isSidebarCollapsed ? link.name : ''}>
                                            {link.icon}
                                        </div>
                                        {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{link.name}</span>}
                                    </div>

                                    {hasTabs && !isSidebarCollapsed && (
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        </div>
                                    )}
                                </Link>

                                {hasTabs && (
                                    <div style={isSidebarCollapsed ? {
                                        // FLOATING POPOVER
                                        position: 'absolute',
                                        left: '56px',
                                        top: '0px',
                                        backgroundColor: sb.bg,
                                        border: `1px solid ${sb.border}`,
                                        borderRadius: '8px',
                                        padding: '6px',
                                        minWidth: '180px',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                        zIndex: 100,
                                        display: (hoveredNav === link.path) ? 'flex' : 'none',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    } : {
                                        // INLINE ACCORDION
                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                        paddingLeft: '26px',
                                        borderLeft: `1px solid ${sb.border}`, marginLeft: '13px',
                                        maxHeight: isOpen ? '300px' : '0px',
                                        opacity: isOpen ? 1 : 0,
                                        overflow: 'hidden',
                                        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        marginBottom: isOpen ? '13px' : '0px',
                                        marginTop: isOpen ? '4px' : '0px',
                                        pointerEvents: isOpen ? 'auto' : 'none'
                                    }}>
                                        {linkTabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isActiveRoute && setActiveTab) {
                                                        setActiveTab(tab.id);
                                                    } else {
                                                        navigate(link.path);
                                                    }
                                                }}
                                                style={{
                                                    textAlign: 'left', padding: '8px 12px',
                                                    backgroundColor: activeTab === tab.id ? sb.navHoverBg : 'transparent',
                                                    color: activeTab === tab.id ? sb.navHoverText : sb.textSub,
                                                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                    fontSize: '12px', fontWeight: activeTab === tab.id ? '600' : '400',
                                                    transition: 'all 0.2s',
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                onMouseOver={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.color = sb.navHoverText; e.currentTarget.style.backgroundColor = isDarkMode ? sb.navHoverBg : 'rgba(255, 255, 255, 0.05)'; } }}
                                                onMouseOut={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.color = sb.textSub; e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ padding: '16px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={handleLogout}
                        title={isSidebarCollapsed ? "Log Out" : ""}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: isSidebarCollapsed ? '10px' : '10px', background: t.dangerBg, border: 'none', borderRadius: '6px',
                            color: t.dangerText, cursor: 'pointer', fontWeight: '600', width: '100%', fontSize: '11px',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = '#ffffff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = t.dangerBg; e.currentTarget.style.color = t.dangerText; }}
                    >
                        <LogOut size={13} /> {!isSidebarCollapsed && "Log Out"}
                    </button>
                </div>
            </aside>

            {/* MAIN DASHBOARD CONTENT AREA */}
            <div className="dashboard-wrapper" style={{ marginLeft: isSidebarCollapsed ? '64px' : '200px', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>

                <header style={{
                    height: '52px', backgroundColor: t.surface, borderBottom: `1px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
                    position: 'sticky', top: 0, zIndex: 2000, transition: 'background-color 0.3s, border-color 0.3s'
                }}>
                    {/* LEFT SIDE: LOGO */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img 
                            src="/logo.png" 
                            alt="Company Logo" 
                            style={{ height: '28px', objectFit: 'contain', filter: isDarkMode ? 'brightness(0.9)' : 'none' }} 
                        />
                    </div>

                    {/* RIGHT SIDE: ICONS & USER PROFILE */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                padding: '6px', borderRadius: '50%', marginRight: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: t.textMuted, transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.card}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                        </button>

                        <button
                            onClick={() => setShowCalendar(true)}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                padding: '6px', borderRadius: '50%', marginRight: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: t.textMuted, transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.card}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Open Calendar"
                        >
                            <Calendar size={16} />
                        </button>

                        <div ref={notifRef} style={{ position: 'relative', marginRight: '16px' }}>
                            <button
                                onClick={() => setShowNotifs(!showNotifs)}
                                style={{
                                    background: showNotifs ? t.card : 'transparent', border: '1px solid', borderColor: showNotifs ? t.borderHover : 'transparent',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '6px', borderRadius: '50%', transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.card}
                                onMouseOut={(e) => { if (!showNotifs) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <Bell size={16} color={unreadCount > 0 ? t.text : t.textMuted} />

                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#ef4444',
                                        color: '#fff', borderRadius: '50%', width: '13px', height: '13px', fontSize: '10px',
                                        fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: `2px solid ${t.surface}`
                                    }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifs && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '280px',
                                    backgroundColor: t.card, border: `1px solid ${t.borderHover}`, borderRadius: '6px',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 9999
                                }}>
                                    <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.surface }}>
                                        <h4 style={{ margin: 0, fontSize: '11px', color: t.text, fontWeight: '600' }}>Notifications</h4>
                                        {unreadCount > 0 && (
                                            <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle2 size={10} /> Mark all read
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '24px 16px', textAlign: 'center', color: t.textSub, fontSize: '10px' }}>
                                                You're all caught up! No notifications yet.
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.notif_id}
                                                    onClick={() => !n.is_read && markAsRead(n.notif_id)}
                                                    style={{
                                                        padding: '10px 12px', borderBottom: `1px solid ${t.border}`, cursor: n.is_read ? 'default' : 'pointer',
                                                        backgroundColor: n.is_read ? 'transparent' : (isDarkMode ? 'rgba(59, 130, 246, 0.05)' : '#eff6ff'),
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseOver={e => { if (!n.is_read) e.currentTarget.style.backgroundColor = t.border; }}
                                                    onMouseOut={e => { if (!n.is_read) e.currentTarget.style.backgroundColor = (isDarkMode ? 'rgba(59, 130, 246, 0.05)' : '#eff6ff'); }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                {n.ticket_id && (
                                                                    <span style={{
                                                                        fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', width: 'fit-content',
                                                                        backgroundColor: isDarkMode ? 'rgba(156, 163, 175, 0.15)' : '#f3f4f6',
                                                                        color: isDarkMode ? '#d1d5db' : '#4b5563',
                                                                        border: `1px solid ${t.borderHover}`
                                                                    }}>
                                                                        #{n.ticket_id}
                                                                    </span>
                                                                )}
                                                                {n.role_context && n.role_context !== 'System' && (
                                                                    <span style={{
                                                                        fontSize: '8px', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold', width: 'fit-content',
                                                                        backgroundColor: n.role_context === 'Requestor' ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe') :
                                                                                         n.role_context === 'Solver' ? (isDarkMode ? 'rgba(249, 115, 22, 0.2)' : '#ffedd5') :
                                                                                         n.role_context === 'Superadmin' ? (isDarkMode ? 'rgba(234, 179, 8, 0.2)' : '#fef3c7') :
                                                                                         n.role_context === 'Admin' ? (isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2') :
                                                                                         n.role_context === 'Viewer' ? (isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff') :
                                                                                         (isDarkMode ? 'rgba(156, 163, 175, 0.2)' : '#f3f4f6'),
                                                                        color: n.role_context === 'Requestor' ? (isDarkMode ? '#93c5fd' : '#2563eb') :
                                                                               n.role_context === 'Solver' ? (isDarkMode ? '#fdba74' : '#ea580c') :
                                                                               n.role_context === 'Superadmin' ? (isDarkMode ? '#fde047' : '#d97706') :
                                                                               n.role_context === 'Admin' ? (isDarkMode ? '#fca5a5' : '#dc2626') :
                                                                               n.role_context === 'Viewer' ? (isDarkMode ? '#d8b4fe' : '#9333ea') :
                                                                               (isDarkMode ? '#d1d5db' : '#4b5563')
                                                                    }}>
                                                                        {n.role_context === 'Viewer' ? 'CC (Viewer)' : n.role_context}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span style={{ fontSize: '10px', lineHeight: '1.4', color: n.is_read ? t.textMuted : t.text, fontWeight: n.is_read ? '400' : '600' }}>
                                                                {n.message}
                                                            </span>
                                                        </div>
                                                        {!n.is_read && <span style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', flexShrink: 0, marginTop: '4px' }}></span>}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: t.textSub, marginTop: '5px' }}>{n.timestamp}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* VERTICAL DIVIDER */}
                        <div style={{ width: '1px', height: '24px', backgroundColor: t.border, margin: '0 16px' }}></div>

                        {/* USER PROFILE */}
                        <div style={{ position: 'relative' }}>
                            <div 
                                onClick={() => setShowUserProfile(!showUserProfile)}
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', transition: 'background-color 0.2s', border: `1px solid ${showUserProfile ? t.borderHover : 'transparent'}`, backgroundColor: showUserProfile ? t.card : 'transparent' }}
                                onMouseOver={(e) => { if(!showUserProfile) e.currentTarget.style.backgroundColor = t.card; }}
                                onMouseOut={(e) => { if(!showUserProfile) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: t.text }}>{user.name || 'Unknown User'}</span>
                                    <span style={{ fontSize: '10px', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{user.role || 'No Role'}</span>
                                        <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: t.textMuted, opacity: 0.5 }} />
                                        <span>{user.department || 'No Dept'}</span>
                                    </span>
                                </div>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            </div>

                            {/* DROPDOWN POPOVER */}
                            {showUserProfile && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '280px',
                                    backgroundColor: t.card, border: `1px solid ${t.borderHover}`, borderRadius: '12px',
                                    boxShadow: '0 12px 30px -10px rgba(0, 0, 0, 0.3)', zIndex: 9999,
                                    overflow: 'hidden', display: 'flex', flexDirection: 'column'
                                }}>
                                    {/* Header Section */}
                                    <div style={{ 
                                        padding: '24px 20px', 
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                                        borderBottom: `1px solid ${t.border}`,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                                    }}>
                                        <div style={{ 
                                            width: '64px', height: '64px', borderRadius: '50%', 
                                            backgroundColor: '#3b82f6', color: '#fff', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            fontSize: '28px', fontWeight: 'bold',
                                            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                                        }}>
                                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: t.text }}>{user.name || 'Unknown User'}</div>
                                            <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user.role || 'No Role'}</div>
                                        </div>
                                    </div>

                                    {/* Details Section */}
                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '10px', color: t.textSub, textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Email Address</span>
                                                <span style={{ fontSize: '13px', color: t.text, fontWeight: '500' }}>{user.email || 'N/A'}</span>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '10px', color: t.textSub, textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Phone Number</span>
                                                <span style={{ fontSize: '13px', color: t.text, fontWeight: '500' }}>{user.phone || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="8" y="14" width="8" height="4" rx="1" ry="1"/></svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '10px', color: t.textSub, textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>ID & Grade</span>
                                                <span style={{ fontSize: '13px', color: t.text, fontWeight: '500' }}><span style={{ fontFamily: 'monospace' }}>{user.employee_id || 'N/A'}</span> <span style={{ color: t.textMuted }}>•</span> {user.grade || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main style={{ padding: '24px 32px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {children}
                </main>
            </div>

            {/* CALENDAR MODAL */}
            {showCalendar && (
                <CalendarModal 
                    user={user} 
                    isDarkMode={isDarkMode} 
                    onClose={() => setShowCalendar(false)} 
                />
            )}
        </div>
    );
};

export default Layout;