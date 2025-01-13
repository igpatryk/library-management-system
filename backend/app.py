from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from werkzeug.security import generate_password_hash

app = Flask(__name__)

# CORS Configuration
CORS(app, 
    resources={
        r"/*": {  # Allow CORS for all routes
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 3600  # Cache preflight requests for 1 hour
        }
    }
)

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://user:password@db:5432/library_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key')
jwt = JWTManager(app)

db = SQLAlchemy(app)

# Import routes and models
from routes import *
from models import *
from auth_routes import *

# Create tables if they don't exist
def init_db():
    with app.app_context():
        db.create_all()

# Add this after creating the app but before running it
def create_admin_if_not_exists():
    try:
        query = "SELECT COUNT(*) FROM users WHERE username = 'admin'"
        result = db.session.execute(query).scalar()
        
        if result == 0:
            insert_query = """
                INSERT INTO users (username, email, password_hash, role)
                VALUES (:username, :email, :password_hash, 'admin')
            """
            db.session.execute(insert_query, {
                'username': 'admin',
                'email': 'admin@library.com',
                'password_hash': generate_password_hash('admin')
            })
            db.session.commit()
            print("Admin user created successfully")
    except Exception as e:
        print(f"Error creating admin user: {e}")

# Add this line after db initialization
create_admin_if_not_exists()

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)