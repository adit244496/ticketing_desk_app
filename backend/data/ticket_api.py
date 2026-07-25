import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import pandas as pd
from datetime import datetime
import database
from PIL import Image

ticket_bp = Blueprint('ticket', __name__)

def compress_image(file_path, max_size_kb=20):
    """Compresses an image file in-place until it is under max_size_kb."""
    try:
        # Check if the file is an image
        if not file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            return

        file_size_kb = os.path.getsize(file_path) / 1024
        if file_size_kb <= max_size_kb:
            return

        with Image.open(file_path) as img:
            # Convert to RGB to safely save as JPEG
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
                
            quality = 85
            # Resize image to a reasonable max dimension first if it's very large
            img.thumbnail((800, 800), Image.Resampling.LANCZOS)
            
            # Save incrementally with lower quality
            while file_size_kb > max_size_kb and quality > 10:
                img.save(file_path, format='JPEG', quality=quality, optimize=True)
                file_size_kb = os.path.getsize(file_path) / 1024
                quality -= 10
    except Exception as e:
        print(f"Image compression failed: {e}")


# ==========================================
# --- HELPERS: USER RESOLUTION & DISPLAY ---
# ==========================================
def get_user_email(identifier, users_df):
    """Safely converts an employee_id OR email into a valid email address."""
    if pd.isnull(identifier) or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return None
    ident_str = str(identifier).strip()
    
    if '@' in ident_str:
        return ident_str
        
    if not users_df.empty:
        try:
            clean_id = str(int(float(ident_str)))
            match = users_df[users_df['employee_id'].astype(str) == clean_id]
            if not match.empty:
                return match.iloc[0]['email']
        except Exception:
            match = users_df[users_df['employee_id'].astype(str) == ident_str]
            if not match.empty:
                return match.iloc[0]['email']
    return ident_str

def get_user_emp_id(identifier, users_df):
    """Safely converts any identifier into employee_id FOR STORAGE."""
    if pd.isnull(identifier) or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return 'Unassigned'
    ident_str = str(identifier).strip()
    
    if not users_df.empty:
        if '@' in ident_str:
            match = users_df[users_df['email'].str.lower() == ident_str.lower()]
            if not match.empty:
                return str(match.iloc[0]['employee_id'])
        else:
            try:
                clean_id = str(int(float(ident_str)))
                match = users_df[users_df['employee_id'].astype(str) == clean_id]
                if not match.empty:
                    return str(match.iloc[0]['employee_id'])
            except Exception:
                match = users_df[users_df['employee_id'].astype(str) == ident_str]
                if not match.empty:
                    return str(match.iloc[0]['employee_id'])
    return ident_str

def get_user_display(identifier, users_df):
    """Converts ANY identifier to 'Name (Phone)' FOR DISPLAY."""
    if pd.isnull(identifier) or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return 'Unassigned'
    ident_str = str(identifier).strip()
    
    if not users_df.empty:
        if '@' in ident_str:
            match = users_df[users_df['email'].str.lower() == ident_str.lower()]
        else:
            try:
                clean_id = str(int(float(ident_str)))
                match = users_df[users_df['employee_id'].astype(str) == clean_id]
            except Exception:
                match = users_df[users_df['employee_id'].astype(str) == ident_str]
                
        if not match.empty:
            name = match.iloc[0].get('name', ident_str)
            phone = match.iloc[0].get('phone', 'N/A')
            if pd.isnull(phone) or str(phone).strip().lower() == 'nan':
                phone = 'N/A'
            return f"{name} ({phone})"
            
    return ident_str


# ==========================================
# --- CORE TICKET ROUTES ---
# ==========================================
@ticket_bp.route('/api/tickets', methods=['GET'])
def get_tickets():
    database.auto_close_resolved_tickets()
    database.auto_check_sla_breaches()
    database.escalate_open_tickets()
    database.escalate_overdue_tickets()
    
    tickets = database.load_data('tickets')
    users = database.load_data('users')
    tickets = tickets.where(pd.notnull(tickets), None)
    
    # INTERCEPT AND FORMAT DISPLAY NAMES
    records = tickets.to_dict(orient='records')
    for r in records:
        r['assigned_to'] = get_user_display(r.get('assigned_to'), users)
        
        # Calculate SLA Breach dynamically
        SLA_Breach = False
        deadline_time = r.get('deadline')
        if deadline_time and pd.notnull(deadline_time) and str(deadline_time).strip():
            try:
                deadline_dt = datetime.strptime(str(deadline_time), "%d-%m-%Y %H:%M")
                if str(r.get('status', '')).lower() in ['closed', 'resolved']:
                    solved_time = r.get('solved_timestamp') or r.get('closed_timestamp')
                    if solved_time and pd.notnull(solved_time):
                        solved_dt = datetime.strptime(str(solved_time), "%d-%m-%Y %H:%M")
                        if solved_dt > deadline_dt:
                            SLA_Breach = True
                else:
                    if datetime.now() > deadline_dt:
                        SLA_Breach = True
            except:
                pass
        r['SLA_Breach'] = SLA_Breach
        
    return jsonify(records), 200

@ticket_bp.route('/api/tickets/<int:ticket_id>/logs', methods=['GET'])
def get_ticket_logs(ticket_id):
    """Fetches the complete audit history for a specific ticket."""
    logs_df = database.load_data('logs')
    users = database.load_data('users')
    
    if logs_df.empty:
        return jsonify([])
        
    ticket_logs = logs_df[logs_df['ticket_id'].astype(str) == str(ticket_id)]
    ticket_logs = ticket_logs.where(pd.notnull(ticket_logs), None)
    
    # INTERCEPT AND FORMAT LOG USERS
    logs_data = ticket_logs.to_dict(orient='records')
    for r in logs_data:
        r['user'] = get_user_display(r.get('user'), users)
        
    return jsonify(logs_data), 200

@ticket_bp.route('/api/tickets/create', methods=['POST'])
def create_ticket():
    data = request.form
    file = request.files.get('attachment')
    
    tickets = database.load_data('tickets')
    rules = database.load_data('master') 
    rr_pointer = database.load_data('rr_pointer')
    grade_rules = database.load_data('grade_rules') 
    users = database.load_data('users')
    
    dept = data.get('dept')
    issue = data.get('issue')
    location = data.get('location') 
    raiser_email = data.get('raiser_email')
    
    rule_match = rules[(rules['department'] == dept) & (rules['issue_type'] == issue) & (rules['outlet'] == location)]
    if rule_match.empty:
        rule_match = rules[(rules['department'] == dept) & (rules['issue_type'] == issue)]
    
    base_priority = 3
    deadline_hours = int(data.get('deadline_hours', 24))
    assigned_solver = 'Unassigned'
    
    if not rule_match.empty:
        try:
            bp_val = rule_match.iloc[0].get('base_priority')
            if pd.notnull(bp_val) and str(bp_val).strip() != '':
                base_priority = int(float(bp_val))
        except (ValueError, TypeError):
            pass 
            
        try:
            dl_val = rule_match.iloc[0].get('deadline_hours')
            if pd.notnull(dl_val) and str(dl_val).strip() != '':
                deadline_hours = int(float(dl_val))
        except (ValueError, TypeError):
            pass
            
        assigned_solvers_raw = str(rule_match.iloc[0]['assigned_solver'])
        if assigned_solvers_raw.lower() != 'nan' and assigned_solvers_raw.strip():
            solvers = [s.strip() for s in assigned_solvers_raw.split(',') if s.strip()]
            
            if len(solvers) == 1:
                assigned_solver = solvers[0] 
            elif len(solvers) > 1:
                issue_key = f"{dept}_{issue}_{location}"
                active_tickets = tickets[tickets['status'] != 'Closed']
                load_map = active_tickets['assigned_to'].value_counts().to_dict()
                min_load = min(load_map.get(s, 0) for s in solvers)
                tied_candidates = [s for s in solvers if load_map.get(s, 0) == min_load]
                
                if rr_pointer.empty or 'issue_key' not in rr_pointer.columns:
                    rr_pointer = pd.DataFrame(columns=['issue_key', 'index'])
                
                if issue_key in rr_pointer['issue_key'].values:
                    idx = int(rr_pointer.loc[rr_pointer['issue_key'] == issue_key, 'index'].values[0])
                else:
                    idx = 0
                    
                assigned_solver = tied_candidates[idx % len(tied_candidates)]
                
                if issue_key in rr_pointer['issue_key'].values:
                    rr_pointer.loc[rr_pointer['issue_key'] == issue_key, 'index'] = idx + 1
                else:
                    new_row = pd.DataFrame([{'issue_key': issue_key, 'index': idx + 1}])
                    rr_pointer = pd.concat([rr_pointer, new_row], ignore_index=True)
                database.save_data(rr_pointer, 'rr_pointer')
    
    # --- STORAGE FIX: FORCE EMPLOYEE ID FOR DATABASE ---
    assigned_solver_emp_id = get_user_emp_id(assigned_solver, users)
    assigned_solver_email = get_user_email(assigned_solver, users)
        
    user_grade_str = data.get('user_grade', 'HSP01')
    try:
        # Support HSP01 to HSP18. Also keep L- support just in case old data exists.
        grade_num = int(user_grade_str.upper().replace('HSP', '').replace('L', '').replace('-', ''))
    except ValueError:
        grade_num = 1
        
    grade_score = 1
    if not grade_rules.empty:
        try:
            g_from = pd.to_numeric(grade_rules['grade_from'], errors='coerce')
            g_to = pd.to_numeric(grade_rules['grade_to'], errors='coerce')
            match_grade = grade_rules[(g_from <= grade_num) & (g_to >= grade_num)]
            if not match_grade.empty:
                gp_val = match_grade.iloc[0]['points']
                if pd.notnull(gp_val):
                    grade_score = int(float(gp_val))
        except Exception:
            pass
            
    grade_score = max(1, min(5, grade_score))

    critical_rating = int(data.get('critical_rating', 0))
    total_score = base_priority + grade_score + critical_rating

    new_tid = 1000
    if not tickets.empty and 'ticket_id' in tickets.columns:
        for val in tickets['ticket_id'].values:
            try:
                numeric_val = int(float(val))
                if numeric_val > new_tid:
                    new_tid = numeric_val
            except:
                pass
    new_tid += 1
    deadline = (datetime.now() + pd.Timedelta(hours=deadline_hours)).strftime("%d-%m-%Y %H:%M")
    
    filename = ""
    if file and file.filename != '':
        safe_name = secure_filename(file.filename)
        filename = f"ticket_{new_tid}_{safe_name}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        compress_image(filepath)
    
    new_ticket = {
        'ticket_id': new_tid,
        'raiser_email': raiser_email,
        'dept_assigned': dept,
        'issue_type': issue,
        'description': data.get('description'),
        'base_priority': base_priority,
        'user_grade_points': grade_score,
        'critical_user_rating': critical_rating,
        'total_score': total_score,
        'status': 'Open',
        'assigned_to': assigned_solver_emp_id, # STORE AS ID
        'location': location,
        'timestamp': datetime.now().strftime("%d-%m-%Y %H:%M"),
        'deadline': deadline,
        'attachment': filename,
        'solver_notified': False, 'depthead_notified': False, 
        'last_escalation_time': deadline,
        'solver_resolution_hours': '', 'solver_delay_hours': '', 'closure_delay_hours': '',
        'ticket_age_hours': 0, 'total_turnaround_hours': '', 'SLA_Breach': False,
        'closure_type': '', 'reassign_requested_to': '', 'reassign_reason': ''
    }
    
    new_df = pd.DataFrame([new_ticket])
    database.save_data(pd.concat([tickets, new_df], ignore_index=True), 'tickets')

    database.log_ticket_action(new_tid, raiser_email, "Created Ticket", f"Score: {total_score}", data.get('description', ''), attachment=filename)
    
    # Omni-Notifications for Ticket Creation
    database.create_notification(raiser_email, f"Success: Your Ticket #{new_tid} has been raised.", role_context='Requestor', ticket_id=new_tid)
    if assigned_solver_email and assigned_solver_email != 'Unassigned':
        database.create_notification(assigned_solver_email, f"Action Required: New Ticket #{new_tid} assigned to you.", role_context='Solver', ticket_id=new_tid)
        
    if not users.empty:
        raiser_row = users[users['email'] == raiser_email]
        if not raiser_row.empty:
            manager_emp_id = raiser_row.iloc[0].get('manager')
            manager_email = get_user_email(manager_emp_id, users)
            if manager_email:
                database.create_notification(manager_email, f"FYI: Your team member ({raiser_email}) raised Ticket #{new_tid}.", role_context='Superadmin', ticket_id=new_tid)
    
    assigned_to_display = get_user_display(assigned_solver_emp_id, users)
    
    return jsonify({
        "message": "Ticket created successfully", 
        "ticket_id": new_tid, 
        "assigned_to": assigned_solver_emp_id,
        "assigned_to_display": assigned_to_display
    }), 201


@ticket_bp.route('/api/tickets/update_status', methods=['POST'])
def update_ticket_status():
    if request.is_json:
        data = request.json
        file = None
    else:
        data = request.form
        file = request.files.get('file')
        
    ticket_id = str(data.get('ticket_id')) if data.get('ticket_id') else None
    new_status = data.get('status')
    remarks = data.get('remarks', '')
    rating = data.get('rating')
    
    tickets = database.load_data('tickets')
    users = database.load_data('users')
    
    tickets['ticket_id'] = tickets['ticket_id'].astype(str)
    
    if ticket_id not in tickets['ticket_id'].values:
        return jsonify({"error": "Ticket not found"}), 404
        
    requestor_raw = tickets.loc[tickets['ticket_id'] == ticket_id, 'raiser_email'].values[0]
    solver_raw = tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'].values[0] # This is the Employee ID
    dept = tickets.loc[tickets['ticket_id'] == ticket_id, 'dept_assigned'].values[0]
    
    requestor = get_user_email(requestor_raw, users) or requestor_raw
    solver = get_user_email(solver_raw, users) or solver_raw
    
    # Record action by ID in log
    old_status = str(tickets.loc[tickets['ticket_id'] == ticket_id, 'status'].values[0])
    action_by = requestor_raw if new_status in ['Closed', 'Reopened'] else solver_raw
    actual_status = new_status
    
    if new_status == 'Decline':
        actual_status = 'Closed'
        tickets.loc[tickets['ticket_id'] == ticket_id, 'closure_type'] = 'Declined'
        tickets.loc[tickets['ticket_id'] == ticket_id, 'closed_timestamp'] = datetime.now().strftime("%d-%m-%Y %H:%M")
        tickets.loc[tickets['ticket_id'] == ticket_id, 'solver_comments'] = remarks
        
    elif new_status == 'Reopened':
        actual_status = 'In Progress'
        tickets.loc[tickets['ticket_id'] == ticket_id, 'closure_type'] = ''
        tickets.loc[tickets['ticket_id'] == ticket_id, 'closed_timestamp'] = ''
        tickets.loc[tickets['ticket_id'] == ticket_id, 'solved_timestamp'] = ''
        tickets.loc[tickets['ticket_id'] == ticket_id, 'solver_comments'] = ''
        
        issue = tickets.loc[tickets['ticket_id'] == ticket_id, 'issue_type'].values[0]
        location = tickets.loc[tickets['ticket_id'] == ticket_id, 'location'].values[0]
        
        rules = database.load_data('master')
        rule_match = rules[
            (rules['department'].astype(str).str.strip().str.lower() == str(dept).strip().lower()) & 
            (rules['issue_type'].astype(str).str.strip().str.lower() == str(issue).strip().lower()) & 
            (rules['outlet'].astype(str).str.strip().str.lower() == str(location).strip().lower())
        ]
        if rule_match.empty:
            rule_match = rules[
                (rules['department'].astype(str).str.strip().str.lower() == str(dept).strip().lower()) & 
                (rules['issue_type'].astype(str).str.strip().str.lower() == str(issue).strip().lower())
            ]
            
        deadline_hours = 24
        if not rule_match.empty:
            try:
                dl_val = rule_match.iloc[0].get('deadline_hours')
                if pd.notnull(dl_val) and str(dl_val).strip() != '':
                    deadline_hours = int(float(dl_val))
            except:
                pass
                
        new_deadline = (datetime.now() + pd.Timedelta(hours=deadline_hours)).strftime("%d-%m-%Y %H:%M")
        tickets.loc[tickets['ticket_id'] == ticket_id, 'deadline'] = new_deadline
        tickets.loc[tickets['ticket_id'] == ticket_id, 'last_escalation_time'] = new_deadline
        
    elif new_status == 'Resolved':
        tickets.loc[tickets['ticket_id'] == ticket_id, 'solved_timestamp'] = datetime.now().strftime("%d-%m-%Y %H:%M")
        tickets.loc[tickets['ticket_id'] == ticket_id, 'solver_comments'] = remarks
        
    elif new_status == 'Closed':
        tickets.loc[tickets['ticket_id'] == ticket_id, 'closed_timestamp'] = datetime.now().strftime("%d-%m-%Y %H:%M")
        tickets.loc[tickets['ticket_id'] == ticket_id, 'closure_type'] = 'Accepted'
        if rating:
            tickets.loc[tickets['ticket_id'] == ticket_id, 'raiser_rating_solver'] = int(rating)
            tickets.loc[tickets['ticket_id'] == ticket_id, 'raiser_rating_remark'] = remarks
            
    elif new_status == 'In Progress':
        tickets.loc[tickets['ticket_id'] == ticket_id, 'solver_comments'] = remarks

    tickets.loc[tickets['ticket_id'] == ticket_id, 'status'] = actual_status
    database.save_data(tickets, 'tickets')
    
    filename = None
    if file and file.filename != '':
        safe_name = secure_filename(file.filename)
        filename = f"log_{ticket_id}_{datetime.now().strftime('%H%M%S')}_{safe_name}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        compress_image(filepath)
    
    log_action_title = "Status Update"
    log_action_desc = f"To {new_status} (State: {actual_status})"
        
    database.log_ticket_action(ticket_id, action_by, log_action_title, log_action_desc, remarks, attachment=filename)
    
    manager_email = None
    if not users.empty:
        requestor_row = users[users['email'] == requestor]
        if not requestor_row.empty:
            manager_emp_id = requestor_row.iloc[0].get('manager')
            manager_email = get_user_email(manager_emp_id, users)
                
    dept_head_email = None
    if not users.empty:
        dept_head_row = users[(users['department'] == dept) & (users['role'].str.contains('Dept', case=False, na=False))]
        if not dept_head_row.empty:
            dept_head_email = dept_head_row.iloc[0].get('email')

    notified_emails = set()
    def send_omni_notification(email, message, role_context='System'):
        if email and pd.notnull(email) and email not in notified_emails:
            database.create_notification(email, message, role_context=role_context, ticket_id=ticket_id)
            notified_emails.add(email)

    if new_status == 'Resolved':
        send_omni_notification(requestor, f"Action Required: Ticket #{ticket_id} has been Resolved! Please review and Accept.", role_context='Requestor')
        send_omni_notification(manager_email, f"FYI: Your team member's Ticket #{ticket_id} has been Resolved.", role_context='Superadmin')
        send_omni_notification(dept_head_email, f"FYI: Ticket #{ticket_id} in your department was Resolved.", role_context='Admin')
    elif new_status == 'Closed':
        send_omni_notification(solver, f"Ticket #{ticket_id} was Accepted and Closed by the requestor.", role_context='Solver')
    elif new_status == 'Decline':
        send_omni_notification(requestor, f"Alert: Ticket #{ticket_id} was DECLINED and Closed. Reason: {remarks}", role_context='Requestor')
    elif new_status == 'Reopened':
        send_omni_notification(solver, f"Action Required: Ticket #{ticket_id} was REOPENED. Reason: {remarks}", role_context='Solver')
        send_omni_notification(manager_email, f"FYI: Your team member's Ticket #{ticket_id} was Reopened.", role_context='Superadmin')
        send_omni_notification(dept_head_email, f"Escalation FYI: Ticket #{ticket_id} in your department was Reopened.", role_context='Admin')
    else:
        send_omni_notification(requestor, f"Ticket #{ticket_id} status updated to: {actual_status}.", role_context='Requestor')
    
    return jsonify({"message": "Ticket updated successfully"}), 200

@ticket_bp.route('/api/tickets/handover', methods=['POST', 'OPTIONS'])
def request_handover():
    
    # 2. Instantly catch and approve the browser's CORS preflight check
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    ticket_id = str(data.get('ticket_id'))
    target_id = data.get('target_email') 
    reason = data.get('reason')

    tickets = database.load_data('tickets')
    users = database.load_data('users')
    
    tickets['ticket_id'] = tickets['ticket_id'].astype(str)
    
    if ticket_id not in tickets['ticket_id'].values:
        return jsonify({"error": "Ticket not found"}), 404

    # STORE AS EMP ID
    target_emp_id = get_user_emp_id(target_id, users)
    
    tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_requested_to'] = target_emp_id
    tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_reason'] = reason

    database.save_data(tickets, 'tickets')

    solver_raw = tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'].values[0]
    solver_email = get_user_email(solver_raw, users) or solver_raw
    dept = tickets.loc[tickets['ticket_id'] == ticket_id, 'dept_assigned'].values[0]
    
    dept_head_row = users[(users['department'] == dept) & (users['role'].str.contains('Dept', case=False, na=False))]
    if not dept_head_row.empty:
        dept_head_email = dept_head_row.iloc[0].get('email')
        database.create_notification(dept_head_email, f"Action Required: Handover Request from {solver_email} for Ticket #{ticket_id}.", role_context='Admin', ticket_id=ticket_id)

    database.log_ticket_action(ticket_id, solver_raw, "Handover Requested", f"Target: {target_emp_id}", reason)

    return jsonify({"message": "Handover requested successfully"}), 200


@ticket_bp.route('/api/tickets/rate-requestor', methods=['POST'])
def rate_requestor():
    data = request.json
    ticket_id = str(data.get('ticket_id'))
    rating = data.get('rating')
    remark = data.get('remark')

    tickets = database.load_data('tickets')
    users = database.load_data('users')
    
    tickets['ticket_id'] = tickets['ticket_id'].astype(str)
    
    if ticket_id not in tickets['ticket_id'].values:
        return jsonify({"error": "Ticket not found"}), 404

    tickets.loc[tickets['ticket_id'] == ticket_id, 'solver_rating_raiser'] = rating
    tickets.loc[tickets['ticket_id'] == ticket_id, 'solver_rating_remark'] = remark

    database.save_data(tickets, 'tickets')
    
    solver_raw = tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'].values[0]
    database.log_ticket_action(ticket_id, solver_raw, "Rated Requestor", f"Rating: {rating}/5", remark)

    return jsonify({"message": "Requestor rated successfully"}), 200


@ticket_bp.route('/api/reports/ageing', methods=['GET'])
def get_ageing_report():
    """Generates the full Ageing Report Data."""
    dept = request.args.get('dept')
    report_data = database.generate_full_ageing_report()
    users = database.load_data('users')
    
    if dept and dept not in ['undefined', 'null', '']:
        report_data = [t for t in report_data if t.get('dept_assigned') == dept]
        
    # INTERCEPT AND FORMAT
    for r in report_data:
        r['assigned_to'] = get_user_display(r.get('assigned_to'), users)
        
    return jsonify(report_data), 200

# ==========================================
# --- NOTIFICATION ROUTES ---
# ==========================================

@ticket_bp.route('/api/notifications', methods=['GET'])
def get_user_notifications_query():
    email = request.args.get('email')
    notifs = database.load_data('notifications')
    if notifs.empty or email is None:
        return jsonify([])
        
    users = database.load_data('users')
    emp_id = None
    if not users.empty:
        user_match = users[users['email'] == email]
        if not user_match.empty:
            emp_id = str(user_match.iloc[0]['employee_id'])
            
    if emp_id:
        user_notifs = notifs[(notifs['user_email'] == email) | (notifs['user_email'].astype(str) == emp_id)]
    else:
        user_notifs = notifs[notifs['user_email'] == email]
        
    if 'is_read' in user_notifs.columns:
        user_notifs['is_read'] = user_notifs['is_read'].apply(lambda x: str(x).lower() in ['true', '1', 'yes'])
        
    user_notifs = user_notifs.where(pd.notnull(user_notifs), None)
    return jsonify(user_notifs.to_dict(orient='records')), 200

@ticket_bp.route('/api/notifications/<email>', methods=['GET'])
def get_user_notifications_path(email):
    notifs = database.load_data('notifications')
    if notifs.empty:
        return jsonify([])
        
    users = database.load_data('users')
    emp_id = None
    if not users.empty:
        user_match = users[users['email'] == email]
        if not user_match.empty:
            emp_id = str(user_match.iloc[0]['employee_id'])
            
    if emp_id:
        user_notifs = notifs[(notifs['user_email'] == email) | (notifs['user_email'].astype(str) == emp_id)]
    else:
        user_notifs = notifs[notifs['user_email'] == email]
        
    if 'is_read' in user_notifs.columns:
        user_notifs['is_read'] = user_notifs['is_read'].apply(lambda x: str(x).lower() in ['true', '1', 'yes'])
        
    user_notifs = user_notifs.where(pd.notnull(user_notifs), None)
    return jsonify(user_notifs.to_dict(orient='records')), 200

@ticket_bp.route('/api/notifications/mark-read', methods=['POST'])
@ticket_bp.route('/api/notifications/read', methods=['POST'])
def mark_notif_read():
    data = request.json
    notif_id = data.get('notif_id')
    notifs = database.load_data('notifications')
    if notifs.empty or notif_id not in notifs['notif_id'].values:
        return jsonify({"error": "Not found"}), 404
    notifs.loc[notifs['notif_id'] == notif_id, 'is_read'] = 'True'
    database.save_data(notifs, 'notifications')
    return jsonify({"message": "Success"}), 200

@ticket_bp.route('/api/notifications/mark-all-read', methods=['POST'])
@ticket_bp.route('/api/notifications/read-all', methods=['POST'])
def mark_all_read():
    data = request.json
    email = data.get('email')
    notifs = database.load_data('notifications')
    if notifs.empty or email is None:
        return jsonify({"message": "Success"}), 200
        
    users = database.load_data('users')
    emp_id = None
    if not users.empty:
        user_match = users[users['email'] == email]
        if not user_match.empty:
            emp_id = str(user_match.iloc[0]['employee_id'])
            
    if emp_id:
        notifs.loc[(notifs['user_email'] == email) | (notifs['user_email'].astype(str) == emp_id), 'is_read'] = 'True'
    else:
        notifs.loc[notifs['user_email'] == email, 'is_read'] = 'True'
        
    database.save_data(notifs, 'notifications')
    return jsonify({"message": "Success"}), 200

@ticket_bp.route('/api/tickets/chat', methods=['POST', 'OPTIONS'])
def add_ticket_chat():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    if request.is_json:
        data = request.json
        file = None
    else:
        data = request.form
        file = request.files.get('file')
        
    ticket_id = data.get('ticket_id')
    user_email = data.get('user_email')
    message = data.get('message')
    
    filename = None
    if file and file.filename != '':
        safe_name = secure_filename(file.filename)
        filename = f"chat_{ticket_id}_{datetime.now().strftime('%H%M%S')}_{safe_name}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        compress_image(filepath)
    
    # Save the message into the audit logs with the action "Chat"
    database.log_ticket_action(ticket_id, user_email, "Chat", "User Message", message, attachment=filename)
    
    return jsonify({"message": "Chat message saved successfully"}), 200