import axios from 'axios';

// Point this to your Flask server address
const API_URL = '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// --- AUTHENTICATION ---
export const loginUser = async (credentials) => {
    const response = await api.post('/login', credentials);
    return response.data;
};

export const resetFirstPassword = async (data) => {
    const response = await api.post('/reset-first-password', data);
    return response.data;
};

// --- TICKETS ---
export const fetchTickets = async () => {
    const response = await api.get('/tickets');
    return response.data;
};

export const createTicket = async (ticketData) => {
    // ENTERPRISE OVERRIDE: We remove the default JSON header by setting it to undefined 
    // so Axios automatically sets multipart/form-data with the correct boundary!
    const response = await api.post('/tickets/create', ticketData, {
        headers: {
            'Content-Type': undefined
        }
    });
    return response.data;
};

export const updateTicketStatus = async (updateData) => {
    const isFormData = updateData instanceof FormData;
    const response = await api.post('/tickets/update_status', updateData, {
        headers: isFormData ? { 'Content-Type': undefined } : {}
    });
    return response.data;
};

export const requestTicketHandover = async (data) => {
    const response = await api.post('/tickets/handover', data);
    return response.data;
};

export const rateRequestor = async (data) => {
    const response = await api.post('/tickets/rate-requestor', data);
    return response.data;
};

// --- TICKET AUDIT LOGS (NEW) ---
export const fetchTicketLogs = async (ticketId) => {
    const response = await api.get(`/tickets/${ticketId}/logs`);
    return response.data;
};

// --- NOTIFICATIONS (NEW) ---
export const fetchNotifications = async (email) => {
    const response = await api.get(`/notifications/${email}`);
    return response.data;
};

export const markNotificationRead = async (notifId) => {
    const response = await api.post('/notifications/read', { notif_id: notifId });
    return response.data;
};

export const markAllNotificationsRead = async (email) => {
    const response = await api.post('/notifications/read-all', { email });
    return response.data;
};

export const toggleUserStatus = async (data) => {
    const response = await api.post('/admin/users/toggle_status', data);
    return response.data;
};

// --- DEPARTMENT HEAD ---
export const fetchDeptOverview = async (deptName) => {
    const response = await api.get(`/dept/${deptName}/overview`);
    return response.data;
};

export const fetchPendingApprovals = async (deptName) => {
    const response = await api.get(`/dept/${deptName}/pending-approvals`);
    return response.data;
};

export const processTransfer = async (data) => {
    // FIX: Aligned perfectly with dept_head_api.py endpoint
    const response = await api.post('/dept/approve-transfer', data);
    return response.data;
};

export const forceReassign = async (data) => {
    const response = await api.post('/dept/reassign', data);
    return response.data;
};

// --- ADMIN ---
export const fetchUsers = async () => {
    const response = await api.get('/admin/users');
    return response.data;
};

export const fetchLocations = async () => {
    const response = await api.get('/admin/locations');
    return response.data;
};

export const fetchMasterRules = async () => {
    const response = await api.get('/admin/master-rules');
    return response.data;
};

export const fetchDepartments = async () => {
    const response = await api.get('/admin/departments');
    return response.data;
};

export const createUser = async (data) => {
    const response = await api.post('/admin/users/create', data);
    return response.data;
};

export const createLocation = async (data) => {
    const response = await api.post('/admin/locations/create', data);
    return response.data;
};

export const createDepartment = async (data) => {
    const response = await api.post('/admin/departments/create', data);
    return response.data;
};

export const updateUser = async (userData) => {
    const response = await api.post('/admin/users/update', userData);
    return response.data;
};

export const updateLocation = async (locData) => {
    const response = await api.post('/admin/locations/update', locData);
    return response.data;
};

// --- DYNAMIC ROLE-BASED ROUTES ---
export const updateMasterRule = async (ruleData) => {
    // Check local storage to see who is logged in
    const userStr = localStorage.getItem('ticket_user');
    const user = userStr ? JSON.parse(userStr) : null;

    // Route dynamically to the correct Python backend based on role
    const endpoint = (user?.role === 'Admin' || user?.role === 'Super Admin')
        ? '/admin/rules/update'
        : '/dept/rules/update';

    const response = await api.post(endpoint, ruleData);
    return response.data;
};

export const deleteUser = async (data) => {
    const response = await api.post('/admin/users/delete', data);
    return response.data;
};

export const adminResetPassword = async (data) => {
    const response = await api.post('/admin/users/reset-password', data);
    return response.data;
};

export const deleteLocation = async (data) => {
    const response = await api.post('/admin/locations/delete', data);
    return response.data;
};

export const deleteDepartment = async (data) => {
    const response = await api.post('/admin/departments/delete', data);
    return response.data;
};

export const updateDepartment = async (data) => {
    const response = await api.post('/admin/departments/update', data);
    return response.data;
};

export const deleteMasterRule = async (data) => {
    const response = await api.post('/admin/rules/delete', data);
    return response.data;
};

// --- BULK IMPORT & TEMPLATES ---
export const uploadImportFile = async (entity, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/admin/import/${entity}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

// We don't use axios for downloads easily, better to just return the URL or handle it here
export const getImportTemplateUrl = (entity) => {
    return `${API_URL}/admin/template/${entity}`;
};

export default api;