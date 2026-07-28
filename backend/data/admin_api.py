from flask import Blueprint, request, jsonify, send_file
import pandas as pd
import hashlib
import database
import io

admin_bp = Blueprint('admin', __name__)
DEFAULT_PASSWORD = "Kolkata@123"

def hash_password(password):
    return hashlib.sha256(str.encode(password)).hexdigest()

# --- USER MANAGEMENT ---
@admin_bp.route('/api/admin/users', methods=['GET'])
def get_users():
    users = database.load_data('users')
    # Remove passwords from the API payload for security
    if 'password' in users.columns:
        users = users.drop(columns=['password'])
    users = users.where(pd.notnull(users), None)
    return jsonify(users.to_dict(orient='records')), 200

@admin_bp.route('/api/admin/users/create', methods=['POST'])
def create_user():
    data = request.json
    users = database.load_data('users')
    
    # Basic Validation
    if data.get('phone') and len(str(data['phone'])) > 10:
        return jsonify({"error": "Phone number must not exceed 10 digits"}), 400
    if data['email'] in users['email'].values:
        return jsonify({"error": "Email already exists"}), 400
    if str(data['employee_id']) in users['employee_id'].astype(str).values:
        return jsonify({"error": "Employee ID already exists"}), 400
        
    mgr = data.get('manager')
    if mgr and str(mgr).strip() and str(mgr).strip() != '-':
        mgr_str = str(mgr).strip()
        if mgr_str not in users['employee_id'].astype(str).values:
            return jsonify({"error": f"Manager ID '{mgr_str}' does not exist in the system"}), 400
        
    raw_rating = data.get('critical_user_rating', 0)
    try:
        rating_val = float(raw_rating) if raw_rating not in (None, '', 'null', 'nan') else 0.0
    except (ValueError, TypeError):
        rating_val = 0.0

    new_user = {
        "employee_id": data['employee_id'],
        "email": data['email'],
        "password": hash_password(DEFAULT_PASSWORD),
        "name": data['name'],
        "role": data['role'],
        "department": data['department'],
        "outlet": data['outlet'],
        "grade": data['grade'],
        "phone": data['phone'],
        "critical_user_rating": rating_val,
        "manager": data.get('manager'),
        "first_login": True
    }
    
    database.append_data(pd.DataFrame([new_user]), 'users')
    return jsonify({"message": "User created successfully"}), 201

@admin_bp.route('/api/admin/users/update', methods=['POST'])
def update_user():
    data = request.json
    emp_id = data.get('employee_id')
    original_emp_id = data.get('original_employee_id', emp_id)
    users = database.load_data('users')
    
    if data.get('phone') and len(str(data['phone'])) > 10:
        return jsonify({"error": "Phone number must not exceed 10 digits"}), 400
        
    if str(original_emp_id) not in users['employee_id'].astype(str).values:
        return jsonify({"error": "User not found"}), 404
        
    mgr = data.get('manager')
    if mgr and str(mgr).strip() and str(mgr).strip() != '-':
        mgr_str = str(mgr).strip()
        if mgr_str not in users['employee_id'].astype(str).values and mgr_str != str(emp_id):
            return jsonify({"error": f"Manager ID '{mgr_str}' does not exist in the system"}), 400
        
    mask = users['employee_id'].astype(str) == str(original_emp_id)
    original_email = users.loc[mask, 'email'].values[0]
    
    raw_rating_update = data.get('critical_user_rating', 0)
    try:
        rating_val_update = float(raw_rating_update) if raw_rating_update not in (None, '', 'null', 'nan') else 0.0
    except (ValueError, TypeError):
        rating_val_update = 0.0

    users.loc[mask, 'employee_id'] = emp_id
    users.loc[mask, 'email'] = data.get('email')
    users.loc[mask, 'role'] = data.get('role')
    users.loc[mask, 'department'] = data.get('department')
    users.loc[mask, 'critical_user_rating'] = rating_val_update
    users.loc[mask, 'outlet'] = data.get('outlet')
    users.loc[mask, 'manager'] = data.get('manager')
    users.loc[mask, 'name'] = data.get('name')
    users.loc[mask, 'phone'] = data.get('phone')
    users.loc[mask, 'grade'] = data.get('grade')
    
    database.save_data(users, 'users')

    if str(original_emp_id) != str(emp_id) or str(original_email) != str(data.get('email')):
        tickets = database.load_data('tickets')
        tickets_changed = False
        if str(original_emp_id) != str(emp_id):
            if 'assigned_to' in tickets.columns:
                tickets.loc[tickets['assigned_to'].astype(str) == str(original_emp_id), 'assigned_to'] = emp_id
                tickets_changed = True
            if 'reassign_requested_to' in tickets.columns:
                tickets.loc[tickets['reassign_requested_to'].astype(str) == str(original_emp_id), 'reassign_requested_to'] = emp_id
                tickets_changed = True
        if str(original_email) != str(data.get('email')):
            if 'raiser_email' in tickets.columns:
                tickets.loc[tickets['raiser_email'].astype(str) == str(original_email), 'raiser_email'] = data.get('email')
                tickets_changed = True
        if tickets_changed:
            database.save_data(tickets, 'tickets')

    return jsonify({"message": "User updated successfully"}), 200

# --- LOCATION MANAGEMENT ---
@admin_bp.route('/api/admin/locations', methods=['GET'])
def get_locations():
    locations = database.load_data('locations')
    locations = locations.where(pd.notnull(locations), None)
    return jsonify(locations.to_dict(orient='records')), 200

@admin_bp.route('/api/admin/locations/create', methods=['POST'])
def create_location():
    data = request.json
    locations = database.load_data('locations')
    
    if data['outlet'] in locations['outlet'].values:
        return jsonify({"error": "Outlet code already exists"}), 400
        
    new_loc = pd.DataFrame([data])
    database.append_data(new_loc, 'locations')
    return jsonify({"message": "Location added successfully"}), 201

# --- MASTER LOGIC RULES ---
@admin_bp.route('/api/admin/master-rules', methods=['GET'])
def get_master_rules():
    master = database.load_data('master')
    master = master.where(pd.notnull(master), None)
    return jsonify(master.to_dict(orient='records')), 200

# --- Update Locations ---
@admin_bp.route('/api/admin/locations/update', methods=['POST'])
def update_location():
    data = request.json
    outlet = data.get('outlet')
    locations = database.load_data('locations')
    
    if outlet not in locations['outlet'].values:
        return jsonify({"error": "Location not found"}), 404
        
    locations.loc[locations['outlet'] == outlet, 'brand'] = data.get('brand')
    locations.loc[locations['outlet'] == outlet, 'location'] = data.get('location')
    locations.loc[locations['outlet'] == outlet, 'city'] = data.get('city')
    
    database.save_data(locations, 'locations')
    return jsonify({"message": "Location updated successfully"}), 200

# --- TICKET MANAGEMENT ---
@admin_bp.route('/api/admin/tickets/delete', methods=['POST'])
def delete_ticket():
    data = request.json
    ticket_id = str(data.get('ticket_id')).strip()
    
    if not ticket_id:
        return jsonify({"error": "Ticket ID is required"}), 400
        
    tickets = database.load_data('tickets')
    logs = database.load_data('logs')
    notifs = database.load_data('notifications')
    
    if ticket_id not in tickets['ticket_id'].astype(str).values:
        return jsonify({"error": "Ticket not found"}), 404
        
    tickets = tickets[tickets['ticket_id'].astype(str) != ticket_id]
    
    if not logs.empty and 'ticket_id' in logs.columns:
        logs = logs[logs['ticket_id'].astype(str) != ticket_id]
        
    if not notifs.empty and 'ticket_id' in notifs.columns:
        notifs = notifs[notifs['ticket_id'].astype(str) != ticket_id]
        
    database.save_data(tickets, 'tickets')
    database.save_data(logs, 'logs')
    database.save_data(notifs, 'notifications')
    
    return jsonify({"message": f"Ticket #{ticket_id} and all associated logs and notifications have been permanently deleted."}), 200

#----- DEPARTMENTS -----
@admin_bp.route('/api/admin/departments', methods=['GET'])
def get_departments():
    departments = database.load_data('departments')
    departments = departments.where(pd.notnull(departments), None)
    return jsonify(departments.to_dict(orient='records')), 200

@admin_bp.route('/api/admin/departments/create', methods=['POST'])
def create_department():
    data = request.json
    dept_name = data.get('department_name')
    if not dept_name:
        return jsonify({"error": "Missing department name"}), 400
        
    departments = database.load_data('departments')
    if dept_name in departments['department_name'].values:
        return jsonify({"error": "Department already exists"}), 400
        
    new_dept = pd.DataFrame([{'department_name': dept_name}])
    database.append_data(new_dept, 'departments')
    return jsonify({"message": "Department created successfully"}), 201

#-----Update MAster Logic Rules-------
@admin_bp.route('/api/admin/rules/update', methods=['POST'])
def update_rule():
    data = request.json
    old_dept = data.get('original_department', data.get('department'))
    old_issue = data.get('original_issue_type', data.get('issue_type'))
    
    rules = database.load_data('master')
    
    match_idx = rules.index[(rules['department'] == old_dept) & (rules['issue_type'] == old_issue)].tolist()
    
    if not match_idx:
        new_rule = {
            'department': data.get('department'),
            'issue_type': data.get('issue_type'),
            'outlet': data.get('outlet'),
            'base_priority': data.get('base_priority', 3),
            'assigned_solver': data.get('assigned_solver'),
            'deadline_hours': data.get('deadline_hours', 24)
        }
        database.append_data(pd.DataFrame([new_rule]), 'master')
        return jsonify({"message": "Rule created successfully"}), 201
        
    idx = match_idx[0]
    
    rules.loc[idx, 'department'] = str(data.get('department', ''))
    rules.loc[idx, 'issue_type'] = str(data.get('issue_type', ''))
    rules.loc[idx, 'outlet'] = str(data.get('outlet')) if data.get('outlet') else None
    
    # Save the priority and the new deadline!
    rules.loc[idx, 'base_priority'] = str(data.get('base_priority'))
    rules.loc[idx, 'deadline_hours'] = str(data.get('deadline_hours')) # <-- NEW LINE
    
    new_solver = data.get('assigned_solver')
    if pd.isna(new_solver) or str(new_solver).strip() == '':
        rules.loc[idx, 'assigned_solver'] = None
    else:
        rules.loc[idx, 'assigned_solver'] = new_solver
    
    database.save_data(rules, 'master')
    return jsonify({"message": "Rule updated successfully"}), 200

# --- SUPER ADMIN DELETE & RESET FUNCTIONS ---
@admin_bp.route('/api/admin/users/delete', methods=['POST'])
def delete_user():
    data = request.json
    emp_id = data.get('employee_id')
    users = database.load_data('users')
    
    target_user = users[users['employee_id'].astype(str) == str(emp_id)]
    if target_user.empty:
        return jsonify({"error": "User not found"}), 404
        
    role = str(target_user.iloc[0].get('role', '')).strip()
    if role in ['Admin', 'Super Admin']:
        return jsonify({"error": "Cannot delete Admin or Super Admin roles"}), 403
        
    user_email = str(target_user.iloc[0].get('email', '')).strip()
    
    users = users[users['employee_id'].astype(str) != str(emp_id)]
    
    if 'manager' in users.columns:
        users.loc[users['manager'].astype(str) == str(emp_id), 'manager'] = '-'
        
    database.save_data(users, 'users')
    
    def remove_assignment(val):
        if pd.isna(val) or str(val).strip() == '' or str(val).lower() == 'nan':
            return val
        ids = [x.strip() for x in str(val).split(',')]
        ids = [x for x in ids if x != str(emp_id) and (not user_email or x != user_email)]
        return ','.join(ids) if ids else None

    # Clean rules
    try:
        rules = database.load_data('master')
        if not rules.empty and 'assigned_solver' in rules.columns:
            rules['assigned_solver'] = rules['assigned_solver'].apply(remove_assignment)
            database.save_data(rules, 'master')
    except Exception as e:
        print(f"Error cleaning rules assignments: {e}")

    # Clean tickets
    try:
        tickets = database.load_data('tickets')
        if not tickets.empty:
            if 'assigned_to' in tickets.columns:
                tickets['assigned_to'] = tickets['assigned_to'].apply(remove_assignment)
            if 'reassign_requested_to' in tickets.columns:
                tickets['reassign_requested_to'] = tickets['reassign_requested_to'].apply(remove_assignment)
            database.save_data(tickets, 'tickets')
    except Exception as e:
        print(f"Error cleaning tickets assignments: {e}")

    return jsonify({"message": "User deleted successfully"}), 200

@admin_bp.route('/api/admin/users/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    emp_id = data.get('employee_id')
    users = database.load_data('users')
    
    if str(emp_id) not in users['employee_id'].astype(str).values:
        return jsonify({"error": "User not found"}), 404
        
    mask = users['employee_id'].astype(str) == str(emp_id)
    users.loc[mask, 'password'] = hash_password("Kolkata@123")
    users.loc[mask, 'first_login'] = True
    database.save_data(users, 'users')
    return jsonify({"message": "Password reset to Kolkata@123 successfully"}), 200

@admin_bp.route('/api/admin/locations/delete', methods=['POST'])
def delete_location():
    data = request.json
    outlet = data.get('outlet')
    locations = database.load_data('locations')
    
    if outlet not in locations['outlet'].values:
        return jsonify({"error": "Location not found"}), 404
        
    locations = locations[locations['outlet'] != outlet]
    database.save_data(locations, 'locations')
    return jsonify({"message": "Location deleted successfully"}), 200

@admin_bp.route('/api/admin/departments/update', methods=['POST'])
def update_department():
    data = request.json
    old_name = data.get('old_department_name')
    new_name = data.get('new_department_name')
    
    if not old_name or not new_name:
        return jsonify({"error": "Both old and new department names are required"}), 400
        
    depts = database.load_data('departments')
    if old_name not in depts['department_name'].values:
        return jsonify({"error": "Department not found"}), 404
        
    if new_name in depts['department_name'].values:
        return jsonify({"error": "New department name already exists"}), 400
        
    # Update department in departments table
    depts.loc[depts['department_name'] == old_name, 'department_name'] = new_name
    database.save_data(depts, 'departments')
    
    # Cascade to master rules
    rules = database.load_data('master')
    if not rules.empty and 'department' in rules.columns:
        rules.loc[rules['department'] == old_name, 'department'] = new_name
        database.save_data(rules, 'master')
        
    # Cascade to users
    users = database.load_data('users')
    if not users.empty and 'department' in users.columns:
        users.loc[users['department'] == old_name, 'department'] = new_name
        database.save_data(users, 'users')
        
    # Cascade to tickets
    tickets = database.load_data('tickets')
    if not tickets.empty and 'dept_assigned' in tickets.columns:
        tickets.loc[tickets['dept_assigned'] == old_name, 'dept_assigned'] = new_name
        database.save_data(tickets, 'tickets')
        
    return jsonify({"message": "Department renamed successfully across all tables"}), 200

@admin_bp.route('/api/admin/departments/delete', methods=['POST'])
def delete_department():
    data = request.json
    dept = data.get('department_name')
    departments = database.load_data('departments')
    
    if dept not in departments['department_name'].values:
        return jsonify({"error": "Department not found"}), 404
        
    departments = departments[departments['department_name'] != dept]
    database.save_data(departments, 'departments')
    return jsonify({"message": "Department deleted successfully"}), 200

@admin_bp.route('/api/admin/rules/delete', methods=['POST'])
def delete_rule():
    data = request.json
    dept = data.get('department')
    issue = data.get('issue_type')
    rules = database.load_data('master')
    
    mask = (rules['department'] == dept) & (rules['issue_type'] == issue)
    if not any(mask):
        return jsonify({"error": "Rule not found"}), 404
        
    rules = rules[~mask]
    database.save_data(rules, 'master')
    return jsonify({"message": "Rule deleted successfully"}), 200

# ==========================================
# BULK EXCEL IMPORT & TEMPLATES
# ==========================================

TEMPLATE_SCHEMAS = {
    'users': ['employee_id', 'email', 'name', 'role', 'department', 'outlet', 'grade', 'phone', 'critical_user_rating', 'manager'],
    'locations': ['outlet', 'brand', 'location', 'city'],
    'rules': ['department', 'issue_type', 'base_priority', 'deadline_hours', 'assigned_solver', 'outlet']
}

@admin_bp.route('/api/admin/template/<entity>', methods=['GET'])
def download_template(entity):
    if entity not in TEMPLATE_SCHEMAS:
        return jsonify({"error": "Invalid entity"}), 400
        
    df = pd.DataFrame(columns=TEMPLATE_SCHEMAS[entity])
    
    # Optional: Add a dummy row to guide the user
    if entity == 'users':
        df.loc[0] = ['EMP-999', 'john999@example.com', 'John Doe', 'Solver', 'IT Support', 'OUT-101', 'M1', '9876543210', '5', '']
    elif entity == 'locations':
        df.loc[0] = ['OUT-101', 'Ambuja Neotia', 'City Centre 1', 'Kolkata']
    elif entity == 'rules':
        df.loc[0] = ['IT Support', 'Network Issue', '5', '4', '101,102', 'Global (All)']
        
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        sheet_name = f'{entity.title()} Template'
        df.to_excel(writer, index=False, sheet_name=sheet_name)
        
        # Format all columns as Text so things like "101,102" don't become numeric
        worksheet = writer.sheets[sheet_name]
        for col_cells in worksheet.columns:
            for cell in col_cells:
                cell.number_format = '@'
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'{entity}_import_template.xlsx'
    )

@admin_bp.route('/api/admin/import/<entity>', methods=['POST'])
def import_bulk_data(entity):
    if entity not in TEMPLATE_SCHEMAS:
        return jsonify({"error": "Invalid entity"}), 400
        
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    try:
        df = pd.read_excel(file)
        
        # Validate columns
        required_cols = TEMPLATE_SCHEMAS[entity]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return jsonify({"error": f"Invalid format. Missing columns: {', '.join(missing_cols)}"}), 400
            
        # Clean data
        df = df.dropna(how='all') # Drop empty rows
        
        table_name = entity if entity != 'rules' else 'master'
        existing_df = database.load_data(table_name)
        
        existing_users_df = existing_df if entity == 'users' else database.load_data('users')
        existing_user_ids = existing_users_df['employee_id'].astype(str).tolist() if not existing_users_df.empty else []
        current_batch_ids = df['employee_id'].astype(str).str.strip().tolist() if 'employee_id' in df.columns else []

        # Cell-by-cell validation
        for index, row in df.iterrows():
            row_num = index + 2  # +2 because index is 0-based and excel has header row
            if entity == 'users':
                if pd.isna(row.get('email')) or '@' not in str(row.get('email')):
                    return jsonify({"error": f"Row {row_num}, Column 'email': Invalid email address."}), 400
                if pd.isna(row.get('employee_id')):
                    return jsonify({"error": f"Row {row_num}, Column 'employee_id': Cannot be empty."}), 400
                
                mgr = row.get('manager')
                if pd.notna(mgr) and str(mgr).strip() and str(mgr).lower() != 'nan' and str(mgr).strip() != '-':
                    mgr_str = str(mgr).strip()
                    if mgr_str not in existing_user_ids and mgr_str not in current_batch_ids:
                        return jsonify({"error": f"Row {row_num}, Column 'manager': Manager ID '{mgr_str}' does not exist in the system or this upload file."}), 400
            elif entity == 'rules':
                if pd.isna(row.get('department')):
                    return jsonify({"error": f"Row {row_num}, Column 'department': Cannot be empty."}), 400
                if pd.isna(row.get('issue_type')):
                    return jsonify({"error": f"Row {row_num}, Column 'issue_type': Cannot be empty."}), 400
                try:
                    int(float(row.get('base_priority')))
                except (ValueError, TypeError):
                    return jsonify({"error": f"Row {row_num}, Column 'base_priority': Must be an integer."}), 400
                try:
                    int(float(row.get('deadline_hours')))
                except (ValueError, TypeError):
                    return jsonify({"error": f"Row {row_num}, Column 'deadline_hours': Must be an integer."}), 400
                if pd.isna(row.get('assigned_solver')):
                     return jsonify({"error": f"Row {row_num}, Column 'assigned_solver': Cannot be empty."}), 400
                     
                solvers_str = str(row.get('assigned_solver'))
                if solvers_str and solvers_str.lower() != 'nan':
                    solvers_list = [s.strip() for s in solvers_str.split(',')]
                    for solver in solvers_list:
                        if solver not in existing_user_ids and solver not in current_batch_ids:
                            return jsonify({"error": f"Row {row_num}, Column 'assigned_solver': Solver ID '{solver}' does not exist in the system."}), 400
            elif entity == 'locations':
                if pd.isna(row.get('outlet')):
                    return jsonify({"error": f"Row {row_num}, Column 'outlet': Cannot be empty."}), 400
        
        if entity == 'users':
            # Hash passwords for new users
            df['password'] = hash_password(DEFAULT_PASSWORD)
            df['first_login'] = True
            df['employee_id'] = df['employee_id'].astype(str).str.strip()
            df['email'] = df['email'].astype(str).str.strip()
            # Drop rows where employee_id or email already exists
            if not existing_df.empty:
                df = df[~df['employee_id'].isin(existing_df['employee_id'].astype(str))]
                df = df[~df['email'].isin(existing_df['email'].astype(str))]
                
        elif entity == 'locations':
            df['outlet'] = df['outlet'].astype(str).str.strip()
            if not existing_df.empty:
                df = df[~df['outlet'].isin(existing_df['outlet'].astype(str))]
                
        elif entity == 'rules':
            # Ensure types match safely to avoid string dtype issues
            df['department'] = df['department'].astype(str)
            df['issue_type'] = df['issue_type'].astype(str)
            df['outlet'] = df['outlet'].fillna('').astype(str)
            df['base_priority'] = df['base_priority'].astype(str)
            df['deadline_hours'] = df['deadline_hours'].astype(str)
            df['assigned_solver'] = df['assigned_solver'].astype(str)
            
            # Simple dedup based on (dept, issue, location)
            if not existing_df.empty:
                existing_keys = existing_df['department'] + '|' + existing_df['issue_type'] + '|' + existing_df['outlet'].fillna('').astype(str)
                new_keys = df['department'] + '|' + df['issue_type'] + '|' + df['outlet']
                df = df[~new_keys.isin(existing_keys)]
                
        if df.empty:
            return jsonify({"message": "No new records to import (all duplicates or empty file)."}), 200
            
        # Auto-generate next IDs based on the database's last ID
        if not existing_df.empty and 'id' in existing_df.columns:
            max_id = pd.to_numeric(existing_df['id'], errors='coerce').max()
            if pd.isna(max_id):
                max_id = 0
            df['id'] = range(int(max_id) + 1, int(max_id) + 1 + len(df))
        elif existing_df.empty or 'id' not in existing_df.columns:
            # If there's no data or no ID column yet, start at 1
            df['id'] = range(1, len(df) + 1)
            
        # Append data directly
        database.append_data(df, table_name)
        
        return jsonify({"message": f"Successfully imported {len(df)} {entity}!"}), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500