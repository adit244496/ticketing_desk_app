import pandas as pd
import os
import threading
from datetime import datetime
import numpy as np
from sqlalchemy import create_engine
from dotenv import load_dotenv
import urllib.parse
import email_utils
import queue
import time

email_queue = queue.Queue()

def _email_worker():
    while True:
        try:
            task = email_queue.get()
            if task is None:
                break
            
            user_email, message, role_context, ticket_id = task
            
            ticket_details = None
            attachment_filepath = None
            if ticket_id:
                tickets_df = load_data('tickets')
                if not tickets_df.empty:
                    match = tickets_df[tickets_df['ticket_id'].astype(str) == str(ticket_id)]
                    if not match.empty:
                        t = match.iloc[0]
                        ticket_details = {
                            "Ticket ID": t.get('ticket_id', ''),
                            "Status": t.get('status', ''),
                            "Issue": t.get('issue_type', ''),
                            "Description": t.get('description', ''),
                            "Raised By": t.get('raiser_email', ''),
                            "Assigned To": t.get('assigned_to', '')
                        }
                        att = t.get('attachment')
                        if pd.notnull(att) and str(att).strip() and str(att).strip().lower() != 'nan':
                            attachment_filepath = os.path.join(os.getcwd(), 'uploads', str(att).strip())
            
            subject = f"Notification from Ambuja Desk: {role_context}"
            
            # Send the email
            email_utils.send_ticket_email(
                to_email=user_email,
                subject=subject,
                message_body=message,
                ticket_details=ticket_details,
                attachment_filepath=attachment_filepath
            )
            
            # Sleep briefly to respect Outlook SMTP rate limits
            time.sleep(2)
            
        except Exception as e:
            print(f"Error in email worker: {e}")
        finally:
            email_queue.task_done()

threading.Thread(target=_email_worker, daemon=True).start()

load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "hospi_desk")

encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

def load_data(table_name):
    try:
        df = pd.read_sql_table(table_name, engine)
        
        if table_name == 'tickets' and not df.empty and 'total_score' in df.columns:
            df['total_score'] = pd.to_numeric(df['total_score'], errors='coerce').fillna(0).astype(int)
            df = df.sort_values(by='total_score', ascending=False).reset_index(drop=True)
            
        if table_name == 'users' and not df.empty and 'critical_user_rating' in df.columns:
            df['critical_user_rating'] = pd.to_numeric(df['critical_user_rating'], errors='coerce').fillna(0.0)

        df = df.replace({np.nan: None})
        if table_name in ['users', 'master', 'locations']:
            df.rename(columns=lambda x: str(x).lower().replace(" ", "_"), inplace=True)
        return df
    except Exception as e:
        print(f"Error loading table {table_name}: {e}")
        return pd.DataFrame()

def _ensure_columns(conn, table_name, df):
    from sqlalchemy import text
    if not engine.dialect.has_table(conn, table_name):
        return
    res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table_name}'"))
    existing_cols = {row[0] for row in res.fetchall()}
    if table_name == 'tickets':
        for old_col in ['raiser_rating_solver', 'raiser_rating_remark', 'solver_rating_raiser', 'solver_rating_remark', 'solver_comment', 'requestor_comment']:
            if old_col in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE tickets DROP COLUMN \"{old_col}\";"))
                except Exception:
                    pass
    for col in df.columns:
        if col not in existing_cols and col not in ['raiser_rating_solver', 'raiser_rating_remark', 'solver_rating_raiser', 'solver_rating_remark', 'solver_comment', 'requestor_comment']:
            print(f"Auto-adding missing column '{col}' to table '{table_name}'...")
            try:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN \"{col}\" TEXT;"))
            except Exception as e:
                print(f"Warning: Could not add column {col}: {e}")

def save_data(df, table_name):
    from sqlalchemy import text
    try:
        if table_name == 'users' and not df.empty and 'critical_user_rating' in df.columns:
            df['critical_user_rating'] = pd.to_numeric(df['critical_user_rating'], errors='coerce').fillna(0.0)
        with engine.begin() as conn:
            if engine.dialect.has_table(conn, table_name):
                _ensure_columns(conn, table_name, df)
                conn.execute(text(f"DELETE FROM {table_name}"))
            df.to_sql(table_name, conn, if_exists='append', index=False)
    except Exception as e:
        print(f"Error saving table {table_name}: {e}")

def append_data(df, table_name):
    try:
        with engine.begin() as conn:
            if engine.dialect.has_table(conn, table_name):
                _ensure_columns(conn, table_name, df)
            df.to_sql(table_name, conn, if_exists='append', index=False)
    except Exception as e:
        print(f"Error appending to table {table_name}: {e}")

# ==========================================
# ENTERPRISE LOGGING ENGINE
# ==========================================
def log_ticket_action(ticket_id, user_email, action, details="", remarks="", attachment=None):
    users = load_data('users')
    emp_id = user_email
    
    if user_email and str(user_email).strip().upper() != 'SYSTEM' and not users.empty:
        user_str = str(user_email).strip()
        
        if user_str.lower() == 'dept head':
            match = users[users['role'] == 'Dept. Head']
            if not match.empty:
                emp_id = str(match.iloc[0]['employee_id'])
        elif '@' in user_str:
            match = users[users['email'].str.lower() == user_str.lower()]
            if not match.empty:
                emp_id = str(match.iloc[0]['employee_id'])
        else:
            try:
                clean_id = str(int(float(user_str)))
                match = users[users['employee_id'].astype(str) == clean_id]
                if not match.empty:
                    emp_id = str(match.iloc[0]['employee_id'])
            except Exception:
                pass

    new_log = {
        'timestamp': datetime.now().strftime("%d-%m-%Y %H:%M"),
        'ticket_id': ticket_id,
        'user': emp_id,
        'action': action,
        'details': details,
        'remarks': remarks,
        'attachment': attachment
    }
    new_df = pd.DataFrame([new_log])
    append_data(new_df, 'logs')

# ==========================================
# ENTERPRISE NOTIFICATION ENGINE
# ==========================================
def create_notification(user_email, message, role_context='System', ticket_id=None):
    if not user_email or str(user_email).lower() in ['nan', 'none', 'unassigned', '']:
        return

    notifs = load_data('notifications')
    if not notifs.empty and 'notif_id' in notifs.columns:
        max_id = 10000
        for val in notifs['notif_id'].values:
            try:
                numeric_val = int(float(val))
                if numeric_val > max_id:
                    max_id = numeric_val
            except:
                pass
        new_id = max_id + 1
    else:
        new_id = 10000

    new_notif = {
        'notif_id': new_id,
        'user_email': user_email,
        'message': message,
        'is_read': False,
        'timestamp': datetime.now().strftime("%d-%m-%Y %H:%M"),
        'role_context': role_context,
        'ticket_id': ticket_id
    }
    
    new_df = pd.DataFrame([new_notif])
    append_data(new_df, 'notifications')

    # Queue Email instead of spawning new thread immediately
    email_queue.put((user_email, message, role_context, ticket_id))

# --- HELPER: GET OMNI-CHANNEL CONTACTS ---
def get_omni_contacts(requestor_email, dept_name, users_df, solver_emp_id=None):
    """Finds the Requestor's Manager, the Dept Head, and the Solver's Manager for mass notifications."""
    manager_email = None
    dept_head_email = None
    solver_manager_email = None
    
    if not users_df.empty:
        # Lookup Requestor's Manager
        if pd.notnull(requestor_email):
            requestor_row = users_df[users_df['email'] == requestor_email]
            if not requestor_row.empty:
                mgr_id = requestor_row.iloc[0].get('manager')
                if pd.notnull(mgr_id) and str(mgr_id).strip().lower() not in ['nan', '', 'none']:
                    try:
                        clean_mgr_id = str(int(float(mgr_id)))
                        manager_row = users_df[users_df['employee_id'].astype(str) == clean_mgr_id]
                        if not manager_row.empty:
                            manager_email = manager_row.iloc[0].get('email')
                    except Exception:
                        pass
                        
        # Lookup Solver's Manager
        if pd.notnull(solver_emp_id):
            try:
                clean_solver_id = str(int(float(solver_emp_id)))
                solver_row = users_df[users_df['employee_id'].astype(str) == clean_solver_id]
                if not solver_row.empty:
                    mgr_id = solver_row.iloc[0].get('manager')
                    if pd.notnull(mgr_id) and str(mgr_id).strip().lower() not in ['nan', '', 'none']:
                        clean_mgr_id = str(int(float(mgr_id)))
                        manager_row = users_df[users_df['employee_id'].astype(str) == clean_mgr_id]
                        if not manager_row.empty:
                            solver_manager_email = manager_row.iloc[0].get('email')
            except Exception:
                pass
                        
        # Lookup Dept Head
        if pd.notnull(dept_name):
            dept_head_row = users_df[(users_df['department'] == dept_name) & (users_df['role'] == 'Dept. Head')]
            if not dept_head_row.empty:
                dept_head_email = dept_head_row.iloc[0].get('email')
                
    return manager_email, dept_head_email, solver_manager_email

def send_omni_blast(emails_to_notify, message, role_context='System', ticket_id=None):
    """Sends a notification to a specific list of emails, ensuring no duplicates. Resolves employee IDs to emails if needed."""
    users = load_data('users')
    notified = set()
    for identifier in emails_to_notify:
        if not identifier or pd.isnull(identifier): continue
        email = str(identifier).strip()
        
        # If it looks like an employee ID (digits only), resolve to email
        if not '@' in email and email.replace('.','').isdigit():
            try:
                clean_id = str(int(float(email)))
                match = users[users['employee_id'].astype(str) == clean_id]
                if not match.empty:
                    email = match.iloc[0].get('email')
            except:
                pass
                
        if email and pd.notnull(email) and email not in notified:
            create_notification(email, message, role_context=role_context, ticket_id=ticket_id)
            notified.add(email)

# ==========================================
# BACKGROUND WORKERS & ANALYTICS
# ==========================================
def auto_close_resolved_tickets():
    tickets = load_data('tickets')
    if tickets.empty: return
    
    users = load_data('users')
    now = datetime.now()
    updated = False
    
    for idx, row in tickets.iterrows():
        if str(row.get('status')).lower() == 'resolved':
            solved_time = row.get('solved_timestamp')
            if pd.notnull(solved_time):
                solved_time = pd.to_datetime(solved_time, format='mixed', dayfirst=True, errors='coerce')
                if pd.notnull(solved_time):
                    hours_passed = (now - solved_time).total_seconds() / 3600
                    if hours_passed >= 24:
                        ticket_id = row.get('ticket_id')
                        requestor = row.get('raiser_email')
                        solver = row.get('assigned_to')
                        
                        tickets.at[idx, 'status'] = 'Closed'
                        tickets.at[idx, 'closed_timestamp'] = now.strftime("%d-%m-%Y %H:%M")
                        updated = True
                        
                        # LOG & MASS NOTIFY
                        log_ticket_action(ticket_id, "SYSTEM", "Auto Closed", "No response in 24 hours")
                        
                        manager_email, dept_head_email, solver_manager_email = get_omni_contacts(requestor, row.get('dept_assigned'), users, solver)
                        
                        send_omni_blast([requestor], f"System Auto-Closed: Ticket #{ticket_id} has been automatically closed after 24h of inactivity.", role_context='Requestor')
                        send_omni_blast([solver], f"System Auto-Closed: Ticket #{ticket_id} (Resolved) was automatically closed.", role_context='Solver')
                        send_omni_blast([manager_email, dept_head_email], f"FYI: Ticket #{ticket_id} was automatically closed by the system.", role_context='System')
                        
    if updated:
        save_data(tickets, 'tickets')


def auto_check_sla_breaches():
    tickets = load_data('tickets')
    if tickets.empty: return
    
    users = load_data('users')
    now = datetime.now()
    updated = False

    if 'sla_notified' not in tickets.columns:
        tickets['sla_notified'] = False

    for idx, row in tickets.iterrows():
        if str(row.get('status')).lower() in ['closed', 'resolved']: continue
        
        if row.get('sla_notified') == True or str(row.get('sla_notified')).lower() == 'true':
            continue

        deadline_val = row.get('deadline')
        if pd.isnull(deadline_val) or str(deadline_val).strip() == '': continue

        try:
            deadline_time = pd.to_datetime(deadline_val, format='mixed', dayfirst=True, errors='coerce')
            if pd.isnull(deadline_time): continue

            if now > deadline_time:
                tickets.at[idx, 'sla_notified'] = True
                updated = True
                ticket_id = row.get('ticket_id')
                requestor = row.get('raiser_email')
                solver = row.get('assigned_to')
                
                log_ticket_action(ticket_id, "SYSTEM", "SLA Breach", "Deadline exceeded", "System automatically flagged SLA breach")
                
                admin_rows = users[users['role'].isin(['Admin', 'Superadmin', 'Super Admin'])]
                admin_emails = admin_rows['email'].dropna().tolist()
                
                solver_email = None
                if pd.notnull(solver):
                    clean_solver = str(int(float(solver))) if str(solver).replace('.','',1).isdigit() else str(solver)
                    solver_row = users[users['employee_id'].astype(str) == clean_solver]
                    if not solver_row.empty:
                        solver_email = solver_row.iloc[0].get('email')
                
                req_mgr_email, dept_head_email, solver_mgr_email = get_omni_contacts(requestor, row.get('dept_assigned'), users, solver)
                
                to_notify = [requestor]
                if solver_email: to_notify.append(solver_email)
                if req_mgr_email: to_notify.append(req_mgr_email)
                if dept_head_email: to_notify.append(dept_head_email)
                if solver_mgr_email: to_notify.append(solver_mgr_email)
                to_notify.extend(admin_emails)
                
                send_omni_blast(to_notify, f"URGENT SLA Breach: Ticket #{ticket_id} has exceeded its resolution deadline!", role_context='System', ticket_id=ticket_id)
        except Exception:
            pass
            
    if updated:
        save_data(tickets, 'tickets')


def escalate_open_tickets():
    tickets = load_data('tickets')
    if tickets.empty: return

    users = load_data('users')
    now = datetime.now()
    updated = False

    if 'last_open_escalation_time' not in tickets.columns:
        tickets['last_open_escalation_time'] = tickets['timestamp']

    for idx, row in tickets.iterrows():
        if str(row.get('status')).lower() != 'open': continue

        last_time_val = row.get('last_open_escalation_time')
        if pd.isnull(last_time_val) or str(last_time_val).strip() in ['', 'nan']:
            last_time_val = row.get('timestamp')
            
        try:
            last_time = pd.to_datetime(last_time_val, format='mixed', dayfirst=True, errors='coerce')
            if pd.isnull(last_time): continue
            
            if now > last_time:
                hours_passed = (now - last_time).total_seconds() / 3600
                increments = int(hours_passed // 2)

                if increments > 0:
                    ticket_id = row.get('ticket_id')
                    requestor = row.get('raiser_email')
                    solver = row.get('assigned_to')
                    
                    new_time = last_time + pd.Timedelta(hours=2 * increments)
                    tickets.at[idx, 'last_open_escalation_time'] = new_time.strftime("%d-%m-%Y %H:%M")
                    updated = True

                    manager_email, dept_head_email, solver_manager_email = get_omni_contacts(requestor, row.get('dept_assigned'), users, solver)
                    
                    if solver and str(solver).strip() != '' and str(solver).lower() not in ['nan', 'unassigned']:
                        send_omni_blast([solver], f"Action Required: Ticket #{ticket_id} assigned to you has been Open for {increments * 2} hours with no action taken.", role_context='Solver', ticket_id=ticket_id)
                    
                    if solver_manager_email:
                        send_omni_blast([solver_manager_email], f"Manager Alert: Ticket #{ticket_id} assigned to your team member has been Open for {increments * 2} hours with no action taken.", role_context='System', ticket_id=ticket_id)

        except Exception:
            pass

    if updated:
        save_data(tickets, 'tickets')


def escalate_overdue_tickets():
    tickets = load_data('tickets')
    if tickets.empty: return

    users = load_data('users')
    now = datetime.now()
    updated = False

    if 'last_escalation_time' not in tickets.columns:
        tickets['last_escalation_time'] = tickets['deadline']

    for idx, row in tickets.iterrows():
        if str(row.get('status')).lower() in ['closed', 'resolved']: continue

        deadline_val = row.get('deadline')
        if pd.isnull(deadline_val) or str(deadline_val).strip() == '': continue

        last_time_val = row.get('last_escalation_time')
        if pd.isnull(last_time_val) or str(last_time_val).strip() in ['', 'nan']:
            last_time_val = deadline_val

        try:
            last_time = pd.to_datetime(last_time_val, format='mixed', dayfirst=True, errors='coerce')
            if pd.isnull(last_time): continue

            if now > last_time:
                hours_passed = (now - last_time).total_seconds() / 3600
                increments = int(hours_passed // 2)

                if increments > 0:
                    ticket_id = row.get('ticket_id')
                    requestor = row.get('raiser_email')
                    solver = row.get('assigned_to')
                    
                    # 1. Update Score & Deadline
                    current_score = int(float(row.get('total_score', 0)))
                    tickets.at[idx, 'total_score'] = current_score + increments
                    
                    new_time = last_time + pd.Timedelta(hours=2 * increments)
                    tickets.at[idx, 'last_escalation_time'] = new_time.strftime("%d-%m-%Y %H:%M")
                    updated = True

                    # 2. LOG & MASS NOTIFY
                    log_ticket_action(ticket_id, "SYSTEM", "SLA Escalation", f"Severity incremented by {increments}. New Score: {current_score + increments}")
                    
                    req_manager_email, dept_head_email, solver_manager_email = get_omni_contacts(requestor, row.get('dept_assigned'), users, solver)
                    
                    send_omni_blast([solver], f"URGENT SLA Breach: Ticket #{ticket_id} has missed its deadline. Severity increased!", role_context='Solver')
                    send_omni_blast([requestor], f"Update: Ticket #{ticket_id} is taking longer than expected and has been automatically escalated.", role_context='Requestor')
                    send_omni_blast([req_manager_email], f"FYI: Ticket #{ticket_id} raised by your team member missed its SLA and escalated.", role_context='System')
                    send_omni_blast([dept_head_email], f"SLA Breach Alert: Ticket #{ticket_id} in your department missed its deadline and escalated.", role_context='System')
                    send_omni_blast([solver_manager_email], f"SLA Breach Escalation: Ticket #{ticket_id} assigned to your team member missed its deadline.", role_context='System')
                    
        except Exception:
            pass

    if updated:
        save_data(tickets, 'tickets')


def generate_full_ageing_report():
    """Calculates all delays, turnarounds, and SLA breaches for export."""
    tickets = load_data('tickets')
    if tickets.empty: return []

    for col in ['timestamp', 'solved_timestamp', 'closed_timestamp', 'deadline']:
        if col in tickets.columns:
            tickets[col] = pd.to_datetime(tickets[col], format='mixed', dayfirst=True, errors='coerce')

    now = pd.Timestamp.now()

    tickets['solver_resolution_hours'] = tickets.apply(
        lambda row: round((row['solved_timestamp'] - row['timestamp']).total_seconds()/3600, 2)
        if pd.notnull(row['solved_timestamp']) and pd.notnull(row['timestamp']) else None, axis=1
    )

    tickets['solver_delay_hours'] = tickets.apply(
        lambda row: round((now - row['timestamp']).total_seconds()/3600, 2)
        if pd.isnull(row['solved_timestamp']) and pd.notnull(row['timestamp']) else 0, axis=1
    )

    tickets['closure_delay_hours'] = tickets.apply(
        lambda row: round((row['closed_timestamp'] - row['solved_timestamp']).total_seconds()/3600, 2)
        if pd.notnull(row['closed_timestamp']) and pd.notnull(row['solved_timestamp']) else None, axis=1
    )

    tickets['ticket_age_hours'] = tickets.apply(
        lambda row: round((now - row['timestamp']).total_seconds()/3600, 2)
        if pd.notnull(row['timestamp']) else None, axis=1
    )

    tickets['total_turnaround_hours'] = tickets.apply(
        lambda row: round((row['closed_timestamp'] - row['timestamp']).total_seconds()/3600, 2)
        if pd.notnull(row['closed_timestamp']) and pd.notnull(row['timestamp']) else None, axis=1
    )

    def check_sla_breach(row):
        if pd.isnull(row['deadline']):
            return False
        
        if pd.notnull(row.get('solved_timestamp')):
            completion_time = row['solved_timestamp']
        elif pd.notnull(row.get('closed_timestamp')):
            completion_time = row['closed_timestamp']
        else:
            completion_time = now
            
        return completion_time > row['deadline']

    tickets['SLA_Breach'] = tickets.apply(check_sla_breach, axis=1)

    # Convert datetimes back to strings for JSON
    for col in ['timestamp', 'solved_timestamp', 'closed_timestamp', 'deadline']:
        if col in tickets.columns:
            tickets[col] = tickets[col].dt.strftime("%d-%m-%Y %H:%M").fillna("")
            
    tickets = tickets.replace({np.nan: None})
    return tickets.to_dict(orient='records')

# ==========================================
# DATABASE INITIALIZATION
# ==========================================
def init_db():
    import hashlib
    from sqlalchemy import create_engine, text
    
    # Ensure the database exists
    try:
        default_db_url = f"postgresql+pg8000://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/postgres"
        engine_default = create_engine(default_db_url, isolation_level="AUTOCOMMIT")
        with engine_default.connect() as conn:
            result = conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'"))
            if not result.fetchone():
                print(f"Creating database '{DB_NAME}'...")
                conn.execute(text(f"CREATE DATABASE {DB_NAME}"))
    except Exception as e:
        print(f"Warning during database creation check: {e}")

    def hash_password(password):
        return hashlib.sha256(str.encode(password)).hexdigest()

    # Initialize users table and ensure Superadmin and Admin exist
    users_df = load_data('users')
    
    default_password = hash_password("Kolkata@123")
    initial_users = []
    
    if users_df.empty or 'superadmin@ambujaneotia.com' not in users_df['email'].values:
        print("Ensuring Super Admin exists...")
        initial_users.append({
            "employee_id": "SA001",
            "email": "superadmin@ambujaneotia.com",
            "password": default_password,
            "name": "Super Admin",
            "role": "Super Admin",
            "department": "IT",
            "outlet": "HO",
            "grade": "M1",
            "phone": "9999999999",
            "critical_user_rating": 5,
            "manager": None,
            "first_login": True
        })
        
    if users_df.empty or 'admin@ambujaneotia.com' not in users_df['email'].values:
        print("Ensuring System Admin exists...")
        initial_users.append({
            "employee_id": "AD001",
            "email": "admin@ambujaneotia.com",
            "password": default_password,
            "name": "System Admin",
            "role": "Admin",
            "department": "IT",
            "outlet": "HO",
            "grade": "M1",
            "phone": "8888888888",
            "critical_user_rating": 5,
            "manager": None,
            "first_login": True
        })
        
    if initial_users:
        # Define expected user columns to ensure schema check
        user_cols = ["employee_id", "email", "password", "name", "role", "department", "outlet", "grade", "phone", "critical_user_rating", "manager", "first_login"]
        append_df = pd.DataFrame(initial_users, columns=user_cols)
        append_data(append_df, 'users')
    else:
        # Just ensure columns exist
        user_cols = ["employee_id", "email", "password", "name", "role", "department", "outlet", "grade", "phone", "critical_user_rating", "manager", "first_login"]
        append_data(pd.DataFrame(columns=user_cols), 'users')

    # Enforce schema existence (and create tables if missing) using append_data
    print("Verifying schema and tables for 'master'...")
    cols = ['department', 'issue_type', 'base_priority', 'deadline_hours', 'assigned_solver']
    append_data(pd.DataFrame(columns=cols), 'master')

    print("Verifying schema and tables for 'locations'...")
    cols = ['outlet', 'brand', 'location', 'city']
    append_data(pd.DataFrame(columns=cols), 'locations')

    print("Verifying schema and tables for 'departments'...")
    cols = ['department_name']
    append_data(pd.DataFrame(columns=cols), 'departments')

    print("Verifying schema and tables for 'tickets'...")
    cols = ['ticket_id', 'raiser_email', 'assigned_to', 'dept_assigned', 'status', 'total_score', 'deadline', 'last_escalation_time', 'timestamp', 'solved_timestamp', 'closed_timestamp', 'requestor_rating', 'requestor_rating_comment', 'solver_rating', 'solver_rating_comment']
    append_data(pd.DataFrame(columns=cols), 'tickets')

    print("Verifying schema and tables for 'logs'...")
    cols = ['timestamp', 'ticket_id', 'user', 'action', 'details', 'remarks', 'attachment']
    append_data(pd.DataFrame(columns=cols), 'logs')

    print("Verifying schema and tables for 'notifications'...")
    cols = ['notif_id', 'user_email', 'message', 'is_read', 'timestamp', 'role_context', 'ticket_id']
    append_data(pd.DataFrame(columns=cols), 'notifications')
        
    grade_rules_df = load_data('grade_rules')
    if grade_rules_df.empty:
        print("Initializing empty 'grade_rules' table with default ranges...")
        initial_rules = [
            {'grade_from': 1, 'grade_to': 3, 'points': 1},
            {'grade_from': 4, 'grade_to': 7, 'points': 2},
            {'grade_from': 8, 'grade_to': 11, 'points': 3},
            {'grade_from': 12, 'grade_to': 14, 'points': 4},
            {'grade_from': 15, 'grade_to': 18, 'points': 5}
        ]
        save_data(pd.DataFrame(initial_rules), 'grade_rules')
        
    # Apply Primary Keys to ensure editability in GUI tools
    try:
        with engine.begin() as conn:
            # Tables that need a generated 'id' SERIAL PRIMARY KEY
            for table in ['users', 'master', 'locations', 'logs', 'grade_rules', 'rr_pointer']:
                if engine.dialect.has_table(conn, table):
                    res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' AND column_name='id'"))
                    if not res.fetchone():
                        print(f"Adding Primary Key to {table}")
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN id SERIAL PRIMARY KEY;"))
            
            # Tables that have an existing unique ID column to use as PRIMARY KEY
            if engine.dialect.has_table(conn, 'tickets'):
                res = conn.execute(text("SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='tickets' AND constraint_type='PRIMARY KEY'"))
                if not res.fetchone():
                    print("Adding Primary Key to tickets")
                    conn.execute(text("ALTER TABLE tickets ADD PRIMARY KEY (ticket_id);"))
                    
            if engine.dialect.has_table(conn, 'notifications'):
                res = conn.execute(text("SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='notifications' AND constraint_type='PRIMARY KEY'"))
                if not res.fetchone():
                    print("Adding Primary Key to notifications")
                    conn.execute(text("ALTER TABLE notifications ADD PRIMARY KEY (notif_id);"))
    except Exception as e:
        print(f"Error adding primary keys: {e}")