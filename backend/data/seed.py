import database
import pandas as pd
from auth_api import hash_password

def seed_database():
    database.init_db()

    # 1. Departments
    departments_data = pd.DataFrame([
        {'department_name': 'IT Support'},
        {'department_name': 'Maintenance'},
        {'department_name': 'HR'},
    ])
    database.append_data(departments_data, 'departments')
    print("Seeded departments")

    # 2. Locations
    locations_data = pd.DataFrame([
        {'outlet': 'OUT-101', 'brand': 'Hospital A', 'location': 'North Wing', 'city': 'Cityville'},
        {'outlet': 'OUT-102', 'brand': 'Hospital B', 'location': 'South Wing', 'city': 'Townsville'},
    ])
    database.append_data(locations_data, 'locations')
    print("Seeded locations")

    # 3. Users
    pw = hash_password('password123')
    users_data = pd.DataFrame([
        # IT Support
        {'employee_id': 101, 'name': 'IT Manager', 'email': 'it_mgr@test.com', 'password': pw, 'role': 'Dept. Head', 'department': 'IT Support', 'outlet': 'OUT-101', 'grade': 'HSP15', 'phone': '1234567890', 'critical_user_rating': 5, 'manager': None, 'first_login': False},
        {'employee_id': 102, 'name': 'IT Solver 1', 'email': 'it_solver1@test.com', 'password': pw, 'role': 'Solver', 'department': 'IT Support', 'outlet': 'OUT-101', 'grade': 'HSP08', 'phone': '1234567891', 'critical_user_rating': 1, 'manager': 101, 'first_login': False},
        {'employee_id': 103, 'name': 'IT Solver 2', 'email': 'it_solver2@test.com', 'password': pw, 'role': 'Solver', 'department': 'IT Support', 'outlet': 'OUT-102', 'grade': 'HSP10', 'phone': '1234567892', 'critical_user_rating': 1, 'manager': 101, 'first_login': False},
        
        # Maintenance
        {'employee_id': 201, 'name': 'Maint Manager', 'email': 'maint_mgr@test.com', 'password': pw, 'role': 'Dept. Head', 'department': 'Maintenance', 'outlet': 'OUT-102', 'grade': 'HSP14', 'phone': '2234567890', 'critical_user_rating': 4, 'manager': None, 'first_login': False},
        {'employee_id': 202, 'name': 'Maint Solver', 'email': 'maint_solver@test.com', 'password': pw, 'role': 'Solver', 'department': 'Maintenance', 'outlet': 'OUT-102', 'grade': 'HSP09', 'phone': '2234567891', 'critical_user_rating': 1, 'manager': 201, 'first_login': False},
        
        # Users / Requestors
        {'employee_id': 301, 'name': 'Alice Requestor', 'email': 'alice@test.com', 'password': pw, 'role': 'Requestor', 'department': 'HR', 'outlet': 'OUT-101', 'grade': 'HSP05', 'phone': '3234567890', 'critical_user_rating': 2, 'manager': None, 'first_login': False},
        {'employee_id': 302, 'name': 'Bob Requestor', 'email': 'bob@test.com', 'password': pw, 'role': 'Requestor', 'department': 'HR', 'outlet': 'OUT-102', 'grade': 'HSP04', 'phone': '3234567891', 'critical_user_rating': 1, 'manager': None, 'first_login': False},
        
        # Admin
        {'employee_id': 999, 'name': 'Super Admin', 'email': 'admin@test.com', 'password': pw, 'role': 'Admin', 'department': 'IT Support', 'outlet': 'OUT-101', 'grade': 'HSP18', 'phone': '9999999999', 'critical_user_rating': 5, 'manager': None, 'first_login': False},
    ])
    database.append_data(users_data, 'users')
    print("Seeded users")

    # 4. Master (Rules)
    master_data = pd.DataFrame([
        {'department': 'IT Support', 'issue_type': 'Network Issue', 'activity_category': 'Internet Down', 'assigned_solver': '102', 'outlet': 'OUT-101', 'base_priority': 5, 'deadline_hours': 4},
        {'department': 'IT Support', 'issue_type': 'Hardware Failure', 'activity_category': 'Printer Broken', 'assigned_solver': '102,103', 'outlet': 'nan', 'base_priority': 4, 'deadline_hours': 24},
        {'department': 'Maintenance', 'issue_type': 'AC Not Working', 'activity_category': 'Cooling Issue', 'assigned_solver': '202', 'outlet': 'OUT-102', 'base_priority': 3, 'deadline_hours': 8},
    ])
    database.append_data(master_data, 'master')
    print("Seeded master rules")

if __name__ == '__main__':
    seed_database()
