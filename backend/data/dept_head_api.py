from flask import Blueprint, request, jsonify
import pandas as pd
from datetime import datetime
import database

dept_head_bp = Blueprint('dept_head', __name__)

@dept_head_bp.route('/api/dept/<dept_name>/overview', methods=['GET'])
def get_dept_overview(dept_name):
    tickets = database.load_data('tickets')
    
    # Force strict space-stripping and lowercase matching
    clean_target_dept = str(dept_name).strip().lower()
    clean_db_depts = tickets['dept_assigned'].astype(str).str.strip().str.lower()
    dept_tickets = tickets[clean_db_depts == clean_target_dept].copy()
    
    total = len(dept_tickets)
    
    # FIX FOR THE CRASH: Force total_score to be numeric before checking >= 10
    dept_tickets['total_score'] = pd.to_numeric(dept_tickets['total_score'], errors='coerce').fillna(0)
    critical = len(dept_tickets[dept_tickets['total_score'] >= 10])
    
    clean_status = dept_tickets['status'].astype(str).str.strip().str.title()
    open_tickets = len(dept_tickets[clean_status.isin(['Open', 'Unassigned'])])
    
    dept_tickets = dept_tickets.where(pd.notnull(dept_tickets), None)
    return jsonify({"metrics": {"total": total, "critical": critical, "open": open_tickets}, "tickets": dept_tickets.to_dict(orient='records')}), 200

@dept_head_bp.route('/api/dept/<dept_name>/pending-approvals', methods=['GET'])
def get_pending_approvals(dept_name):
    tickets = database.load_data('tickets')
    
    clean_target_dept = str(dept_name).strip().lower()
    clean_db_depts = tickets['dept_assigned'].astype(str).str.strip().str.lower()
    
    tickets['reassign_requested_to'] = tickets['reassign_requested_to'].fillna("").astype(str)
    pending = tickets[(clean_db_depts == clean_target_dept) & (tickets['reassign_requested_to'].str.strip() != "") & (tickets['reassign_requested_to'].str.lower() != "nan")]
    pending = pending.where(pd.notnull(pending), None)
    return jsonify(pending.to_dict(orient='records')), 200

@dept_head_bp.route('/api/dept/approve-transfer', methods=['POST', 'OPTIONS'])
def processTransfer():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json
    raw_ticket_id = data.get('ticket_id')
    action = data.get('action') 
    
    # 1. Safely parse incoming ticket ID as a clean integer
    try:
        ticket_id = int(float(str(raw_ticket_id).strip()))
    except (ValueError, TypeError):
        return jsonify({"error": f"Invalid Ticket ID format: {raw_ticket_id}"}), 400
    
    tickets = database.load_data('tickets')
    
    # 2. Coerce the database ID column to numeric to prevent float-vs-int type mismatches
    tickets['ticket_id'] = pd.to_numeric(tickets['ticket_id'], errors='coerce')
    
    # 3. Filter rows safely using a localized dataframe match
    ticket_match = tickets[tickets['ticket_id'] == ticket_id]
    
    if ticket_match.empty:
        return jsonify({"error": f"Ticket #{ticket_id} could not be located in database records"}), 404
        
    # 4. Extract parameters using safe series indexing (.iloc[0]) instead of dangerous .values[0]
    old_solver = ticket_match.iloc[0].get('assigned_to', 'Unassigned')
    requestor = ticket_match.iloc[0].get('raiser_email', '')
    target = ticket_match.iloc[0].get('reassign_requested_to', '')

    if action == 'approve':
        if not target or str(target).lower() == 'nan':
            return jsonify({"error": "No handover target exists for this ticket request"}), 400
            
        users = database.load_data('users')
        target_user = users[users['employee_id'].astype(str) == str(target).replace('.0', '')]
        if target_user.empty:
            target_user = users[users['email'] == target]
            
        if not target_user.empty:
            target_name = target_user.iloc[0].get('name', target)
            target_phone = target_user.iloc[0].get('phone_no', '')
            display_str = f"{target_name} ({target_phone})" if target_phone else target_name
        else:
            display_str = target
            
        tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'] = target
        database.log_ticket_action(ticket_id, "Dept Head", "Transfer Approved", f"Moved to {display_str}", "Approved by Dept Head")
        database.create_notification(target, f"Ticket #{ticket_id} has been transferred to you.", ticket_id=ticket_id)
        database.create_notification(old_solver, f"Your transfer request for Ticket #{ticket_id} was approved.", ticket_id=ticket_id)
        database.create_notification(requestor, f"Update: Ticket #{ticket_id} has been reassigned to a new solver.", ticket_id=ticket_id)
    else:
        users = database.load_data('users')
        target_user = users[users['employee_id'].astype(str) == str(target).replace('.0', '')]
        if target_user.empty:
            target_user = users[users['email'] == target]
            
        if not target_user.empty:
            target_name = target_user.iloc[0].get('name', target)
            target_phone = target_user.iloc[0].get('phone_no', '')
            display_str = f"{target_name} ({target_phone})" if target_phone else target_name
        else:
            display_str = target
            
        database.log_ticket_action(ticket_id, "Dept Head", "Transfer Rejected", f"Target was {display_str}", "Rejected by Dept Head")
        database.create_notification(old_solver, f"Your transfer request for Ticket #{ticket_id} was REJECTED by your Dept Head.", ticket_id=ticket_id)
        
    # Clean out old request flags cleanly
    tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_requested_to'] = ""
    tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_reason'] = ""
    
    database.save_data(tickets, 'tickets')
    return jsonify({"message": f"Transfer {action}d successfully"}), 200
""" @dept_head_bp.route('/api/dept/approve-transfer', methods=['POST', 'OPTIONS'])
def processTransfer():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    ticket_id = data.get('ticket_id')
    action = data.get('action') 
    
    tickets = database.load_data('tickets')
    if ticket_id not in tickets['ticket_id'].values:
        return jsonify({"error": "Ticket not found"}), 404
        
    old_solver = tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'].values[0]
    requestor = tickets.loc[tickets['ticket_id'] == ticket_id, 'raiser_email'].values[0]
    target = tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_requested_to'].values[0]

    if action == 'approve':
        tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'] = target
        database.log_ticket_action(ticket_id, "Dept Head", "Transfer Approved", f"Moved to {target}", "Approved by Dept Head")
        database.create_notification(target, f"Ticket #{ticket_id} has been transferred to you.", ticket_id=ticket_id)
        database.create_notification(old_solver, f"Your transfer request for Ticket #{ticket_id} was approved.", ticket_id=ticket_id)
        database.create_notification(requestor, f"Update: Ticket #{ticket_id} has been reassigned to a new solver.", ticket_id=ticket_id)
    else:
        database.log_ticket_action(ticket_id, "Dept Head", "Transfer Rejected", f"Target was {target}", "Rejected by Dept Head")
        database.create_notification(old_solver, f"Your transfer request for Ticket #{ticket_id} was REJECTED by your Dept Head.", ticket_id=ticket_id)
        
    tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_requested_to'] = ""
    tickets.loc[tickets['ticket_id'] == ticket_id, 'reassign_reason'] = ""
    
    database.save_data(tickets, 'tickets')
    return jsonify({"message": f"Transfer {action}d successfully"}), 200
 """
@dept_head_bp.route('/api/dept/reassign', methods=['POST', 'OPTIONS'])
def force_reassign():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    ticket_id = data.get('ticket_id')
    new_assignee = data.get('new_assignee')
    
    tickets = database.load_data('tickets')
    old_solver = tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'].values[0]
    requestor = tickets.loc[tickets['ticket_id'] == ticket_id, 'raiser_email'].values[0]
    
    tickets.loc[tickets['ticket_id'] == ticket_id, 'assigned_to'] = new_assignee
    database.save_data(tickets, 'tickets')
    
    users = database.load_data('users')
    target_user = users[users['employee_id'].astype(str) == str(new_assignee).replace('.0', '')]
    if target_user.empty:
        target_user = users[users['email'] == new_assignee]
        
    if not target_user.empty:
        target_name = target_user.iloc[0].get('name', new_assignee)
        target_phone = target_user.iloc[0].get('phone_no', '')
        display_str = f"{target_name} ({target_phone})" if target_phone else target_name
    else:
        display_str = new_assignee
        
    database.log_ticket_action(ticket_id, "Dept Head", "Manager Override", f"Transferred to {display_str}", "Force Reassign")
    database.create_notification(new_assignee, f"Ticket #{ticket_id} has been forcefully assigned to you by the Dept Head.", ticket_id=ticket_id)
    database.create_notification(old_solver, f"Ticket #{ticket_id} was reassigned away from you by your Dept Head.", ticket_id=ticket_id)
    database.create_notification(requestor, f"Update: Ticket #{ticket_id} has been escalated/reassigned to a new solver.", ticket_id=ticket_id)
    
    return jsonify({"message": "Ticket forcefully reassigned."}), 200


@dept_head_bp.route('/api/dept/rules/update', methods=['POST', 'OPTIONS'])
def update_master_rule():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json
    rules = database.load_data('master')
    
    # 1. Clean the incoming matching parameters
    old_dept = str(data.get('original_department', data.get('department'))).strip().lower()
    old_issue = str(data.get('original_issue_type', data.get('issue_type'))).strip().lower()
    old_outlet = str(data.get('original_outlet', data.get('outlet', ''))).strip().lower()
    if old_outlet == 'nan' or old_outlet == 'null': old_outlet = ''
    
    # 2. Find the Exact Rule
    mask = (
        (rules['department'].astype(str).str.strip().str.lower() == old_dept) &
        (rules['issue_type'].astype(str).str.strip().str.lower() == old_issue)
    )
    
    # Apply outlet mask only if an outlet is provided, otherwise look for global rules
    if old_outlet:
        mask = mask & (rules['outlet'].astype(str).str.strip().str.lower() == old_outlet)
    else:
        mask = mask & (rules['outlet'].isna() | (rules['outlet'].astype(str).str.strip() == '') | (rules['outlet'].astype(str).str.strip().str.lower() == 'nan'))
    
    # 3. Extract the update values
    base_priority = str(data.get('base_priority', 3))
    deadline_hours = str(data.get('deadline_hours', 24))
    assigned_solver = str(data.get('assigned_solver', ''))
    
    # If the rule exists, UPDATE it.
    if mask.any():
        idx = rules[mask].index[0]
        rules.at[idx, 'department'] = str(data.get('department', ''))
        rules.at[idx, 'issue_type'] = str(data.get('issue_type', ''))
        rules.at[idx, 'outlet'] = str(data.get('outlet', ''))
        rules.at[idx, 'base_priority'] = base_priority
        rules.at[idx, 'deadline_hours'] = deadline_hours
        rules.at[idx, 'assigned_solver'] = assigned_solver
    # If the rule does not exist, ADD it.
    else:
        new_rule = {
            'department': data.get('department', ''),
            'issue_type': data.get('issue_type', ''),
            'outlet': data.get('outlet', ''),
            'base_priority': base_priority,
            'assigned_solver': assigned_solver,
            'deadline_hours': deadline_hours
        }
        rules = pd.concat([rules, pd.DataFrame([new_rule])], ignore_index=True)
        
    database.save_data(rules, 'master')
    
    return jsonify({"message": "Rule saved successfully"}), 200