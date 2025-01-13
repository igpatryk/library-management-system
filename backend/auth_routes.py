from flask import jsonify, request, current_app
from flask_cors import cross_origin
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from app import app, db
from models import User, Reader, Loan
from werkzeug.security import check_password_hash, generate_password_hash

@app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
def register():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.json
    
    try:
        with db.session.begin():
            # Simplified check for existing user
            check_query = "SELECT 1 FROM users WHERE username = :username OR email = :email"
            exists = db.session.execute(check_query, {
                'username': data['username'],
                'email': data['email']
            }).scalar() is not None
            
            if exists:
                return jsonify({'error': 'Username or email already exists'}), 400
            
            # Simplified user count check
            user_count = db.session.execute("SELECT 1 FROM users LIMIT 1").scalar() is None
            
            # Create new user - simplified
            insert_query = """
                INSERT INTO users (username, email, password_hash, role)
                VALUES (:username, :email, :password_hash, :role)
                RETURNING id
            """
            user_id = db.session.execute(insert_query, {
                'username': data['username'],
                'email': data['email'],
                'password_hash': generate_password_hash(data['password']),
                'role': 'admin' if user_count else 'user'
            }).scalar()
            
            return jsonify({'message': 'User registered successfully'}), 201
            
    except Exception as e:
        current_app.logger.error(f"Error registering user: {str(e)}")
        return jsonify({'error': 'Failed to register user'}), 500

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
def login():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.json
    
    # Simplified login query
    query = "SELECT id, password_hash, role FROM users WHERE username = :username"
    user = db.session.execute(query, {'username': data['username']}).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role}
    )
    return jsonify({'token': access_token, 'role': user.role}), 200

@app.route('/api/users', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_users():
    if request.method == 'OPTIONS':
        return '', 200
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Simplified users query
        query = "SELECT id, username, email, role FROM users ORDER BY username"
        result = db.session.execute(query)
        users = [dict(row) for row in result]
        return jsonify(users)
        
    except Exception as e:
        current_app.logger.error(f"Error fetching users: {str(e)}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@app.route('/api/users/<int:user_id>/promote', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def promote_user(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    claims = get_jwt()
    current_user_role = claims.get('role', 'user')
    if current_user_role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get_or_404(user_id)
    data = request.json
    if data['role'] not in ['user', 'worker']:
        return jsonify({'error': 'Invalid role'}), 400
    
    user.role = data['role']
    db.session.commit()
    
    return jsonify({'message': 'User role updated successfully'})

@app.route('/api/users/<int:user_id>', methods=['DELETE', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def delete_user(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get_or_404(user_id)
    if user.role == 'admin':
        return jsonify({'error': 'Cannot delete admin users'}), 400
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'})

@app.route('/api/users/<int:user_id>/details', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_user_details(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Combined user and reader details in one query
        user_query = """
            SELECT u.*, r.card_number, r.registration_date
            FROM users u
            LEFT JOIN readers r ON u.id = r.user_id
            WHERE u.id = :user_id
        """
        user = db.session.execute(user_query, {'user_id': user_id}).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Simplified loan history query
        loans_query = """
            SELECT b.title, l.loan_date, l.return_date, l.status
            FROM loans l
            JOIN books b ON l.book_id = b.id
            JOIN readers r ON l.reader_id = r.id
            WHERE r.user_id = :user_id
            ORDER BY l.loan_date DESC
        """
        loans = db.session.execute(loans_query, {'user_id': user_id})
        
        loan_history = [{
            'book_title': loan.title,
            'loan_date': loan.loan_date.isoformat(),
            'return_date': loan.return_date.isoformat() if loan.return_date else None,
            'status': loan.status
        } for loan in loans]
        
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'created_at': user.created_at.isoformat(),
            'reader_profile': {
                'card_number': user.card_number,
                'registration_date': user.registration_date.isoformat() if user.registration_date else None
            } if user.card_number else None,
            'loan_history': loan_history
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching user details: {str(e)}")
        return jsonify({'error': 'Failed to fetch user details'}), 500
