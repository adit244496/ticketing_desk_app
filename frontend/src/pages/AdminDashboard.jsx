// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import api, {
    fetchUsers, createUser, updateUser,
    fetchLocations, createLocation, updateLocation,
    fetchDepartments, createDepartment,
    fetchMasterRules, updateMasterRule,
    fetchTickets, fetchTicketLogs,
    deleteUser, adminResetPassword, deleteLocation, deleteDepartment, deleteMasterRule,
    uploadImportFile, getImportTemplateUrl, updateDepartment, toggleUserStatus
} from '../api';
import Layout from '../components/Layout';
import AdminAnalytics from '../components/AdminAnalytics';
import TicketTimeline from '../components/TicketTimeline';
import { Download, AlertTriangle, Settings, TrendingUp, Clock, Users, MapPin, Cog, CheckCircle2, FileText, MessageSquare, Paperclip, X, Maximize2, Minimize2, Filter, Upload, FileUp, Key, Trash2, Search, Star, User, ShieldCheck, Pen, Power } from 'lucide-react';
import TicketFilterBar from '../components/TicketFilterBar';

const AdminDashboard = ({ user, setUser }) => {
    const [activeTab, setActiveTab] = useState('analytics');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [usersList, setUsersList] = useState([]);
    const [locationsList, setLocationsList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [rulesList, setRulesList] = useState([]);
    const [ticketsList, setTicketsList] = useState([]);
    
    // --- MASTER INNER TAB STATE ---
    const [activeMasterTab, setActiveMasterTab] = useState('users');

    // --- AGEING REPORT STATE ---
    const [ageingData, setAgeingData] = useState([]);
    const [filteredAgeing, setFilteredAgeing] = useState([]);

    // --- TICKET SIDE PANEL STATE ---
    const [selectedTicket, setSelectedTicket] = useState(null);
    
    // --- MASTER ROW SELECTION STATE ---
    const [selectedUserRow, setSelectedUserRow] = useState(null);
    const [selectedLocRow, setSelectedLocRow] = useState(null);
    const [selectedDeptRow, setSelectedDeptRow] = useState(null);
    const [selectedRuleRow, setSelectedRuleRow] = useState(null);
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState('details');
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const location = useLocation();

    // Reset expanded panel and selected ticket when navigating
    useEffect(() => {
        setSelectedTicket(null);
        setIsPanelExpanded(false);
    }, [location.key]);

    // Deselect row when clicking outside the table or action buttons
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.master-table-container') && !e.target.closest('.action-btn-group')) {
                setSelectedUserRow(null);
                setSelectedLocRow(null);
                setSelectedDeptRow(null);
                setSelectedRuleRow(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // --- IMPORT UI STATE ---
    const [importFile, setImportFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importSuccess, setImportSuccess] = useState('');
    const [importError, setImportError] = useState('');
    const [activeImportTab, setActiveImportTab] = useState('users');

    // --- USERS UI STATE ---
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userModalMode, setUserModalMode] = useState('add');
    const defaultUser = { employee_id: '', email: '', name: '', role: '', department: '', outlet: '', grade: '', phone: '', critical_user_rating: 0, manager: '' };
    const [userFormData, setUserFormData] = useState(defaultUser);

    // --- LOCATIONS UI STATE ---
    const [locSearchQuery, setLocSearchQuery] = useState('');
    const [isLocModalOpen, setIsLocModalOpen] = useState(false);
    const [locModalMode, setLocModalMode] = useState('add');
    const defaultLocation = { outlet: '', brand: '', location: '', city: 'KOLKATA' };
    const [locFormData, setLocFormData] = useState(defaultLocation);

    // --- DEPARTMENTS UI STATE ---
    const [deptSearchQuery, setDeptSearchQuery] = useState('');
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [deptModalMode, setDeptModalMode] = useState('add');
    const [editDeptName, setEditDeptName] = useState('');
    const [deptFormData, setDeptFormData] = useState({ department_name: '' });

    // --- RULES UI STATE ---
    const [ruleSearchQuery, setRuleSearchQuery] = useState('');
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [ruleModalMode, setRuleModalMode] = useState('edit');
    const defaultRule = { department: '', issue_type: '', outlet: '', base_priority: 3, assigned_solver: '', deadline_hours: '' };
    const [editRule, setEditRule] = useState(defaultRule);

    // --- ADVANCED FILTERS STATE ---
    // User Filters
    const [showUserFilterDropdown, setShowUserFilterDropdown] = useState(false);
    const [activeUserFilters, setActiveUserFilters] = useState([]);
    const defaultUserFilters = { role: '', department: '', name: '', emp_id: '', location: '' };
    const [userFilters, setUserFilters] = useState(defaultUserFilters);

    // Location Filters
    const [showLocFilterDropdown, setShowLocFilterDropdown] = useState(false);
    const [activeLocFilters, setActiveLocFilters] = useState([]);
    const defaultLocFilters = { brand: '', city: '', location: '', code: '' };
    const [locFilters, setLocFilters] = useState(defaultLocFilters);

    // Rules Filters
    const [showRuleFilterDropdown, setShowRuleFilterDropdown] = useState(false);
    const [activeRuleFilters, setActiveRuleFilters] = useState([]);
    const defaultRuleFilters = { department: '', issue_type: '', assigned_solver: '', location: '' };
    const [ruleFilters, setRuleFilters] = useState(defaultRuleFilters);

    // --- RATINGS REPORT UI STATE ---
    const [ratingSubTab, setRatingSubTab] = useState('requestor');
    const [ratingSearchQuery, setRatingSearchQuery] = useState('');
    const [ratingSortField, setRatingSortField] = useState('avgRating');
    const [ratingSortOrder, setRatingSortOrder] = useState('desc');

    const getUserMatch = (assignedToRaw, user) => {
        if (!assignedToRaw || !user) return false;
        const rawStr = String(assignedToRaw).toLowerCase();
        
        // The backend formats assigned_to as "Name (Phone)" before sending to frontend
        if (user.name && rawStr.includes(String(user.name).toLowerCase())) return true;
        if (user.phone && rawStr.includes(String(user.phone).toLowerCase())) return true;

        const parts = rawStr.split(',').map(s => s.trim());
        const userEmpId = String(user.employee_id || '').toLowerCase().trim();
        const userEmpIdClean = userEmpId.split('.')[0];
        const userEmail = String(user.email || '').toLowerCase().trim();

        return parts.some(part => {
            const pClean = part.split('.')[0];
            return part === userEmpId || (userEmpIdClean && pClean === userEmpIdClean) || part === userEmail;
        });
    };

    const isRaiserMatch = (raiserProp, user) => {
        if (!raiserProp || !user) return false;
        const rStr = String(raiserProp).trim().toLowerCase();
        const rClean = rStr.split('.')[0];
        const emailStr = String(user.email || '').toLowerCase().trim();
        const empIdStr = String(user.employee_id || '').toLowerCase().trim();
        const empIdClean = empIdStr.split('.')[0];
        return rStr === emailStr || (empIdClean && rClean === empIdClean);
    };

    const getRatingNum = (ticket, field1, field2) => {
        if (!ticket) return null;
        const val1 = ticket[field1];
        if (val1 !== undefined && val1 !== null && val1 !== '' && !isNaN(Number(val1))) {
            return Number(val1);
        }
        const val2 = ticket[field2];
        if (val2 !== undefined && val2 !== null && val2 !== '' && !isNaN(Number(val2))) {
            return Number(val2);
        }
        return null;
    };

    const requestorRatingsList = useMemo(() => {
        const requestorEmails = new Set(ticketsList.map(t => String(t.raiser_email || '').toLowerCase()).filter(Boolean));
        const requestors = usersList.filter(u => u.role === 'Requestor' || (u.role !== 'Admin' && u.role !== 'Super Admin' && requestorEmails.has(String(u.email || '').toLowerCase())));

        return requestors.map(u => {
            const userTickets = ticketsList.filter(t => isRaiserMatch(t.raiser_email, u));
            const ratedScores = userTickets
                .map(t => getRatingNum(t, 'requestor_rating', 'solver_rating_raiser'))
                .filter(score => score !== null);

            const totalScore = ratedScores.reduce((sum, score) => sum + score, 0);
            const avg = ratedScores.length > 0 ? (totalScore / ratedScores.length).toFixed(1) : null;
            return {
                ...u,
                ratedCount: ratedScores.length,
                totalTickets: userTickets.length,
                avgRating: avg
            };
        });
    }, [usersList, ticketsList]);

    const solverRatingsList = useMemo(() => {
        // Only include Solvers and Dept. Heads (strictly exclude Admin and Super Admin)
        const solvers = usersList.filter(u => u.role === 'Solver' || u.role === 'Dept. Head');

        return solvers.map(u => {
            const userTickets = ticketsList.filter(t => getUserMatch(t.assigned_to, u));
            const ratedScores = userTickets
                .map(t => getRatingNum(t, 'solver_rating', 'raiser_rating_solver'))
                .filter(score => score !== null);

            const totalScore = ratedScores.reduce((sum, score) => sum + score, 0);
            const avg = ratedScores.length > 0 ? (totalScore / ratedScores.length).toFixed(1) : null;
            return {
                ...u,
                ratedCount: ratedScores.length,
                totalTickets: userTickets.length,
                avgRating: avg
            };
        });
    }, [usersList, ticketsList]);

    const filteredRatingList = useMemo(() => {
        const list = ratingSubTab === 'requestor' ? requestorRatingsList : solverRatingsList;
        const q = ratingSearchQuery.toLowerCase().trim();
        let result = list;
        if (q) {
            result = list.filter(u => 
                String(u.name || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q) ||
                String(u.employee_id || '').toLowerCase().includes(q) ||
                String(u.department || '').toLowerCase().includes(q) ||
                String(u.outlet || '').toLowerCase().includes(q)
            );
        }

        result = [...result].sort((a, b) => {
            let valA = a[ratingSortField];
            let valB = b[ratingSortField];
            
            if (ratingSortField === 'avgRating') {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return ratingSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return ratingSortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [ratingSubTab, requestorRatingsList, solverRatingsList, ratingSearchQuery, ratingSortField, ratingSortOrder]);

    useEffect(() => {
        loadSystemData();
    }, []);

    const loadSystemData = async () => {
        setLoading(true);
        try {
            const [usersData, locData, deptData, rulesData, ticketsData] = await Promise.all([
                fetchUsers(), fetchLocations(), fetchDepartments(), fetchMasterRules(), fetchTickets()
            ]);
            setUsersList(usersData || []);
            setLocationsList(locData || []);
            setDepartmentsList(deptData || []);
            setRulesList(rulesData || []);

            let safeTickets = ticketsData?.data || ticketsData;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);
            setTicketsList(Array.isArray(safeTickets) ? safeTickets : []);
        } catch (err) {
            setError("Failed to load system data.");
        } finally {
            setLoading(false);
        }
    };

    // Load Ageing Report only when the tab is clicked to save bandwidth
    useEffect(() => {
        if (activeTab === 'ageing' && ageingData.length === 0) {
            const fetchAgeing = async () => {
                try {
                    const res = await api.get('/reports/ageing');
                    setAgeingData(res.data);
                } catch (err) {
                    console.error("Failed to fetch ageing report");
                }
            };
            fetchAgeing();
        }
    }, [activeTab]);

    // =========================================================================
    // HELPER: Format IDs into Name (Phone) dynamically
    // =========================================================================
    const formatSolverDetails = (solverData) => {
        if (!solverData || String(solverData).toLowerCase() === 'nan' || String(solverData).trim() === '') {
            return <span style={{ color: '#ef4444' }}>Unassigned</span>;
        }
        const ids = String(solverData).split(',').map(id => id.trim()).filter(Boolean);
        const formattedNames = ids.map(id => {
            const solver = usersList.find(u => String(u.employee_id) === id || String(u.email) === id);
            return solver ? `${solver.name} (${solver.phone || 'N/A'})` : id;
        });
        return formattedNames.join(', ');
    };

    const getUserDetails = (emailOrId) => {
        const u = usersList.find(u => String(u.employee_id) === String(emailOrId) || String(u.email) === String(emailOrId));
        return u ? `${u.name} (${u.phone || 'N/A'})` : emailOrId;
    };

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

    // --- CSV DOWNLOAD EXPORTER ---
    const handleDownloadCSV = () => {
        if (!ageingData || ageingData.length === 0) return;

        const headers = Object.keys(ageingData[0]);
        const csvRows = [headers.join(',')];

        for (const row of ageingData) {
            const values = headers.map(header => {
                const val = row[header] !== null && row[header] !== undefined ? row[header] : '';
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Ageing_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- USER HANDLERS ---
    const handleUserSubmit = async (e) => {
        e.preventDefault();
        try {
            if (userFormData.phone && String(userFormData.phone).length > 10) {
                alert("Phone number must not exceed 10 digits");
                return;
            }
            if (userFormData.critical_user_rating !== '' && userFormData.critical_user_rating !== null && userFormData.critical_user_rating !== undefined) {
                const ratingNum = Number(userFormData.critical_user_rating);
                if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
                    alert("Critical User Rating must be between 1 and 5");
                    return;
                }
            }
            const payload = {
                ...userFormData,
                critical_user_rating: (userFormData.critical_user_rating !== '' && userFormData.critical_user_rating !== null && userFormData.critical_user_rating !== undefined)
                    ? Number(userFormData.critical_user_rating)
                    : 0
            };
            if (userModalMode === 'add') { await createUser(payload); alert('User created successfully.'); }
            else { await updateUser(payload); alert('User updated successfully.'); }
            setIsUserModalOpen(false); loadSystemData();
        } catch (err) { alert(err.response?.data?.error || "Failed to save user."); }
    };
    const openUserModal = (mode, userData = defaultUser) => { 
        setUserModalMode(mode); 
        setUserFormData({ ...userData, original_employee_id: userData.employee_id }); 
        setIsUserModalOpen(true); 
    };

    const handleToggleUserStatus = async (userObj) => {
        const newStatus = userObj.is_active === false ? true : false;
        try {
            await toggleUserStatus({ employee_id: userObj.employee_id, is_active: newStatus });
            alert(`User ${newStatus ? 'activated' : 'deactivated'} successfully.`);
            loadSystemData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to toggle user status.");
        }
    };

    // --- LOCATION HANDLERS ---
    const handleLocSubmit = async (e) => {
        e.preventDefault();
        try {
            if (locModalMode === 'add') { await createLocation(locFormData); alert('Location added successfully.'); }
            else { await updateLocation(locFormData); alert('Location updated successfully.'); }
            setIsLocModalOpen(false); loadSystemData();
        } catch (err) { alert(err.response?.data?.error || "Failed to save location."); }
    };
    const openLocModal = (mode, locData = defaultLocation) => { setLocModalMode(mode); setLocFormData({ ...locData }); setIsLocModalOpen(true); };

    // --- DEPARTMENT HANDLERS ---
    const handleDeptSubmit = async (e) => {
        e.preventDefault();
        try {
            if (deptModalMode === 'add') {
                await createDepartment(deptFormData);
                alert('Department added successfully.');
            } else {
                await updateDepartment({
                    old_department_name: editDeptName,
                    new_department_name: deptFormData.department_name
                });
                alert('Department renamed successfully.');
            }
            setIsDeptModalOpen(false);
            setDeptFormData({ department_name: '' });
            loadSystemData();
        } catch (err) { alert(err.response?.data?.error || "Failed to save department."); }
    };
    const openDeptModal = (mode, deptName = '') => { 
        setDeptModalMode(mode); 
        setEditDeptName(deptName);
        setDeptFormData({ department_name: deptName }); 
        setIsDeptModalOpen(true); 
    };

    // --- RULE HANDLERS ---
    const handleUpdateRule = async (e) => {
        e.preventDefault();
        try {
            // The backend handles both Add and Edit dynamically through this route
            await updateMasterRule(editRule);
            alert(`Rule ${ruleModalMode === 'add' ? 'created' : 'updated'} successfully.`);
            setIsRuleModalOpen(false);
            loadSystemData();
        }
        catch (err) { alert(err.response?.data?.error || "Failed to save rule."); }
    };
    const openRuleModal = (mode, rule = defaultRule) => { 
        setRuleModalMode(mode); 
        setEditRule({ 
            ...rule,
            original_department: rule.department,
            original_issue_type: rule.issue_type,
            original_outlet: rule.outlet
        }); 
        setIsRuleModalOpen(true); 
    };

    const handleSolverToggle = (empId) => {
        let currentSolvers = editRule.assigned_solver ? String(editRule.assigned_solver).split(',').map(s => s.trim()).filter(Boolean) : [];
        if (currentSolvers.includes(empId)) currentSolvers = currentSolvers.filter(id => id !== empId);
        else currentSolvers.push(empId);
        setEditRule({ ...editRule, assigned_solver: currentSolvers.join(',') });
    };

    // --- BULK IMPORT LOGIC ---
    const handleFileUpload = async (e) => {
        e.preventDefault();
        setImportError('');
        setImportSuccess('');
        if (!importFile) {
            setImportError('Please select a file to upload.');
            return;
        }
        setIsUploading(true);
        try {
            const result = await uploadImportFile(activeImportTab, importFile);
            setImportSuccess(result.message);
            setImportFile(null);
            loadSystemData(); // Refresh the tables!
        } catch (err) {
            setImportError(err.response?.data?.error || 'Failed to upload file.');
        } finally {
            setIsUploading(false);
        }
    };

    // --- FILTER LOGIC ---
    const filteredUsers = usersList.filter(u => {
        const q = userSearchQuery.toLowerCase();
        const matchSearch = (
            u.name?.toLowerCase().includes(q) || 
            u.email?.toLowerCase().includes(q) || 
            String(u.employee_id).toLowerCase().includes(q) || 
            u.department?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q) ||
            String(u.manager).toLowerCase().includes(q) ||
            String(u.outlet).toLowerCase().includes(q) ||
            String(u.phone).toLowerCase().includes(q)
        );
        const matchRole = activeUserFilters.includes('role') && userFilters.role ? u.role === userFilters.role : true;
        const matchDept = activeUserFilters.includes('department') && userFilters.department ? u.department === userFilters.department : true;
        const matchName = activeUserFilters.includes('name') && userFilters.name ? u.name?.toLowerCase().includes(userFilters.name.toLowerCase()) : true;
        const matchEmpId = activeUserFilters.includes('emp_id') && userFilters.emp_id ? String(u.employee_id).toLowerCase().includes(userFilters.emp_id.toLowerCase()) : true;
        const matchLoc = activeUserFilters.includes('location') && userFilters.location ? String(u.outlet).toLowerCase().includes(userFilters.location.toLowerCase()) : true;
        return matchSearch && matchRole && matchDept && matchName && matchEmpId && matchLoc;
    });

    const filteredLocations = locationsList.filter(l => {
        const q = locSearchQuery.toLowerCase();
        const matchSearch = (
            l.outlet?.toLowerCase().includes(q) || 
            l.brand?.toLowerCase().includes(q) || 
            l.location?.toLowerCase().includes(q) ||
            l.city?.toLowerCase().includes(q)
        );
        const matchBrand = activeLocFilters.includes('brand') && locFilters.brand ? l.brand === locFilters.brand : true;
        const matchCity = activeLocFilters.includes('city') && locFilters.city ? l.city === locFilters.city : true;
        const matchLocation = activeLocFilters.includes('location') && locFilters.location ? l.location?.toLowerCase().includes(locFilters.location.toLowerCase()) : true;
        const matchCode = activeLocFilters.includes('code') && locFilters.code ? l.outlet?.toLowerCase().includes(locFilters.code.toLowerCase()) : true;
        return matchSearch && matchBrand && matchCity && matchLocation && matchCode;
    });

    const filteredDepartments = departmentsList.filter(d => {
        const q = deptSearchQuery.toLowerCase();
        return (d.department_name?.toLowerCase().includes(q));
    });

    const filteredRules = rulesList.filter(r => {
        const q = ruleSearchQuery.toLowerCase();
        const matchSearch = (
            r.department?.toLowerCase().includes(q) || 
            r.issue_type?.toLowerCase().includes(q) || 
            String(r.outlet).toLowerCase().includes(q) ||
            String(r.assigned_solver).toLowerCase().includes(q)
        );
        const matchDept = activeRuleFilters.includes('department') && ruleFilters.department ? r.department === ruleFilters.department : true;
        const matchIssue = activeRuleFilters.includes('issue_type') && ruleFilters.issue_type ? r.issue_type === ruleFilters.issue_type : true;
        const matchSolver = activeRuleFilters.includes('assigned_solver') && ruleFilters.assigned_solver ? String(r.assigned_solver).toLowerCase().includes(ruleFilters.assigned_solver.toLowerCase()) : true;
        const matchLoc = activeRuleFilters.includes('location') && ruleFilters.location ? String(r.outlet).toLowerCase().includes(ruleFilters.location.toLowerCase()) : true;
        return matchSearch && matchDept && matchIssue && matchSolver && matchLoc;
    });
    // filteredAgeing is managed by TicketFilterBar

    const getManagerDisplay = (managerId) => {
        if (!managerId || String(managerId).trim() === '' || String(managerId).toLowerCase() === 'nan' || managerId === '-') return '-';
        const mgr = usersList.find(u => String(u.employee_id) === String(managerId));
        return mgr ? `${mgr.name} (${mgr.employee_id})` : '-';
    };

    const handleDeleteUser = async (emp_id) => {
        if(!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await deleteUser({ employee_id: emp_id });
            setUsersList(usersList.filter(u => u.employee_id !== emp_id).map(u => {
                if (String(u.manager) === String(emp_id)) {
                    return { ...u, manager: '-' };
                }
                return u;
            }));
        } catch (e) {
            alert('Failed to delete user');
        }
    };

    const handleResetPassword = async (emp_id) => {
        if(!window.confirm('Reset this user\'s password to Kolkata@123?')) return;
        try {
            await adminResetPassword({ employee_id: emp_id });
            alert('Password reset successfully.');
        } catch (e) {
            alert('Failed to reset password');
        }
    };

    const handleDeleteLocation = async (outlet) => {
        if(!window.confirm('Are you sure you want to delete this location?')) return;
        try {
            await deleteLocation({ outlet });
            setLocationsList(locationsList.filter(l => l.outlet !== outlet));
        } catch (e) {
            alert('Failed to delete location');
        }
    };

    const handleDeleteDepartment = async (dept_name) => {
        if(!window.confirm('Are you sure you want to delete this department?')) return;
        try {
            await deleteDepartment({ department_name: dept_name });
            setDepartmentsList(departmentsList.filter(d => d.department_name !== dept_name));
        } catch (e) {
            alert('Failed to delete department');
        }
    };

    const handleDeleteRule = async (dept, issue) => {
        if(!window.confirm('Are you sure you want to delete this rule?')) return;
        try {
            await deleteMasterRule({ department: dept, issue_type: issue });
            setRulesList(rulesList.filter(r => !(r.department === dept && r.issue_type === issue)));
        } catch (e) {
            alert('Failed to delete rule');
        }
    };

    const sidebarTabs = [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> },
        { id: 'ratings', label: <><Star size={12} /> Rating Report</> },
        ...(user?.role !== 'Audit' ? [
            { id: 'masters', label: <><Settings size={12} /> Master Creations</> },
            { id: 'import', label: <><FileUp size={12} /> Import Data</> }
        ] : [])
    ];

    // =========================================================================
    // GLOBAL KPI ENGINE (PINNED TO TOP OF ALL TABS)
    // =========================================================================
    const isLate = (ticket) => {
        if (!ticket.deadline || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        try {
            const [datePart, timePart] = ticket.deadline.split(' ');
            const [day, month, year] = datePart.split('-');
            const [hour, minute] = timePart ? timePart.split(':') : [0, 0];
            return new Date(year, month - 1, day, hour, minute) < new Date();
        } catch (err) { return false; }
    };

    const globalKPI = useMemo(() => {
        const counts = {
            total: ticketsList.length,
            open: 0,
            inProgress: 0,
            resolved: 0,
            closed: 0,
            declined: 0,
            late: 0
        };

        ticketsList.forEach(t => {
            const stat = t.status ? t.status.toLowerCase() : '';
            if (stat === 'open') counts.open++;
            else if (stat === 'in progress') counts.inProgress++;
            else if (stat === 'resolved') counts.resolved++;
            else if (stat === 'closed') {
                if (t.closure_type === 'Declined') counts.declined++;
                else counts.closed++;
            }
            if (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) counts.late++;
        });

        return counts;
    }, [ticketsList]);

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setSelectedTicket(null); setIsPanelExpanded(false); }}>
            {/* WRAPPER FOR MAIN CONTENT TO SHRINK WHEN SIDE PANEL OPENS */}
            <div style={{ paddingRight: selectedTicket ? (isPanelExpanded ? '0' : '434px') : '0', transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <div style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '19px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings size={22} color="#3b82f6" /> System Administration
                    </h2>
                </div>
                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '3px', marginBottom: '12px', fontSize: '10px' }}>{error}</div>}

                {/* --- GLOBAL KPI METRICS BOARD (ALWAYS VISIBLE) --- */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    <div className="card kpi-card kpi-blue" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.total}</h2>
                    </div>
                    <div className="card kpi-card kpi-amber" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Open</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.open}</h2>
                    </div>
                    <div className="card kpi-card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>In Progress</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.inProgress}</h2>
                    </div>
                    <div className="card kpi-card kpi-teal" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Resolved</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.resolved}</h2>
                    </div>
                    <div className="card kpi-card kpi-green" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Closed</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.closed}</h2>
                    </div>
                    <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #6b7280', background: 'linear-gradient(180deg, rgba(107,114,128,0.25) 0%, rgba(107,114,128,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Declined</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.declined}</h2>
                    </div>
                    <div className="card kpi-card kpi-sla kpi-orange" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #F7941D', background: 'linear-gradient(180deg, rgba(247,148,29,0.25) 0%, rgba(247,148,29,0) 100%)' }}>
                        <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>SLA Breach</p>
                        <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.late}</h2>
                    </div>
                </div>

                {/* TAB CONTENT VIEWS */}
                {activeTab === 'analytics' && !loading && <AdminAnalytics tickets={ticketsList} usersList={usersList} />}

                {activeTab === 'ageing' && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="card" style={{ padding: '16px', zIndex: 10 }}>
                            <TicketFilterBar 
                                tickets={ageingData} 
                                onFilter={setFilteredAgeing} 
                                usersList={usersList} 
                                rightActions={
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {user?.role === 'Super Admin' && (
                                            <button className="btn btn-danger" onClick={() => {
                                                const id = prompt("Enter the Ticket ID you wish to completely delete:");
                                                if (id) {
                                                    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete Ticket #${id}? This will also delete all associated chat logs and notifications everywhere. This action cannot be undone.`)) {
                                                        fetch('/api/admin/tickets/delete', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ ticket_id: id.replace('#', '').trim() })
                                                        })
                                                        .then(res => res.json())
                                                        .then(data => {
                                                            if (data.error) alert(data.error);
                                                            else {
                                                                alert(data.message);
                                                                loadSystemData();
                                                            }
                                                        })
                                                        .catch(err => alert("Error deleting ticket."));
                                                    }
                                                }
                                            }} style={{ padding: '8px 16px', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                                                <Trash2 size={14} /> Delete Ticket
                                            </button>
                                        )}
                                        <button className="btn btn-success" onClick={handleDownloadCSV} style={{ padding: '8px 16px', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                                            <Download size={14} /> Download CSV
                                        </button>
                                    </div>
                                }
                            />
                        </div>

                        <div className="card">
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>⏳ Full Ticket Ageing Analytics</h3>
                            <div style={{ maxHeight: '480px', overflowY: 'auto', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                                    <tr>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>ID</th>
                                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Image</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Dept</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Location</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Status</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Assigned To</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Date Raised</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Deadline</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Total Age (Hrs)</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Res. Time (Hrs)</th>
                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Total Score</th>
                                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>SLA Breach</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAgeing.length === 0 ? (
                                        <tr><td colSpan="12" style={{ textAlign: 'center', padding: '16px', color: '#71717a' }}>No records found.</td></tr>
                                    ) : (
                                        filteredAgeing.map(a => (
                                            <tr key={a.ticket_id} onClick={() => handleTicketClick(a)} style={{ borderBottom: '1px solid #27272a', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#18181b'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <td style={{ padding: '8px', fontWeight: 'bold', border: '1px solid #27272a' }}>#{a.ticket_id}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #27272a' }}>
                                                    {a.attachment && String(a.attachment).toLowerCase() !== 'nan' ? (
                                                        <img src={String(a.attachment).startsWith('data:') ? String(a.attachment) : `/uploads/${a.attachment}`} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3f3f46' }} alt="Attachment" />
                                                    ) : <span style={{ color: '#52525b' }}>-</span>}
                                                </td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}>{a.dept_assigned}</td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}>{a.location || 'N/A'}</td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}>{a.status}</td>
                                                <td style={{ padding: '8px', color: '#60a5fa', border: '1px solid #27272a' }}>{formatSolverDetails(a.assigned_to)}</td>
                                                <td style={{ padding: '8px', color: '#a1a1aa', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{a.timestamp}</td>
                                                <td style={{ padding: '8px', color: '#10b981', border: '1px solid #27272a', whiteSpace: 'nowrap' }}>{a.deadline || 'N/A'}</td>
                                                <td style={{ padding: '8px', fontWeight: 'bold', border: '1px solid #27272a' }}>{a.ticket_age_hours || '-'}</td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a' }}>{a.solver_resolution_hours || '-'}</td>
                                                <td style={{ padding: '8px', border: '1px solid #27272a', fontWeight: 'bold' }}>{a.total_score}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #27272a' }}>
                                                    {a.SLA_Breach ? <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AlertTriangle size={10} /> Breached</span> : <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={10} /> Safe</span>}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </div>
                )}

                {/* --- RATING REPORT TAB --- */}
                {activeTab === 'ratings' && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        className="btn" 
                                        onClick={() => setRatingSubTab('requestor')} 
                                        style={{ 
                                            backgroundColor: ratingSubTab === 'requestor' ? '#3b82f6' : '#27272a', 
                                            border: 'none', 
                                            fontSize: '11px', 
                                            padding: '6px 14px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                        <User size={13} /> Requestors ({requestorRatingsList.length})
                                    </button>
                                    <button 
                                        className="btn" 
                                        onClick={() => setRatingSubTab('solver')} 
                                        style={{ 
                                            backgroundColor: ratingSubTab === 'solver' ? '#3b82f6' : '#27272a', 
                                            border: 'none', 
                                            fontSize: '11px', 
                                            padding: '6px 14px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                        <ShieldCheck size={13} /> Solvers ({solverRatingsList.length})
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder={`Search ${ratingSubTab === 'requestor' ? 'requestors' : 'solvers'}...`} 
                                            value={ratingSearchQuery} 
                                            onChange={(e) => setRatingSearchQuery(e.target.value)} 
                                            style={{ padding: '6px 10px 6px 30px', fontSize: '10px', width: '220px', margin: 0 }} 
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '10px', color: '#a1a1aa' }}>Sort By:</span>
                                        <select className="form-control" value={ratingSortField} onChange={e => setRatingSortField(e.target.value)} style={{ fontSize: '10px', padding: '6px', width: '120px' }}>
                                            <option value="employee_id">Emp ID</option>
                                            <option value="name">Name</option>
                                            <option value="email">Email</option>
                                            <option value="department">Department</option>
                                            <option value="outlet">Outlet</option>
                                            <option value="avgRating">Average Rating</option>
                                        </select>
                                        <select className="form-control" value={ratingSortOrder} onChange={e => setRatingSortOrder(e.target.value)} style={{ fontSize: '10px', padding: '6px', width: '70px' }}>
                                            <option value="desc">Desc</option>
                                            <option value="asc">Asc</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="master-table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #27272a' }}>Emp ID</th>
                                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #27272a' }}>Name</th>
                                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #27272a' }}>Email</th>
                                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #27272a' }}>Department</th>
                                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #27272a' }}>Outlet</th>
                                            <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>Ratings Received</th>
                                            <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>Average Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRatingList.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#71717a' }}>No users found for this rating report.</td>
                                            </tr>
                                        ) : (
                                            filteredRatingList.map(u => (
                                                <tr key={u.email} style={{ borderBottom: '1px solid #27272a' }}>
                                                    <td style={{ padding: '10px', border: '1px solid #27272a', fontFamily: 'monospace' }}>{u.employee_id || 'N/A'}</td>
                                                    <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #27272a' }}>{u.name}</td>
                                                    <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{u.email}</td>
                                                    <td style={{ padding: '10px', border: '1px solid #27272a' }}>{u.department || 'N/A'}</td>
                                                    <td style={{ padding: '10px', border: '1px solid #27272a' }}>{u.outlet || 'N/A'}</td>
                                                    <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a' }}>
                                                        <span style={{ backgroundColor: '#27272a', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {u.ratedCount} / {u.totalTickets} tickets
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #27272a', fontWeight: 'bold', color: u.avgRating ? '#f59e0b' : '#71717a' }}>
                                                        {u.avgRating ? `${u.avgRating} ⭐` : 'Unrated'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- IMPORT DATA TAB --- */}
                {activeTab === 'import' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Bulk Data Import</h3>
                            <p style={{ margin: 0, fontSize: '11px', color: '#a1a1aa' }}>Download the required templates, populate your data, and upload the Excel (.xlsx) files below.</p>
                        </div>

                        {/* Import Tabs Sub-Navigation */}
                        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>
                            <button className="btn" style={{ backgroundColor: activeImportTab === 'users' ? '#3b82f6' : 'transparent', border: activeImportTab === 'users' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => { setActiveImportTab('users'); setImportError(''); setImportSuccess(''); setImportFile(null); }}>User Directory</button>
                            <button className="btn" style={{ backgroundColor: activeImportTab === 'locations' ? '#3b82f6' : 'transparent', border: activeImportTab === 'locations' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => { setActiveImportTab('locations'); setImportError(''); setImportSuccess(''); setImportFile(null); }}>Locations</button>
                            <button className="btn" style={{ backgroundColor: activeImportTab === 'rules' ? '#3b82f6' : 'transparent', border: activeImportTab === 'rules' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => { setActiveImportTab('rules'); setImportError(''); setImportSuccess(''); setImportFile(null); }}>Master Logic Rules</button>
                        </div>

                        <div className="card" style={{ maxWidth: '600px', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', textTransform: 'capitalize' }}>Import {activeImportTab}</h4>
                                    <p style={{ margin: 0, fontSize: '10px', color: '#71717a' }}>Ensure your Excel file follows the exact template structure.</p>
                                </div>
                                <a 
                                    href={getImportTemplateUrl(activeImportTab)} 
                                    className="btn" 
                                    style={{ backgroundColor: '#3b82f6', border: 'none', fontSize: '12px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                                >
                                    <Download size={14} /> Download Template
                                </a>
                            </div>

                            {importSuccess && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> {importSuccess}</div>}
                            {importError && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> {importError}</div>}

                            <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ border: '2px dashed #3f3f46', borderRadius: '8px', padding: '32px', textAlign: 'center', backgroundColor: '#18181b', transition: 'all 0.2s' }}>
                                    <input 
                                        type="file" 
                                        accept=".xlsx" 
                                        id="importFileInput" 
                                        style={{ display: 'none' }} 
                                        onChange={(e) => setImportFile(e.target.files[0])}
                                    />
                                    <label htmlFor="importFileInput" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ backgroundColor: '#27272a', padding: '12px', borderRadius: '50%' }}>
                                            <Upload size={24} color="#3b82f6" />
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 'bold' }}>Click to select a file</span>
                                            <span style={{ fontSize: '12px', color: '#a1a1aa' }}> or drag and drop</span>
                                            <div style={{ fontSize: '10px', color: '#71717a', marginTop: '4px' }}>.xlsx files only</div>
                                        </div>
                                        {importFile && (
                                            <div style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#064e3b', color: '#34d399', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <FileText size={12} /> {importFile.name}
                                            </div>
                                        )}
                                    </label>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" disabled={isUploading || !importFile} className="btn" style={{ backgroundColor: isUploading || !importFile ? '#27272a' : '#3b82f6', color: isUploading || !importFile ? '#71717a' : '#fff', padding: '10px 24px', fontSize: '12px', fontWeight: 'bold' }}>
                                        {isUploading ? 'Importing...' : 'Upload & Import'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MASTERS TAB GROUP */}
                {activeTab === 'masters' && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Sub-Navigation */}
                        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>
                            <button className="btn" style={{ backgroundColor: activeMasterTab === 'users' ? '#3b82f6' : 'transparent', border: activeMasterTab === 'users' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => setActiveMasterTab('users')}>User Directory</button>
                            <button className="btn" style={{ backgroundColor: activeMasterTab === 'locations' ? '#3b82f6' : 'transparent', border: activeMasterTab === 'locations' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => setActiveMasterTab('locations')}>Locations & Outlets</button>
                            <button className="btn" style={{ backgroundColor: activeMasterTab === 'departments' ? '#3b82f6' : 'transparent', border: activeMasterTab === 'departments' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => setActiveMasterTab('departments')}>Departments</button>
                            <button className="btn" style={{ backgroundColor: activeMasterTab === 'rules' ? '#3b82f6' : 'transparent', border: activeMasterTab === 'rules' ? 'none' : '1px solid #3f3f46', fontSize: '12px', padding: '6px 16px' }} onClick={() => setActiveMasterTab('rules')}>Master Logic Rules</button>
                        </div>
                        
                        {/* USERS TAB */}
                        {activeMasterTab === 'users' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                            <h3 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>Global User Directory</h3>
                            <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                                    <input type="text" className="form-control" placeholder="Search users..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} style={{ padding: '6px 10px 6px 30px', fontSize: '10px', maxWidth: '240px', margin: 0 }} />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <button className="btn" onClick={() => setShowUserFilterDropdown(!showUserFilterDropdown)} style={{ backgroundColor: showUserFilterDropdown || activeUserFilters.length > 0 ? '#3b82f6' : '#27272a', padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><Filter size={12} /> Filters</button>
                                    {showUserFilterDropdown && (
                                        <div className="filter-dropdown-menu">
                                            {['role', 'department', 'name', 'emp_id', 'location'].map(f => (
                                                <label key={f} className="filter-dropdown-label">
                                                    <input type="checkbox" checked={activeUserFilters.includes(f)} onChange={(e) => {
                                                        if (e.target.checked) setActiveUserFilters([...activeUserFilters, f]);
                                                        else {
                                                            setActiveUserFilters(activeUserFilters.filter(x => x !== f));
                                                            setUserFilters({...userFilters, [f]: ''});
                                                        }
                                                    }} />
                                                    {f.replace('_', ' ').toUpperCase()}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {user?.role !== 'Audit' && (
                                    <div className="action-btn-group" style={{ display: 'flex', gap: '5px' }}>
                                        <button className="btn" onClick={() => openUserModal('add')} style={{ backgroundColor: '#10b981', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap' }}>+ Add Employee</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {activeUserFilters.length > 0 && (
                            <div className="active-filters-bar">
                                {activeUserFilters.includes('role') && (
                                    <select value={userFilters.role} onChange={(e) => setUserFilters({...userFilters, role: e.target.value})} className="active-filters-input">
                                        <option value="">All Roles</option>
                                        {[...new Set(usersList.map(u => u.role).filter(Boolean))].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                )}
                                {activeUserFilters.includes('department') && (
                                    <select value={userFilters.department} onChange={(e) => setUserFilters({...userFilters, department: e.target.value})} className="active-filters-input">
                                        <option value="">All Departments</option>
                                        {[...new Set(usersList.map(u => u.department).filter(Boolean))].map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                )}
                                {activeUserFilters.includes('name') && (
                                    <input type="text" placeholder="Filter by Name..." value={userFilters.name} onChange={(e) => setUserFilters({...userFilters, name: e.target.value})} className="active-filters-input" />
                                )}
                                {activeUserFilters.includes('emp_id') && (
                                    <input type="text" placeholder="Filter by Emp ID..." value={userFilters.emp_id} onChange={(e) => setUserFilters({...userFilters, emp_id: e.target.value})} className="active-filters-input" />
                                )}
                                {activeUserFilters.includes('location') && (
                                    <input type="text" placeholder="Filter by Location/Outlet..." value={userFilters.location} onChange={(e) => setUserFilters({...userFilters, location: e.target.value})} className="active-filters-input" />
                                )}
                                <button onClick={() => {setActiveUserFilters([]); setUserFilters(defaultUserFilters); setShowUserFilterDropdown(false);}} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}><X size={10} /> Clear All Filters</button>
                            </div>
                        )}
                        <div className="master-table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Emp ID</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Name</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Email</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Role</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Dept</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Outlet</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Manager</th>
                                        {user?.role !== 'Audit' && <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.email} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer', backgroundColor: selectedUserRow?.employee_id === u.employee_id ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }} onMouseOver={(e) => { if (selectedUserRow?.employee_id !== u.employee_id) e.currentTarget.style.backgroundColor = '#18181b'; }} onMouseOut={(e) => { if (selectedUserRow?.employee_id !== u.employee_id) e.currentTarget.style.backgroundColor = 'transparent'; }} onClick={() => setSelectedUserRow(prev => prev?.employee_id === u.employee_id ? null : u)}>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{u.employee_id}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #27272a' }}>{u.name}</td>
                                            <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{u.email}</td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}><span style={{ backgroundColor: u.role === 'Admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: u.role === 'Admin' ? '#ef4444' : '#60a5fa', padding: '2px 5px', borderRadius: '3px', fontSize: '10px' }}>{u.role}</span></td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{u.department}</td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{u.outlet}</td>
                                            <td style={{ padding: '10px', color: '#10b981', fontSize: '10px', border: '1px solid #27272a' }}>{getManagerDisplay(u.manager)}</td>
                                            {user?.role !== 'Audit' && (
                                                <td style={{ padding: '10px', border: '1px solid #27272a', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button title="Edit User" style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); openUserModal('edit', u); }}>
                                                            <Pen size={14} />
                                                        </button>
                                                        {(user?.role === 'Admin' || user?.role === 'Super Admin') && (
                                                            <button title="Reset Password" style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); handleResetPassword(u.employee_id); }}>
                                                                <Key size={14} />
                                                            </button>
                                                        )}
                                                        {user?.role === 'Super Admin' && (
                                                            <button title="Delete User" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.employee_id); }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                        {(user?.role === 'Admin' || user?.role === 'Super Admin') && (
                                                            <button 
                                                                title={u.is_active !== false ? "Click to Deactivate" : "Click to Activate"} 
                                                                style={{ 
                                                                    backgroundColor: u.is_active !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                                                                    color: u.is_active !== false ? '#10b981' : '#ef4444', 
                                                                    border: `1px solid ${u.is_active !== false ? '#10b981' : '#ef4444'}`,
                                                                    borderRadius: '12px',
                                                                    padding: '2px 8px',
                                                                    fontSize: '10px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }} 
                                                                onClick={(e) => { e.stopPropagation(); handleToggleUserStatus(u); }}
                                                            >
                                                                <Power size={10} />
                                                                {u.is_active !== false ? 'Active' : 'Inactive'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* LOCATIONS TAB */}
                {activeMasterTab === 'locations' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                            <h3 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>Locations & Outlets</h3>
                            <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                                    <input type="text" className="form-control" placeholder="Search locations..." value={locSearchQuery} onChange={(e) => setLocSearchQuery(e.target.value)} style={{ padding: '6px 10px 6px 30px', fontSize: '10px', maxWidth: '240px', margin: 0 }} />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <button className="btn" onClick={() => setShowLocFilterDropdown(!showLocFilterDropdown)} style={{ backgroundColor: showLocFilterDropdown || activeLocFilters.length > 0 ? '#3b82f6' : '#27272a', padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><Filter size={12} /> Filters</button>
                                    {showLocFilterDropdown && (
                                        <div className="filter-dropdown-menu">
                                            {['brand', 'city', 'location', 'code'].map(f => (
                                                <label key={f} className="filter-dropdown-label">
                                                    <input type="checkbox" checked={activeLocFilters.includes(f)} onChange={(e) => {
                                                        if (e.target.checked) setActiveLocFilters([...activeLocFilters, f]);
                                                        else {
                                                            setActiveLocFilters(activeLocFilters.filter(x => x !== f));
                                                            setLocFilters({...locFilters, [f]: ''});
                                                        }
                                                    }} />
                                                    {f.replace('_', ' ').toUpperCase()}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {user?.role !== 'Audit' && (
                                    <div className="action-btn-group" style={{ display: 'flex', gap: '5px' }}>
                                        <button className="btn" onClick={() => openLocModal('add')} style={{ backgroundColor: '#10b981', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap' }}>+ Add Outlet</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {activeLocFilters.length > 0 && (
                            <div className="active-filters-bar">
                                {activeLocFilters.includes('brand') && (
                                    <select value={locFilters.brand} onChange={(e) => setLocFilters({...locFilters, brand: e.target.value})} className="active-filters-input">
                                        <option value="">All Brands</option>
                                        {[...new Set(locationsList.map(l => l.brand).filter(Boolean))].map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                )}
                                {activeLocFilters.includes('city') && (
                                    <select value={locFilters.city} onChange={(e) => setLocFilters({...locFilters, city: e.target.value})} className="active-filters-input">
                                        <option value="">All Cities</option>
                                        {[...new Set(locationsList.map(l => l.city).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                )}
                                {activeLocFilters.includes('location') && (
                                    <input type="text" placeholder="Filter by Location..." value={locFilters.location} onChange={(e) => setLocFilters({...locFilters, location: e.target.value})} className="active-filters-input" />
                                )}
                                {activeLocFilters.includes('code') && (
                                    <input type="text" placeholder="Filter by Code..." value={locFilters.code} onChange={(e) => setLocFilters({...locFilters, code: e.target.value})} className="active-filters-input" />
                                )}
                                <button onClick={() => {setActiveLocFilters([]); setLocFilters(defaultLocFilters); setShowLocFilterDropdown(false);}} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}><X size={10} /> Clear All Filters</button>
                            </div>
                        )}
                        <div className="master-table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Code</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Brand</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Location</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>City</th>
                                        {user?.role !== 'Audit' && <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLocations.map(loc => (
                                        <tr key={loc.outlet} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer', backgroundColor: selectedLocRow?.outlet === loc.outlet ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }} onMouseOver={(e) => { if (selectedLocRow?.outlet !== loc.outlet) e.currentTarget.style.backgroundColor = '#18181b'; }} onMouseOut={(e) => { if (selectedLocRow?.outlet !== loc.outlet) e.currentTarget.style.backgroundColor = 'transparent'; }} onClick={() => setSelectedLocRow(prev => prev?.outlet === loc.outlet ? null : loc)}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#60a5fa', border: '1px solid #27272a' }}>{loc.outlet}</td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{loc.brand}</td>
                                            <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{loc.location}</td>
                                            <td style={{ padding: '10px', color: '#71717a', border: '1px solid #27272a' }}>{loc.city}</td>
                                            {user?.role !== 'Audit' && (
                                                <td style={{ padding: '10px', border: '1px solid #27272a', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button title="Edit Outlet" style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); openLocModal('edit', loc); }}>
                                                            <Pen size={14} />
                                                        </button>
                                                        {user?.role === 'Super Admin' && (
                                                            <button title="Delete Outlet" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); handleDeleteLocation(loc.outlet); }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* DEPARTMENTS TAB */}
                {activeMasterTab === 'departments' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                            <h3 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>Departments Master</h3>
                            <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                                    <input type="text" className="form-control" placeholder="Search departments..." value={deptSearchQuery} onChange={(e) => setDeptSearchQuery(e.target.value)} style={{ padding: '6px 10px 6px 30px', fontSize: '10px', maxWidth: '240px', margin: 0 }} />
                                </div>
                                <div className="action-btn-group" style={{ display: 'flex', gap: '5px' }}>
                                    <button className="btn" onClick={() => openDeptModal('add')} style={{ backgroundColor: '#10b981', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap' }}>+ Add Department</button>
                                </div>
                            </div>
                        </div>
                        <div className="master-table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Department Name</th>
                                        {user?.role !== 'Audit' && <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDepartments.map(d => (
                                        <tr key={d.department_name} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer', backgroundColor: selectedDeptRow?.department_name === d.department_name ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }} onMouseOver={(e) => { if (selectedDeptRow?.department_name !== d.department_name) e.currentTarget.style.backgroundColor = '#18181b'; }} onMouseOut={(e) => { if (selectedDeptRow?.department_name !== d.department_name) e.currentTarget.style.backgroundColor = 'transparent'; }} onClick={() => setSelectedDeptRow(prev => prev?.department_name === d.department_name ? null : d)}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #27272a' }}>{d.department_name}</td>
                                            {user?.role !== 'Audit' && (
                                                <td style={{ padding: '10px', border: '1px solid #27272a', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button title="Edit Department" style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); openDeptModal('edit', d.department_name); }}>
                                                            <Pen size={14} />
                                                        </button>
                                                        {user?.role === 'Super Admin' && (
                                                            <button title="Delete Department" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(d.department_name); }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* MASTER RULES TAB */}
                {activeMasterTab === 'rules' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                            <h3 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>Master Assignment Logic</h3>
                            <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
                                    <input type="text" className="form-control" placeholder="Search rules (Dept, Issue, Location)..." value={ruleSearchQuery} onChange={(e) => setRuleSearchQuery(e.target.value)} style={{ padding: '6px 10px 6px 30px', fontSize: '10px', maxWidth: '240px', margin: 0 }} />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <button className="btn" onClick={() => setShowRuleFilterDropdown(!showRuleFilterDropdown)} style={{ backgroundColor: showRuleFilterDropdown || activeRuleFilters.length > 0 ? '#3b82f6' : '#27272a', padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}><Filter size={12} /> Filters</button>
                                    {showRuleFilterDropdown && (
                                        <div className="filter-dropdown-menu">
                                            {['department', 'issue_type', 'assigned_solver', 'location'].map(f => (
                                                <label key={f} className="filter-dropdown-label">
                                                    <input type="checkbox" checked={activeRuleFilters.includes(f)} onChange={(e) => {
                                                        if (e.target.checked) setActiveRuleFilters([...activeRuleFilters, f]);
                                                        else {
                                                            setActiveRuleFilters(activeRuleFilters.filter(x => x !== f));
                                                            setRuleFilters({...ruleFilters, [f]: ''});
                                                        }
                                                    }} />
                                                    {f.replace('_', ' ').toUpperCase()}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {user?.role !== 'Audit' && (
                                    <div className="action-btn-group" style={{ display: 'flex', gap: '5px' }}>
                                        <button className="btn" onClick={() => openRuleModal('add')} style={{ backgroundColor: '#10b981', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap' }}>+ Add New Rule</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {activeRuleFilters.length > 0 && (
                            <div className="active-filters-bar">
                                {activeRuleFilters.includes('department') && (
                                    <select value={ruleFilters.department} onChange={(e) => setRuleFilters({...ruleFilters, department: e.target.value})} className="active-filters-input">
                                        <option value="">All Departments</option>
                                        {[...new Set(rulesList.map(r => r.department).filter(Boolean))].map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                )}
                                {activeRuleFilters.includes('issue_type') && (
                                    <select value={ruleFilters.issue_type} onChange={(e) => setRuleFilters({...ruleFilters, issue_type: e.target.value})} className="active-filters-input">
                                        <option value="">All Issues</option>
                                        {[...new Set(rulesList.map(r => r.issue_type).filter(Boolean))].map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                )}
                                {activeRuleFilters.includes('assigned_solver') && (
                                    <input type="text" placeholder="Filter by Solver..." value={ruleFilters.assigned_solver} onChange={(e) => setRuleFilters({...ruleFilters, assigned_solver: e.target.value})} className="active-filters-input" />
                                )}
                                {activeRuleFilters.includes('location') && (
                                    <input type="text" placeholder="Filter by Location..." value={ruleFilters.location} onChange={(e) => setRuleFilters({...ruleFilters, location: e.target.value})} className="active-filters-input" />
                                )}
                                <button onClick={() => {setActiveRuleFilters([]); setRuleFilters(defaultRuleFilters); setShowRuleFilterDropdown(false);}} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}><X size={10} /> Clear All Filters</button>
                            </div>
                        )}
                        <div className="master-table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#18181b' }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Dept</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Issue Type</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Location</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Priority</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Deadline</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Assigned Solver(s)</th>
                                        {user?.role !== 'Audit' && <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #27272a', border: '1px solid #27272a' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRules.map((r, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer', backgroundColor: (selectedRuleRow?.department === r.department && selectedRuleRow?.issue_type === r.issue_type) ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }} onMouseOver={(e) => { if (!(selectedRuleRow?.department === r.department && selectedRuleRow?.issue_type === r.issue_type)) e.currentTarget.style.backgroundColor = '#18181b'; }} onMouseOut={(e) => { if (!(selectedRuleRow?.department === r.department && selectedRuleRow?.issue_type === r.issue_type)) e.currentTarget.style.backgroundColor = 'transparent'; }} onClick={() => setSelectedRuleRow(prev => (prev?.department === r.department && prev?.issue_type === r.issue_type) ? null : r)}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #27272a' }}>{r.department}</td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{r.issue_type}</td>
                                            <td style={{ padding: '10px', color: '#a1a1aa', border: '1px solid #27272a' }}>{r.outlet && String(r.outlet).toLowerCase() !== 'nan' && !String(r.outlet).toLowerCase().includes('global') ? r.outlet : 'Unassigned'}</td>
                                            <td style={{ padding: '10px', border: '1px solid #27272a' }}>{r.base_priority}</td>
                                            <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold', border: '1px solid #27272a' }}>{r.deadline_hours || 24} Hrs</td>
                                            <td style={{ padding: '10px', color: '#60a5fa', border: '1px solid #27272a' }}>{formatSolverDetails(r.assigned_solver)}</td>
                                            {user?.role !== 'Audit' && (
                                                <td style={{ padding: '10px', border: '1px solid #27272a', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button title="Edit Rule" style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); openRuleModal('edit', r); }}>
                                                            <Pen size={14} />
                                                        </button>
                                                        {user?.role === 'Super Admin' && (
                                                            <button title="Delete Rule" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} onClick={(e) => { e.stopPropagation(); handleDeleteRule(r.department, r.issue_type); }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </div>
                )}

                {/* DATALISTS FOR NATIVE SEARCHABLE DROPDOWNS */}
                <datalist id="manager-options">
                    {usersList.map(u => <option key={u.employee_id} value={u.employee_id}>{u.name} ({u.employee_id})</option>)}
                </datalist>
                <datalist id="outlet-options">
                    {locationsList.map(l => <option key={l.outlet} value={l.outlet}>{l.outlet}</option>)}
                </datalist>
                <datalist id="department-options">
                    {departmentsList.map(d => <option key={d.department_name} value={d.department_name} />)}
                </datalist>

                {/* MODALS */}
                {(isUserModalOpen || isLocModalOpen || isDeptModalOpen || isRuleModalOpen) && (
                    <div className="glass-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                        {/* USER MODAL */}
                        {isUserModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '480px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{userModalMode === 'add' ? 'Register New Employee' : 'Edit Employee Details'}</h3>
                                <form onSubmit={handleUserSubmit}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <input type="text" className="form-control" required placeholder="Employee ID" value={userFormData.employee_id} disabled={userModalMode === 'edit' && user?.role !== 'Super Admin'} onChange={e => setUserFormData({ ...userFormData, employee_id: e.target.value })} style={{ fontSize: '10px', padding: '8px', opacity: (userModalMode === 'edit' && user?.role !== 'Super Admin') ? 0.5 : 1, cursor: (userModalMode === 'edit' && user?.role !== 'Super Admin') ? 'not-allowed' : 'text' }} />
                                        <input type="email" className="form-control" required placeholder="Email Address" value={userFormData.email} disabled={userModalMode === 'edit' && user?.role !== 'Super Admin'} onChange={e => setUserFormData({ ...userFormData, email: e.target.value })} style={{ fontSize: '10px', padding: '8px', opacity: (userModalMode === 'edit' && user?.role !== 'Super Admin') ? 0.5 : 1, cursor: (userModalMode === 'edit' && user?.role !== 'Super Admin') ? 'not-allowed' : 'text' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <input type="text" className="form-control" required placeholder="Full Name" value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} style={{ fontSize: '10px', padding: '8px' }} />
                                        <input type="text" className="form-control" required placeholder="Phone Number" value={userFormData.phone || ''} onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })} style={{ fontSize: '10px', padding: '8px' }} maxLength={10} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <select className="form-control" required value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value })} style={{ fontSize: '10px', padding: '8px' }}>
                                            <option value="" disabled>Select User Role</option>
                                            {userModalMode === 'edit' ? (
                                                <>
                                                    <option value="Requestor">Requestor</option>
                                                    <option value="Solver">Solver</option>
                                                    <option value="Dept. Head">Dept. Head</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Requestor">Requestor</option>
                                                    <option value="Solver">Solver</option>
                                                    <option value="Dept. Head">Dept. Head</option>
                                                    <option value="Admin">Admin</option>
                                                    <option value="Audit">Audit</option>
                                                </>
                                            )}
                                        </select>
                                        <select className="form-control" required value={userFormData.department} onChange={e => {
                                            const newDept = e.target.value;
                                            const deptHead = usersList.find(u => u.department === newDept && u.role === 'Dept. Head');
                                            setUserFormData({ ...userFormData, department: newDept, manager: deptHead ? deptHead.employee_id : '' });
                                        }} style={{ fontSize: '10px', padding: '8px' }}>
                                            <option value="" disabled>Select Department</option>
                                            {departmentsList.map(d => <option key={d.department_name} value={d.department_name}>{d.department_name}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <select className="form-control" value={userFormData.manager || ''} onChange={e => setUserFormData({ ...userFormData, manager: e.target.value })} style={{ fontSize: '10px', padding: '8px' }}>
                                            <option value="">No Manager (Optional)</option>
                                            {usersList.map(u => <option key={u.employee_id} value={u.employee_id}>{u.name} ({u.employee_id})</option>)}
                                        </select>
                                        <input type="text" className="form-control" required placeholder="Grade" value={userFormData.grade} onChange={e => setUserFormData({ ...userFormData, grade: e.target.value })} style={{ fontSize: '10px', padding: '8px' }} />
                                        <div style={{ position: 'relative' }}>
                                            <input type="text" required value={userFormData.outlet || ''} onChange={()=>{}} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }} />
                                            <div className="form-control" style={{ fontSize: '10px', padding: '8px', cursor: 'pointer', minHeight: '33px', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={(e) => {
                                                const panel = e.currentTarget.nextElementSibling;
                                                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                                            }}>
                                                {userFormData.outlet ? userFormData.outlet : 'Select Outlets...'}
                                            </div>
                                            <div style={{ display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '4px', zIndex: 50, maxHeight: '150px', overflowY: 'auto', padding: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                                                {locationsList.map(l => (
                                                    <label key={l.outlet} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', margin: 0 }}>
                                                        <input type="checkbox" style={{ marginRight: '8px', cursor: 'pointer' }} checked={String(userFormData.outlet || '').split(',').includes(l.outlet)} onChange={(e) => {
                                                            let current = String(userFormData.outlet || '').split(',').map(s=>s.trim()).filter(Boolean);
                                                            if (e.target.checked && !current.includes(l.outlet)) current.push(l.outlet);
                                                            else current = current.filter(x => x !== l.outlet);
                                                            setUserFormData({...userFormData, outlet: current.join(',')});
                                                        }} />
                                                        {l.outlet}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <input type="number" className="form-control" min="1" max="5" step="1" placeholder="Critical User Rating (1-5)" value={userFormData.critical_user_rating || ''} onChange={e => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setUserFormData({ ...userFormData, critical_user_rating: '' });
                                            } else {
                                                const num = Number(val);
                                                if (num >= 1 && num <= 5) {
                                                    setUserFormData({ ...userFormData, critical_user_rating: val });
                                                }
                                            }
                                        }} style={{ fontSize: '10px', padding: '8px', width: '100%' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                        <button type="button" className="btn" onClick={() => setIsUserModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '10px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* LOCATION MODAL */}
                        {isLocModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{locModalMode === 'add' ? 'Register New Outlet' : 'Edit Outlet Details'}</h3>
                                <form onSubmit={handleLocSubmit}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '12px' }}>
                                        <input type="text" className="form-control" required disabled={locModalMode === 'edit'} placeholder="Outlet Code" value={locFormData.outlet} onChange={e => setLocFormData({ ...locFormData, outlet: e.target.value })} style={{ backgroundColor: locModalMode === 'edit' ? '#09090b' : '#18181b', fontSize: '10px', padding: '8px' }} />
                                        <input type="text" className="form-control" required placeholder="Brand Name" value={locFormData.brand} onChange={e => setLocFormData({ ...locFormData, brand: e.target.value })} style={{ fontSize: '10px', padding: '8px' }} />
                                    </div>
                                    <input type="text" className="form-control" required placeholder="Location" value={locFormData.location} onChange={e => setLocFormData({ ...locFormData, location: e.target.value })} style={{ marginBottom: '12px', fontSize: '10px', padding: '8px' }} />
                                    <input type="text" className="form-control" required placeholder="City" value={locFormData.city} onChange={e => setLocFormData({ ...locFormData, city: e.target.value })} style={{ marginBottom: '12px', fontSize: '10px', padding: '8px' }} />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button type="button" className="btn" onClick={() => setIsLocModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '10px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* DEPARTMENT MODAL */}
                        {isDeptModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{deptModalMode === 'add' ? 'Add New Department' : 'Rename Department'}</h3>
                                <form onSubmit={handleDeptSubmit}>
                                    <input type="text" className="form-control" required placeholder="Department Name" value={deptFormData.department_name} onChange={e => setDeptFormData({ department_name: e.target.value })} style={{ marginBottom: '12px', fontSize: '10px', padding: '8px' }} />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button type="button" className="btn" onClick={() => setIsDeptModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '10px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* RULE MODAL */}
                        {isRuleModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '480px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{ruleModalMode === 'add' ? 'Add New Rule' : 'Edit Routing Rule'}</h3>
                                <form onSubmit={handleUpdateRule}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px' }}>Department</label>
                                            <select className="form-control" required value={editRule.department} onChange={e => setEditRule({ ...editRule, department: e.target.value, assigned_solver: '' })} style={{ fontSize: '10px', padding: '8px' }}>
                                                <option value="" disabled>Select Department</option>
                                                {departmentsList.map(d => <option key={d.department_name} value={d.department_name}>{d.department_name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px' }}>Issue Type</label>
                                            <input type="text" className="form-control" required value={editRule.issue_type} onChange={e => setEditRule({ ...editRule, issue_type: e.target.value })} style={{ fontSize: '10px', padding: '8px' }} />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '12px' }}>
                                        <label style={{ color: '#60a5fa', marginBottom: '6px', display: 'block', fontSize: '10px' }}>Location / Outlet (Select Multiple)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '128px', overflowY: 'auto', backgroundColor: '#09090b', padding: '10px', borderRadius: '5px', border: '1px solid #27272a' }}>
                                            {locationsList.map(l => {
                                                const isSelected = editRule.outlet && String(editRule.outlet).split(',').map(s => s.trim()).includes(String(l.outlet));
                                                return (
                                                    <label key={l.outlet} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', cursor: 'pointer', color: isSelected ? '#fff' : '#a1a1aa' }}>
                                                        <input type="checkbox" checked={isSelected} onChange={() => {
                                                            let currentOutlets = editRule.outlet ? String(editRule.outlet).split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'nan' && !s.toLowerCase().includes('global')) : [];
                                                            if (currentOutlets.includes(String(l.outlet))) currentOutlets = currentOutlets.filter(id => id !== String(l.outlet));
                                                            else currentOutlets.push(String(l.outlet));
                                                            setEditRule({ ...editRule, outlet: currentOutlets.join(',') });
                                                        }} style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: '#3b82f6' }} />
                                                        {l.outlet}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px' }}>Base Priority</label>
                                            <input type="number" className="form-control" required value={editRule.base_priority} onChange={e => setEditRule({ ...editRule, base_priority: parseInt(e.target.value) })} style={{ fontSize: '10px', padding: '8px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px' }}>Deadline (Hours)</label>
                                            <input type="number" className="form-control" required min="1" max="999" onInput={(e) => { if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3); }} value={editRule.deadline_hours} onChange={e => setEditRule({ ...editRule, deadline_hours: e.target.value ? parseInt(e.target.value) : '' })} style={{ fontSize: '10px', padding: '8px' }} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ color: '#60a5fa', marginBottom: '6px', display: 'block', fontSize: '10px' }}>Assign Solvers (Select Multiple for Round Robin)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '128px', overflowY: 'auto', backgroundColor: '#09090b', padding: '10px', borderRadius: '5px', border: '1px solid #27272a' }}>
                                            {usersList.filter(u => editRule.department && u.department === editRule.department && u.role && (String(u.role).toLowerCase() === 'solver' || String(u.role).toLowerCase().includes('head')) && u.is_active !== false).map(u => {
                                                const isSelected = editRule.assigned_solver && String(editRule.assigned_solver).includes(String(u.employee_id));
                                                return (
                                                    <label key={u.employee_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', cursor: 'pointer', color: isSelected ? '#fff' : '#a1a1aa' }}>
                                                        <input type="checkbox" checked={isSelected} onChange={() => handleSolverToggle(String(u.employee_id))} style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: '#3b82f6' }} />
                                                        {u.name} ({u.employee_id})
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                        <button type="button" className="btn" onClick={() => setIsRuleModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '10px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

            </div> {/* END WRAPPER */}

            {/* TICKET DETAILS SIDE PANEL */}
            {selectedTicket && (
                <>
                    {/* OVERLAY FOR EXPANDED VIEW */}
                    {isPanelExpanded && (
                        <div
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
                            onClick={() => setIsPanelExpanded(false)}
                        />
                    )}
                    <div className={!isPanelExpanded ? "card glass-panel slide-in-right-panel" : "card glass-panel"} style={{
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
                        zIndex: isPanelExpanded ? 9999 : 1000, backgroundColor: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: isPanelExpanded ? '20px 30px' : '0 0 16px 0',
                        marginBottom: isPanelExpanded ? '0' : '16px',
                        borderBottom: isPanelExpanded ? 'none' : '1px solid #e5e7eb',
                        transition: 'padding 0.4s ease'
                    }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                #{selectedTicket.ticket_id}
                                <span style={{
                                    backgroundColor: selectedTicket.closure_type === 'Declined' ? 'rgba(239, 68, 68, 0.1)' : selectedTicket.status === 'Closed' ? '#f3f4f6' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                    color: selectedTicket.closure_type === 'Declined' ? '#ef4444' : selectedTicket.status === 'Closed' ? '#6b7280' : selectedTicket.status === 'Resolved' ? '#10b981' : '#3b82f6',
                                    padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold'
                                }}>{selectedTicket.closure_type === 'Declined' ? 'Declined' : selectedTicket.status}</span>
                            </h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button onClick={() => setIsPanelExpanded(!isPanelExpanded)} style={{ background: 'none', border: 'none', color: isPanelExpanded ? '#4b5563' : '#9ca3af', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                {isPanelExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: isPanelExpanded ? 'center' : 'flex-start',
                        width: '100%',
                        borderBottom: '1px solid #e5e7eb',
                        padding: isPanelExpanded ? '0 30px' : '0',
                        marginBottom: '20px'
                    }}>
                        <button
                            onClick={() => setActivePanelTab('details')}
                            style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'details' ? '#3b82f6' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <FileText size={16} /> Details
                        </button>
                        <button
                            onClick={() => setActivePanelTab('timeline')}
                            style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'timeline' ? '#3b82f6' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <Clock size={16} /> Timeline
                        </button>
                        <button
                            onClick={() => setActivePanelTab('chat')}
                            style={{ flex: 1, backgroundColor: 'transparent', color: activePanelTab === 'chat' ? '#3b82f6' : 'var(--text-muted)', border: 'none', borderBottom: activePanelTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: 'bold', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <MessageSquare size={16} /> Chat
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: isPanelExpanded ? '0 30px 30px 30px' : '0', display: 'flex', flexDirection: 'column' }}>
                        {activePanelTab === 'chat' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {logsLoading ? (
                                    <p style={{ color: '#64748b', fontSize: '11px', textAlign: 'center' }}>Loading conversation...</p>
                                ) : ticketLogs.length === 0 ? (
                                    <p style={{ color: '#64748b', fontSize: '11px', textAlign: 'center' }}>No history available yet.</p>
                                ) : (
                                    ticketLogs.map((log, i) => {
                                        const isChat = log.action === 'Chat' || log.action === 'Message';
                                        if (!isChat) return null;
                                        const isMe = log.user === user.email || log.user === user.name || log.user_id === user.email || log.user_id === user.employee_id;
                                        return (
                                            <div key={i} className={isMe ? 'chat-bubble-me' : 'chat-bubble-other'} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', backgroundColor: isMe ? '#dbeafe' : '#ffffff', border: '1px solid #e2e8f0' }}>
                                                <div className="chat-bubble-user" style={{ fontSize: '10px', marginBottom: '4px', fontWeight: 'bold', color: '#0f172a' }}>{log.user || log.user_id || 'System'}</div>
                                                <div className="chat-bubble-text" style={{ fontSize: '12px', lineHeight: '1.4', color: '#334155' }}>{log.remarks || log.details}</div>
                                                <div className="chat-bubble-time" style={{ fontSize: '9px', marginTop: '6px', textAlign: 'right', color: '#94a3b8' }}>{log.timestamp}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : activePanelTab === 'details' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
                                {/* METADATA GRID (Stacked Labels) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '20px', columnGap: '16px', padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raised On</span>
                                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>{selectedTicket.timestamp ? selectedTicket.timestamp.split(' ')[0] : 'N/A'}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Requestor</span>
                                        <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{getUserDetails(selectedTicket.raiser_email)}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</span>
                                        <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{formatSolverDetails(selectedTicket.assigned_to)}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</span>
                                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{selectedTicket.location}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue Type</span>
                                        <span style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', wordBreak: 'break-word' }}>{selectedTicket.issue_type}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Score</span>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: selectedTicket.total_score >= 10 ? '#ef4444' : '#10b981' }}>{selectedTicket.total_score} pts</span>
                                    </div>
                                    {selectedTicket.deadline && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline</span>
                                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>{selectedTicket.deadline.split(' ')[1] || selectedTicket.deadline.split(' ')[0] || selectedTicket.deadline}</span>
                                        </div>
                                    )}
                                </div>

                                {/* ISSUE DESCRIPTION & ATTACHMENT ROW */}
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
                                    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--bg-card)' }}>
                                        <strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: 'var(--text-main)' }}>Issue Description:</strong>
                                        <div style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto', paddingRight: '4px', fontSize: '13px', lineHeight: '1.6' }}>{selectedTicket.description}</div>
                                    </div>
                                    {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (
                                        <div style={{ width: '100px', flexShrink: 0 }}>
                                            <strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: 'var(--text-main)' }}>Attached File:</strong>
                                            <img 
                                                src={String(selectedTicket.attachment).startsWith('data:') ? String(selectedTicket.attachment) : `/uploads/${selectedTicket.attachment}`}
                                                onClick={() => {
                                                    const attachStr = String(selectedTicket.attachment);
                                                    window.open(attachStr.startsWith('data:') ? attachStr : `/uploads/${attachStr}`, '_blank');
                                                }}
                                                style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                                alt="Attachment"
                                                title="Click to view full size"
                                            />
                                        </div>
                                    )}
                                </div>
                        </div>
                    ) : activePanelTab === 'timeline' ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <TicketTimeline logs={ticketLogs} userRole={user?.role} />
                        </div>
                    ) : null}
                    </div>
                </div>
                </>
            )}
        </Layout>
    );
};

export default AdminDashboard;