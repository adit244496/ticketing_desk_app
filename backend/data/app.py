import os
import threading
import time
from flask import Flask, send_from_directory
from flask_cors import CORS

from auth_api import auth_bp
from ticket_api import ticket_bp
from dept_head_api import dept_head_bp
from admin_api import admin_bp
import database

app = Flask(__name__)
# Allow React (usually running on port 3000 or 5173) to talk to Flask
CORS(app)

# Define the path to the physical uploads directory
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure the upload directory exists when the server starts
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create a secure static route to serve these files to React
@app.route('/uploads/<filename>')
def serve_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
# =========================================================

# Register all route files
app.register_blueprint(auth_bp)
app.register_blueprint(ticket_bp)
app.register_blueprint(dept_head_bp)
app.register_blueprint(admin_bp)

def background_tasks():
    while True:
        try:
            database.auto_check_sla_breaches()
            database.escalate_open_tickets()
            database.escalate_overdue_tickets()
            database.auto_close_resolved_tickets()
            
            # Send Daily Excel Notifications based on configured time
            # SET YOUR PREFERRED TIME HERE (24-hour HH:MM format)
            daily_time = "17:21" 
            if daily_time:
                now = database.get_ist_now()
                current_time = now.strftime("%H:%M")
                
                if current_time == daily_time:
                    if not hasattr(background_tasks, 'last_sent_date') or background_tasks.last_sent_date != now.date():
                        database.send_daily_excel_notifications()
                        background_tasks.last_sent_date = now.date()
                        
        except Exception as e:
            print(f"Error in background task: {e}")
        time.sleep(60)

# Initialize the database and default tables/users if they don't exist
database.init_db()

# Start background worker thread for SLA & Escalations safely
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
    threading.Thread(target=background_tasks, daemon=True).start()

if __name__ == '__main__':
    # use_reloader=True enables automatic reloading when files change
    app.run(debug=True, port=5000, use_reloader=True)