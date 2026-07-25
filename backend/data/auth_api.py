from flask import Blueprint, request, jsonify
import hashlib
import random
import pandas as pd
import database

# Create a Blueprint for authentication routes
auth_bp = Blueprint('auth', __name__)

def hash_password(password):
    return hashlib.sha256(str.encode(password)).hexdigest()

def generate_otp():
    return str(random.randint(100000, 999999))

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    login_id = data.get('login_id') # Can be email or phone
    password = data.get('password')
    
    if not login_id or not password:
        return jsonify({"error": "Missing credentials"}), 400
        
    users = database.load_data('users')
    hashed_pwd = hash_password(password)
    
    # Check for matching email/phone and password
    user_match = users[
        ((users['email'] == login_id) | (users['phone'].astype(str) == login_id)) & 
        (users['password'] == hashed_pwd)
    ]
    
    if user_match.empty:
        return jsonify({"error": "Invalid credentials"}), 401
        
    user = user_match.iloc[0].to_dict()
    
    # Check if first login forces a reset
    if str(user.get('first_login')).lower() in ['true', '1']:
        return jsonify({"force_reset": True, "email": user['email']}), 200
        
    # Remove sensitive data before sending to React
    del user['password']
    
    return jsonify({
        "message": "Login successful",
        "user": user,
        "token": "dummy-jwt-token-replace-in-prod" # Placeholder for future JWT implementation
    }), 200

@auth_bp.route('/api/reset-first-password', methods=['POST'])
def reset_first_password():
    data = request.json
    email = data.get('email')
    new_password = data.get('new_password')
    
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
        
    users = database.load_data('users')
    
    if email not in users['email'].values:
        return jsonify({"error": "User not found"}), 404
        
    users.loc[users['email'] == email, 'password'] = hash_password(new_password)
    users.loc[users['email'] == email, 'first_login'] = False
    
    database.save_data(users, 'users')
    return jsonify({"message": "Password reset successfully. You can now log in."}), 200

# ==========================================
# ENTERPRISE NOTIFICATION ENDPOINTS
# ==========================================

@auth_bp.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Fetches all notifications for a specific user"""
    email = request.args.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    notifs = database.load_data('notifications')
    if notifs.empty:
        return jsonify([]), 200
        
    user_notifs = notifs[notifs['user_email'] == email].copy()
    
    if user_notifs.empty:
        return jsonify([]), 200
        
    # Ensure boolean formats are completely safe for JSON serialization
    if 'is_read' in user_notifs.columns:
        user_notifs['is_read'] = user_notifs['is_read'].apply(lambda x: str(x).lower() in ['true', '1', 'yes'])
        
    user_notifs = user_notifs.where(pd.notnull(user_notifs), None)
    return jsonify(user_notifs.to_dict(orient='records')), 200


@auth_bp.route('/api/notifications/mark-read', methods=['POST'])
def mark_read():
    """Marks a single notification as read"""
    data = request.json
    notif_id = data.get('notif_id')
    
    notifs = database.load_data('notifications')
    
    if notifs.empty or notif_id not in notifs['notif_id'].values:
        return jsonify({"error": "Notification not found"}), 404
        
    notifs.loc[notifs['notif_id'] == notif_id, 'is_read'] = 'True'
    database.save_data(notifs, 'notifications')
    
    return jsonify({"message": "Marked as read"}), 200


@auth_bp.route('/api/notifications/mark-all-read', methods=['POST'])
def mark_all_read():
    """Marks all notifications for a user as read"""
    data = request.json
    email = data.get('email')
    
    notifs = database.load_data('notifications')
    
    if notifs.empty:
        return jsonify({"message": "No notifications to update"}), 200
        
    notifs.loc[notifs['user_email'] == email, 'is_read'] = 'True'
    database.save_data(notifs, 'notifications')
    
    return jsonify({"message": "All marked as read"}), 200