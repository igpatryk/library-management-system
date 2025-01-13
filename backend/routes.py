from flask import request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import app, db
from models import Book, Author, Publisher, Reader, Loan, Reservation, User, ReaderRegistrationRequest
from datetime import datetime, timedelta
from flask_cors import cross_origin
import subprocess
import os
import tempfile
import csv
from io import StringIO, BytesIO
from sqlalchemy import func, desc
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash
import json

@app.route('/books', methods=['GET'])
def get_books():
    try:
        title = request.args.get('title', '').lower()
        author = request.args.get('author', '').lower()
        isbn = request.args.get('isbn', '')
        genre = request.args.get('genre', '')
        page = request.args.get('page', 1, type=int)
        per_page = 9
        offset = (page - 1) * per_page

        query = """
                SELECT 
                    b.id, b.title, b.isbn, b.publication_year, 
                    b.genre, b.status, b.description,
                    CONCAT(a.first_name, ' ', a.last_name) as author_name,
                    p.name as publisher_name,
                COUNT(*) OVER() as total_count
                FROM books b
                LEFT JOIN authors a ON b.author_id = a.id
                LEFT JOIN publishers p ON b.publisher_id = p.id
            WHERE (:title = '' OR LOWER(b.title) LIKE :title_pattern)
            AND (:author = '' OR LOWER(CONCAT(a.first_name, ' ', a.last_name)) LIKE :author_pattern)
            AND (:isbn = '' OR b.isbn LIKE :isbn_pattern)
            AND (:genre = '' OR b.genre = :genre)
            ORDER BY b.title
            LIMIT :limit OFFSET :offset
        """

        # Get genres in a separate query
        genres_query = "SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL"
        
        result = db.session.execute(query, {
            'title': title,
            'author': author,
            'isbn': isbn,
            'genre': genre,
            'title_pattern': f'%{title}%',
            'author_pattern': f'%{author}%',
            'isbn_pattern': f'%{isbn}%',
            'limit': per_page,
            'offset': offset
        })

        books = []
        total_count = 0
        
        # Process results and get total count from first row
        for row in result:
            books.append({
                'id': row.id,
                'title': row.title,
                'isbn': row.isbn,
                'year': row.publication_year,
                'genre': row.genre,
                'status': row.status,
                'description': row.description,
                'author': row.author_name,
                'publisher': row.publisher_name
            })
            if not total_count and hasattr(row, 'total_count'):
                total_count = row.total_count

        genres = [row[0] for row in db.session.execute(genres_query)]

        return jsonify({
            'books': books,
            'genres': genres,
            'total': total_count,
            'pages': (total_count + per_page - 1) // per_page if total_count > 0 else 0
        })

    except Exception as e:
        current_app.logger.error(f"Error in get_books: {str(e)}")
        return jsonify({
            'books': [],
            'genres': [],
            'total': 0,
            'pages': 0
        }), 500

@app.route('/api/available-books', methods=['GET'])
@jwt_required()
def get_available_books():
    try:
        title = request.args.get('title', '').lower()
        author = request.args.get('author', '').lower()
        page = request.args.get('page', 1, type=int)
        per_page = 10
        offset = (page - 1) * per_page

        base_query = """
            SELECT 
                b.id, b.title, b.isbn, b.status,
                CONCAT(a.first_name, ' ', a.last_name) as author,
                COUNT(*) OVER() as total_count
            FROM books b
            JOIN authors a ON b.author_id = a.id
            WHERE b.status = 'available'
            AND (:title = '' OR LOWER(b.title) LIKE :title_pattern)
            AND (:author = '' OR LOWER(CONCAT(a.first_name, ' ', a.last_name)) LIKE :author_pattern)
            ORDER BY b.title
            LIMIT :limit OFFSET :offset
        """

        result = db.session.execute(base_query, {
            'title': title,
            'author': author,
            'title_pattern': f'%{title}%',
            'author_pattern': f'%{author}%',
            'limit': per_page,
            'offset': offset
        })

        books = [dict(row) for row in result]
        total = books[0]['total_count'] if books else 0

        return jsonify({
            'books': books,
            'total': total,
            'pages': (total + per_page - 1) // per_page,
            'current_page': page
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching available books: {str(e)}")
        return jsonify({'error': 'Failed to fetch available books'}), 500

@app.route('/books', methods=['POST'])
@jwt_required()
def add_book():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        data = request.json
        with db.session.begin():
            # Get or create author and publisher in one query each
            author_query = """
                WITH new_author AS (
                    INSERT INTO authors (first_name, last_name)
                    SELECT :first_name, :last_name
                    WHERE NOT EXISTS (
                        SELECT 1 FROM authors 
                        WHERE first_name = :first_name AND last_name = :last_name
                    )
                    RETURNING id
                )
                SELECT id FROM authors 
                WHERE first_name = :first_name AND last_name = :last_name
                UNION ALL
                SELECT id FROM new_author
                LIMIT 1
            """
            
            publisher_query = """
                WITH new_publisher AS (
                    INSERT INTO publishers (name)
                    SELECT :name
                    WHERE NOT EXISTS (SELECT 1 FROM publishers WHERE name = :name)
                    RETURNING id
                )
                SELECT id FROM publishers WHERE name = :name
                UNION ALL
                SELECT id FROM new_publisher
                LIMIT 1
                """

            author_id = db.session.execute(author_query, {
                    'first_name': data['author_first_name'],
                    'last_name': data['author_last_name']
            }).scalar()

            publisher_id = db.session.execute(publisher_query, {
                'name': data['publisher']
            }).scalar()

            # Insert book
            book_query = """
                INSERT INTO books (
                    title, author_id, isbn, publisher_id, 
                    publication_year, genre, status
                )
                VALUES (
                    :title, :author_id, :isbn, :publisher_id,
                    :publication_year, :genre, 'available'
                )
                RETURNING id
            """
            
            book_id = db.session.execute(book_query, {
                'title': data['title'],
                'author_id': author_id,
                'isbn': data['isbn'],
                'publisher_id': publisher_id,
                'publication_year': data['publication_year'],
                'genre': data['genre']
            }).scalar()

            return jsonify({
                'message': 'Book added successfully',
                'book_id': book_id
            }), 201

    except Exception as e:
        current_app.logger.error(f"Error adding book: {str(e)}")
        return jsonify({'error': 'Failed to add book'}), 500

@app.route('/api/unregistered-users', methods=['GET'])
@jwt_required()
def get_unregistered_users():
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        query = """
            SELECT u.id, u.username, u.email
            FROM users u
            LEFT JOIN readers r ON u.id = r.user_id
            WHERE r.id IS NULL 
            AND u.role = 'user'
            AND u.is_active = true
            ORDER BY u.username
        """
        
        result = db.session.execute(query)
        users = [dict(row) for row in result]
        
        return jsonify(users)
    except Exception as e:
        current_app.logger.error(f"Error fetching unregistered users: {str(e)}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@app.route('/api/reader-requests', methods=['GET'])
@jwt_required()
def get_reader_requests():
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        status = request.args.get('status', 'pending')
        page = request.args.get('page', 1, type=int)
        per_page = 10
        offset = (page - 1) * per_page

        query = """
            SELECT 
                rr.id, rr.first_name, rr.last_name, 
                rr.address, rr.phone_number, rr.status,
                rr.created_at, rr.processed_at,
                u.username, u.email,
                rr.user_id, rr.rejection_reason,
                COUNT(*) OVER() as total_count
            FROM reader_registration_requests rr
            JOIN users u ON rr.user_id = u.id
            WHERE CASE 
                WHEN :status = 'processed' THEN rr.status IN ('approved', 'rejected')
                ELSE rr.status = :status
            END
            ORDER BY CASE 
                WHEN :status = 'processed' THEN rr.processed_at
                ELSE rr.created_at
            END DESC
            LIMIT :limit OFFSET :offset
        """
        
        current_app.logger.info(f"Executing query with status: {status}")
        
        result = db.session.execute(query, {
            'status': status,
            'limit': per_page,
            'offset': offset
        })
        
        requests = []
        total_count = 0
        
        for row in result:
            request_data = dict(row)
            if not total_count and hasattr(row, 'total_count'):
                total_count = row.total_count
            # Convert datetime fields to ISO format
            if request_data['created_at']:
                request_data['created_at'] = request_data['created_at'].isoformat()
            if request_data['processed_at']:
                request_data['processed_at'] = request_data['processed_at'].isoformat()
            requests.append(request_data)

        current_app.logger.info(f"Found {len(requests)} {status} reader requests")
        if requests:
            current_app.logger.info(f"First request: {requests[0]}")
        
        return jsonify({
            'requests': requests,
            'totalPages': (total_count + per_page - 1) // per_page,
            'currentPage': page,
            'totalCount': total_count
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching reader requests: {str(e)}")
        return jsonify({'error': 'Failed to fetch reader requests'}), 500

@app.route('/api/reader-requests', methods=['POST'])
@jwt_required()
def create_reader_request():
    try:
        with db.session.begin():
            query = """
                WITH check_existing AS (
                    SELECT 1 
                    FROM reader_registration_requests 
                    WHERE user_id = :user_id 
                    AND status = 'pending'
                    AND created_at > CURRENT_DATE - INTERVAL '30 days'
                ),
                new_request AS (
                    INSERT INTO reader_registration_requests 
                    (user_id, first_name, last_name, address, phone_number, status, created_at)
                    SELECT 
                        :user_id, :first_name, :last_name, :address, :phone_number, 
                        'pending', CURRENT_TIMESTAMP
                    WHERE NOT EXISTS (SELECT 1 FROM check_existing)
                    RETURNING id
                )
                SELECT id,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM check_existing) THEN 'Pending request exists'
                        ELSE NULL
                    END as error
                FROM new_request
            """
            
            result = db.session.execute(query, {
                'user_id': get_jwt_identity(),
                'first_name': request.json['first_name'],
                'last_name': request.json['last_name'],
                'address': request.json['address'],
                'phone_number': request.json['phone_number']
            }).first()

            if not result or result.error:
                return jsonify({'error': result.error or 'Failed to create request'}), 400

            return jsonify({
                'message': 'Request submitted successfully',
                'request_id': result.id
            }), 201

    except Exception as e:
        current_app.logger.error(f"Error creating reader request: {str(e)}")
        return jsonify({'error': 'Failed to create request'}), 500

@app.route('/api/reader-requests/check', methods=['GET'])
@jwt_required()
def check_pending_request():
    try:
        query = """
            SELECT EXISTS (
                SELECT 1 
                FROM reader_registration_requests 
                WHERE user_id = :user_id 
                AND status = 'pending'
                AND created_at > CURRENT_DATE - INTERVAL '30 days'
            ) as has_pending_request
        """
        
        result = db.session.execute(query, {
            'user_id': get_jwt_identity()
        }).scalar()
        
        return jsonify({'has_pending_request': bool(result)})
    except Exception as e:
        current_app.logger.error(f"Error checking pending request: {str(e)}")
        return jsonify({'error': 'Failed to check request status'}), 500

@app.route('/readers', methods=['GET'])
@jwt_required()
def get_readers():
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        query = """
            SELECT 
                r.id, r.first_name, r.last_name, r.email,
                r.card_number, r.phone_number,
                COUNT(l.id) as active_loans
            FROM readers r
            LEFT JOIN loans l ON r.id = l.reader_id AND l.status = 'borrowed'
            GROUP BY r.id
            ORDER BY r.last_name, r.first_name
        """
        
        result = db.session.execute(query)
        readers = [dict(row) for row in result]
        
        return jsonify(readers)
    except Exception as e:
        current_app.logger.error(f"Error fetching readers: {str(e)}")
        return jsonify({'error': 'Failed to fetch readers'}), 500

@app.route('/api/readers/check-status', methods=['GET'])
@jwt_required()
def check_reader_status():
    try:
        query = """
            SELECT 
                EXISTS(SELECT 1 FROM readers WHERE user_id = :user_id) as is_reader,
                EXISTS(
                    SELECT 1 FROM reader_registration_requests 
                    WHERE user_id = :user_id 
                    AND status = 'pending'
                    AND created_at > CURRENT_DATE - INTERVAL '30 days'
                ) as has_pending_request
        """
        
        result = db.session.execute(query, {
            'user_id': get_jwt_identity()
        }).first()
        
        return jsonify({
            'is_reader': bool(result.is_reader),
            'has_pending_request': bool(result.has_pending_request),
            'user_id': get_jwt_identity()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error checking reader status: {str(e)}")
        return jsonify({'error': 'Failed to check reader status'}), 500

@app.route('/api/reservations/book/<int:book_id>', methods=['GET'])
def get_book_reservations(book_id):
    try:
        # Replace ORM query with SQL:
        query = """
            SELECT 
                id,
                start_date,
                end_date,
                status
            FROM reservations
            WHERE book_id = :book_id
            AND status != 'cancelled'
            ORDER BY start_date
        """
        
        result = db.session.execute(query, {'book_id': book_id})
        
        reservations = [{
            'start_date': row.start_date.isoformat(),
            'end_date': row.end_date.isoformat(),
            'status': row.status
        } for row in result]
        
        return jsonify(reservations)
    except Exception as e:
        current_app.logger.error(f"Error fetching reservations: {str(e)}")
        return jsonify({'error': 'Failed to fetch reservations'}), 500

@app.route('/api/admin/database/backup', methods=['GET'])
@jwt_required()
def backup_database():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    temp_dir = None
    backup_path = None
        
    try:
        # Create a temporary file
        temp_dir = tempfile.mkdtemp()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'library_backup_{timestamp}.sql'
        backup_path = os.path.join(temp_dir, backup_filename)
        
        # Get database connection details from environment variables
        db_name = os.getenv('POSTGRES_DB', 'library')
        db_user = os.getenv('POSTGRES_USER', 'postgres')
        db_host = os.getenv('POSTGRES_HOST', 'db')
        db_password = os.getenv('POSTGRES_PASSWORD')

        if not all([db_name, db_user, db_host, db_password]):
            raise Exception("Missing database configuration")
        
        # Create the dump
        command = [
            'pg_dump',
            '-h', db_host,
            '-U', db_user,
            '-d', db_name,
            '-f', backup_path
        ]
        
        # Execute pg_dump
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={'PGPASSWORD': db_password}
        )
        
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"Database backup failed: {stderr.decode()}")
        
        if not os.path.exists(backup_path):
            raise Exception("Backup file was not created")
            
        # Send the file
        return send_file(
            backup_path,
            as_attachment=True,
            download_name=backup_filename,
            mimetype='application/sql'
        )
        
    except Exception as e:
        current_app.logger.error(f"Backup failed: {str(e)}")
        return jsonify({'error': 'Failed to create database backup'}), 500
        
    finally:
        # Cleanup temp files
        try:
            if backup_path and os.path.exists(backup_path):
                os.remove(backup_path)
            if temp_dir and os.path.exists(temp_dir):
                os.rmdir(temp_dir)
        except Exception as e:
            current_app.logger.error(f"Cleanup failed: {str(e)}")

@app.route('/api/reports/active-loans', methods=['GET'])
@jwt_required()
def get_active_loans_report():
    try:
        query = """
            SELECT 
                b.title,
                CONCAT(a.first_name, ' ', a.last_name) as author,
                CONCAT(r.first_name, ' ', r.last_name) as reader,
                l.loan_date,
                res.end_date as due_date,
                (l.status = 'borrowed' AND res.end_date < CURRENT_DATE) as is_overdue,
                CASE 
                    WHEN res.end_date < CURRENT_DATE 
                    THEN (CURRENT_DATE - res.end_date)
                    ELSE NULL 
                END as days_overdue,
                RANK() OVER (
                    ORDER BY 
                        CASE 
                            WHEN res.end_date < CURRENT_DATE 
                            THEN (CURRENT_DATE - res.end_date)
                            ELSE NULL 
                        END DESC NULLS LAST
                ) as overdue_rank
            FROM loans l
            JOIN books b ON l.book_id = b.id
            JOIN authors a ON b.author_id = a.id
            JOIN readers r ON l.reader_id = r.id
            LEFT JOIN reservations res ON l.book_id = res.book_id 
                AND l.reader_id = res.reader_id
                AND res.status = 'completed'
            WHERE l.status = 'borrowed'
            ORDER BY is_overdue DESC, loan_date DESC
        """
        
        result = db.session.execute(query)
        loans = [dict(row) for row in result]
        
        # Convert datetime objects to ISO format
        for loan in loans:
            loan['loan_date'] = loan['loan_date'].isoformat()
            loan['due_date'] = loan['due_date'].isoformat() if loan['due_date'] else None
            # Convert interval to integer days if not None
            if loan['days_overdue'] is not None:
                loan['days_overdue'] = loan['days_overdue'].days
        
        # Create a BytesIO object with the JSON data
        output = BytesIO(json.dumps(loans, indent=2).encode('utf-8'))
        
        return send_file(
            output,
            mimetype='application/json',
            as_attachment=True,
            download_name=f'active_loans_{datetime.now().strftime("%Y%m%d")}.json'
        )
    except Exception as e:
        current_app.logger.error(f"Error generating active loans report: {str(e)}")
        return jsonify({'error': 'Failed to generate report'}), 500

@app.route('/api/reports/overdue-loans', methods=['GET'])
@jwt_required()
def get_overdue_loans_report():
    try:
        query = """
            SELECT 
                b.title,
                CONCAT(a.first_name, ' ', a.last_name) as author,
                CONCAT(r.first_name, ' ', r.last_name) as reader,
                l.loan_date,
                res.end_date as due_date,
                CURRENT_DATE - res.end_date as days_overdue,
                r.email,
                r.phone_number
            FROM loans l
            JOIN books b ON l.book_id = b.id
            JOIN authors a ON b.author_id = a.id
            JOIN readers r ON l.reader_id = r.id
            JOIN reservations res ON l.book_id = res.book_id 
                AND l.reader_id = res.reader_id
                AND res.status = 'completed'
            WHERE l.status = 'borrowed'
            AND res.end_date < CURRENT_DATE
            ORDER BY days_overdue DESC
        """
        
        result = db.session.execute(query)
        overdue = [dict(row) for row in result]
        
        # Convert datetime objects to ISO format
        for loan in overdue:
            loan['loan_date'] = loan['loan_date'].isoformat()
            loan['due_date'] = loan['due_date'].isoformat()
            loan['days_overdue'] = int(loan['days_overdue'].days)
        
        # Create a BytesIO object with the JSON data
        output = BytesIO(json.dumps(overdue, indent=2).encode('utf-8'))
        
        return send_file(
            output,
            mimetype='application/json',
            as_attachment=True,
            download_name=f'overdue_loans_{datetime.now().strftime("%Y%m%d")}.json'
        )
    except Exception as e:
        current_app.logger.error(f"Error generating overdue loans report: {str(e)}")
        return jsonify({'error': 'Failed to generate report'}), 500

@app.route('/api/reports/reader-activity', methods=['GET'])
@jwt_required()
def get_reader_activity_report():
    try:
        query = """
            SELECT 
                CONCAT(r.first_name, ' ', r.last_name) as reader,
                r.email,
                COUNT(DISTINCT l.id) as loans_count,
                COUNT(DISTINCT res.id) as reservations_count,
                r.registration_date,
                COUNT(DISTINCT CASE WHEN l.status = 'borrowed' THEN l.id END) as active_loans,
                COUNT(DISTINCT CASE WHEN res.status = 'pending' THEN res.id END) as pending_reservations
            FROM readers r
            LEFT JOIN loans l ON r.id = l.reader_id
            LEFT JOIN reservations res ON r.id = res.reader_id
            GROUP BY r.id, r.first_name, r.last_name, r.email, r.registration_date
            ORDER BY reader
        """
        
        result = db.session.execute(query)
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Reader', 'Email', 'Total Loans', 'Total Reservations', 
            'Active Loans', 'Pending Reservations', 'Registration Date'
        ])
        
        for row in result:
            writer.writerow([
                row.reader,
                row.email,
                row.loans_count,
                row.reservations_count,
                row.active_loans,
                row.pending_reservations,
                row.registration_date.strftime('%Y-%m-%d')
            ])
        
        output_bytes = BytesIO(output.getvalue().encode('utf-8-sig'))
        
        return send_file(
            output_bytes,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'reader_activity_{datetime.now().strftime("%Y%m%d")}.csv'
        )
    except Exception as e:
        current_app.logger.error(f"Error generating reader activity report: {str(e)}")
        return jsonify({'error': 'Failed to generate report'}), 500

@app.route('/api/reports/popular-books', methods=['GET'])
@jwt_required()
def get_popular_books_report():
    try:
        query = """
                SELECT 
                    b.title,
                    CONCAT(a.first_name, ' ', a.last_name) as author,
                COUNT(DISTINCT l.id) as loans_count,
                COUNT(DISTINCT res.id) as reservations_count,
                    COUNT(DISTINCT CASE WHEN l.status = 'borrowed' THEN l.id END) as active_loans,
                COUNT(DISTINCT CASE WHEN res.status = 'pending' THEN res.id END) as pending_reservations,
                RANK() OVER (
                    ORDER BY COUNT(DISTINCT l.id) DESC, 
                    COUNT(DISTINCT res.id) DESC
                ) as popularity_rank
                FROM books b
                JOIN authors a ON b.author_id = a.id
                LEFT JOIN loans l ON b.id = l.book_id
                LEFT JOIN reservations res ON b.id = res.book_id
                GROUP BY b.id, b.title, a.first_name, a.last_name
            ORDER BY loans_count DESC, reservations_count DESC
        """
        
        result = db.session.execute(query)
        books = [dict(row) for row in result]
        
        # Create a BytesIO object with the JSON data
        output = BytesIO(json.dumps(books, indent=2).encode('utf-8'))
        
        return send_file(
            output,
            mimetype='application/json',
            as_attachment=True,
            download_name=f'popular_books_{datetime.now().strftime("%Y%m%d")}.json'
        )
    except Exception as e:
        current_app.logger.error(f"Error generating popular books report: {str(e)}")
        return jsonify({'error': 'Failed to generate report'}), 500

@app.route('/api/reports/user-statistics', methods=['GET'])
@jwt_required()
def get_user_statistics_report():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Replace ORM query with SQL:
    query = """
        SELECT 
            u.username,
            u.email,
            u.role,
            u.created_at,
            r.registration_date,
            CASE WHEN r.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_reader
        FROM users u
        LEFT JOIN readers r ON u.id = r.user_id
        ORDER BY u.username
    """
    
    result = db.session.execute(query)
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['Username', 'Email', 'Role', 'Is Reader', 'Registration Date', 'Last Activity'])
    
    for row in result:
        writer.writerow([
            row.username,
            row.email,
            row.role,
            row.is_reader,
            row.created_at.strftime('%Y-%m-%d'),
            row.registration_date.strftime('%Y-%m-%d') if row.registration_date else 'N/A'
        ])
    
    bytes_output = BytesIO()
    bytes_output.write(output.getvalue().encode('utf-8-sig'))
    bytes_output.seek(0)
    
    return send_file(
        bytes_output,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'user_statistics_{datetime.now().strftime("%Y%m%d")}.csv'
    )

@app.route('/api/reader-requests/<int:request_id>/approve', methods=['POST'])
@jwt_required()
def approve_reader_request(request_id):
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        with db.session.begin():
            query = """
                WITH request_data AS (
                SELECT user_id, first_name, last_name, address, phone_number
                FROM reader_registration_requests
                WHERE id = :request_id AND status = 'pending'
                ),
                new_reader AS (
                INSERT INTO readers (
                        user_id, first_name, last_name, address, phone_number
                    )
                    SELECT user_id, first_name, last_name, address, phone_number
                    FROM request_data
                    WHERE EXISTS (SELECT 1 FROM request_data)
                RETURNING id
                ),
                update_request AS (
                UPDATE reader_registration_requests
                SET status = 'approved',
                    processed_by = :processor_id,
                    processed_at = CURRENT_TIMESTAMP
                WHERE id = :request_id
                    AND EXISTS (SELECT 1 FROM new_reader)
                    RETURNING 1
                )
                SELECT EXISTS (SELECT 1 FROM update_request) as success
            """
            
            result = db.session.execute(query, {
                'request_id': request_id,
                'processor_id': get_jwt_identity()
            }).scalar()

            if not result:
                return jsonify({'error': 'Request not found or already processed'}), 404

            return jsonify({'message': 'Reader request approved successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error approving reader request: {str(e)}")
        return jsonify({'error': 'Failed to approve request'}), 500

@app.route('/api/reader-requests/<int:request_id>/reject', methods=['POST'])
@jwt_required()
def reject_reader_request(request_id):
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        data = request.json
        rejection_reason = data.get('reason', '')

        with db.session.begin():
            query = """
                UPDATE reader_registration_requests
                SET status = 'rejected',
                    processed_by = :processor_id,
                    processed_at = CURRENT_TIMESTAMP,
                    rejection_reason = :reason
                WHERE id = :request_id 
                AND status = 'pending'
                RETURNING id
            """

            result = db.session.execute(query, {
                'processor_id': get_jwt_identity(),
                'reason': rejection_reason,
                'request_id': request_id
            }).scalar()

            if not result:
                return jsonify({'error': 'Request not found or already processed'}), 404

            # Add logging to help debug
            current_app.logger.info(f"Successfully rejected request {request_id} with reason: {rejection_reason}")
            
            return jsonify({'message': 'Reader request rejected successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error rejecting reader request: {str(e)}")
        return jsonify({'error': 'Failed to reject request'}), 500

@app.route('/api/reservations', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required(optional=True)
def create_reservation():
    if request.method == 'OPTIONS':
        return '', 200
        
    if not get_jwt_identity():
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        data = request.json
        user_id = get_jwt_identity()

        validation_query = """
            WITH availability AS (
                SELECT * FROM check_book_availability(
                    :book_id, CAST(:start_date AS date), CAST(:end_date AS date)
                )
            ),
            reader_check AS (
                SELECT id FROM readers WHERE user_id = :user_id
            )
            SELECT 
                a.*,
                (SELECT id FROM reader_check) as reader_id
            FROM availability a
        """
        
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            
            if start_date < datetime.now().date():
                return jsonify({'error': 'Start date cannot be in the past'}), 400
            if end_date < start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
                
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        validation = db.session.execute(validation_query, {
            'book_id': data['book_id'],
            'start_date': start_date,
            'end_date': end_date,
            'user_id': user_id
        }).first()

        if not validation.book_exists:
            return jsonify({'error': 'Book not found'}), 404
        if not validation.reader_id:
            return jsonify({'error': 'User is not a registered reader'}), 403
        if validation.book_status != 'available':
            return jsonify({'error': f'Book is not available (current status: {validation.book_status})'}), 400
        if validation.has_conflict:
            return jsonify({'error': f'Book is already reserved by {validation.current_holder}'}), 400

        # Create reservation
        insert_query = """
            INSERT INTO reservations (
                book_id, reader_id, start_date, end_date, status, created_at
            )
            VALUES (
                :book_id, :reader_id, :start_date, :end_date, 'pending', CURRENT_TIMESTAMP
            )
            RETURNING id
        """
        reservation_id = db.session.execute(insert_query, {
            'book_id': data['book_id'],
            'reader_id': validation.reader_id,
            'start_date': start_date,
            'end_date': end_date
        }).scalar()

        db.session.commit()

        return jsonify({
            'message': 'Reservation created successfully',
            'reservation_id': reservation_id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating reservation: {str(e)}")
        return jsonify({'error': 'Failed to create reservation'}), 500

@app.route('/api/reservations/user', methods=['GET'])
@jwt_required()
def get_user_reservations():
    try:
        current_user_id = get_jwt_identity()
        
        query = """
            WITH reader_check AS (
                SELECT id 
                FROM readers 
                WHERE user_id = :user_id
            )
            SELECT 
                res.id,
                b.title as book_title,
                CONCAT(a.first_name, ' ', a.last_name) as author_name,
                res.start_date,
                res.end_date,
                res.status,
                b.status as book_status,
                (SELECT id FROM reader_check) as reader_id
            FROM reservations res
            JOIN books b ON res.book_id = b.id
            JOIN authors a ON b.author_id = a.id
            JOIN readers r ON res.reader_id = r.id
            WHERE r.user_id = :user_id
            AND res.status != 'cancelled'
            ORDER BY res.start_date DESC
        """
        
        result = db.session.execute(query, {'user_id': current_user_id})
        first_row = result.first()
        
        if not first_row or not first_row.reader_id:
            return jsonify({'error': 'User is not a registered reader'}), 403
            
        reservations = [{
            'id': row.id,
            'book_title': row.book_title,
            'author': row.author_name,
            'start_date': row.start_date.isoformat(),
            'end_date': row.end_date.isoformat(),
            'status': row.status,
            'book_status': row.book_status
        } for row in result]
        
        return jsonify(reservations)
        
    except Exception as e:
        current_app.logger.error(f"Error fetching user reservations: {str(e)}")
        return jsonify({'error': 'Failed to fetch reservations'}), 500

@app.route('/api/loans/books', methods=['GET'])
@jwt_required()
def get_books_for_loans():
    try:
        query = """
                SELECT 
                b.id, b.title, 
                    CONCAT(a.first_name, ' ', a.last_name) as author,
                res.reader_id,
                    CONCAT(rd.first_name, ' ', rd.last_name) as reader_name,
                res.start_date, res.end_date,
                COUNT(*) OVER (PARTITION BY b.id) as reservation_count
                FROM books b
                JOIN authors a ON b.author_id = a.id
            JOIN reservations res ON b.id = res.book_id
            JOIN readers rd ON res.reader_id = rd.id
            WHERE b.status = 'available'
            AND res.status = 'pending'
            AND CURRENT_DATE BETWEEN res.start_date AND res.end_date
            AND NOT EXISTS (
                SELECT 1 FROM loans l 
                WHERE l.book_id = b.id 
                AND l.status = 'borrowed'
            )
            ORDER BY res.created_at ASC
        """
        
        result = db.session.execute(query)
        books = [dict(row) for row in result]
        
        # Convert datetime objects to ISO format
        for book in books:
            book['start_date'] = book['start_date'].isoformat()
            book['end_date'] = book['end_date'].isoformat()

        return jsonify(books)

    except Exception as e:
        current_app.logger.error(f"Error fetching books for loans: {str(e)}")
        return jsonify({'error': 'Failed to fetch books'}), 500

@app.route('/api/loans/readers', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required(optional=True)
def get_readers_for_loan():
    if request.method == 'OPTIONS':
        return '', 200
        
    if not get_jwt_identity():
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        query = """
            SELECT 
                r.id,
                r.first_name,
                r.last_name,
                r.email,
                r.card_number
            FROM readers r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.last_name, r.first_name
        """
        
        result = db.session.execute(query)
        readers = [{
            'id': row.id,
            'first_name': row.first_name,
            'last_name': row.last_name,
            'email': row.email,
            'card_number': row.card_number
        } for row in result]
        
        return jsonify(readers)
    except Exception as e:
        current_app.logger.error(f"Error fetching readers: {str(e)}")
        return jsonify({'error': 'Failed to fetch readers'}), 500

@app.route('/api/loans', methods=['GET'])
@jwt_required()
def get_loans():
    claims = get_jwt()
    current_app.logger.info(f"User accessing loans endpoint. Role: {claims.get('role')}, ID: {get_jwt_identity()}")
    if claims.get('role') not in ['admin', 'worker']:
        current_app.logger.error(f"Unauthorized access attempt to loans. User role: {claims.get('role')}")
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        offset = (page - 1) * per_page

        query = """
            SELECT 
                l.id, b.title,
                CONCAT(r.first_name, ' ', r.last_name) as reader,
                l.loan_date, l.return_date, l.status,
                res.end_date as due_date,
                (l.status = 'borrowed' AND res.end_date < CURRENT_DATE) as is_overdue,
                COUNT(*) OVER() as total_count
            FROM loans l
            JOIN books b ON l.book_id = b.id
            JOIN readers r ON l.reader_id = r.id
            LEFT JOIN reservations res ON l.book_id = res.book_id 
                AND l.reader_id = res.reader_id
                AND res.status = 'completed'
            ORDER BY l.loan_date DESC
            LIMIT :limit OFFSET :offset
        """

        params = {
            'limit': per_page,
            'offset': offset
        }
        current_app.logger.info(f"Executing query with params: {params}")

        result = db.session.execute(query, params)
        loans = [dict(row) for row in result]
        total = loans[0]['total_count'] if loans else 0

        current_app.logger.info(f"Found {total} loans")

        # Convert datetime objects to ISO format
        for loan in loans:
            loan['loan_date'] = loan['loan_date'].isoformat() if loan['loan_date'] else None
            loan['return_date'] = loan['return_date'].isoformat() if loan['return_date'] else None
            loan['due_date'] = loan['due_date'].isoformat() if loan['due_date'] else None

        return jsonify({
            'loans': loans,
            'total': total,
            'pages': (total + per_page - 1) // per_page if total > 0 else 0,
            'current_page': page
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching loans: {str(e)}")
        return jsonify({'error': 'Failed to fetch loans'}), 500

@app.route('/api/loans', methods=['POST'])
@jwt_required()
def create_loan():
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        data = request.json
        with db.session.begin():
            # Single query to validate and create loan
            query = """
                WITH validation AS (
                    SELECT 
                        b.id as book_id,
                        r.id as reader_id,
                        res.id as reservation_id,
                        b.status as book_status,
                        res.status as reservation_status
                    FROM books b
                    JOIN reservations res ON b.id = res.book_id
                    JOIN readers r ON res.reader_id = r.id
                    WHERE b.id = :book_id 
                    AND r.id = :reader_id
                    AND res.status = 'pending'
                    AND CURRENT_DATE BETWEEN res.start_date AND res.end_date
                    LIMIT 1
                ),
                new_loan AS (
                    INSERT INTO loans (book_id, reader_id, loan_date, status)
                    SELECT book_id, reader_id, CURRENT_TIMESTAMP, 'borrowed'
                    FROM validation
                    WHERE book_status = 'available'
                    AND reservation_status = 'pending'
                    RETURNING id
                ),
                update_book AS (
                    UPDATE books b
                    SET status = 'borrowed'
                    FROM validation v
                    WHERE b.id = v.book_id
                    AND EXISTS (SELECT 1 FROM new_loan)
                ),
                update_reservation AS (
                    UPDATE reservations r
                    SET status = 'completed'
                    FROM validation v
                    WHERE r.id = v.reservation_id
                    AND EXISTS (SELECT 1 FROM new_loan)
                )
                SELECT id, 
                    (CASE WHEN id IS NULL THEN false ELSE true END) as success
                FROM new_loan
            """
            
            result = db.session.execute(query, {
                'book_id': data['book_id'],
                'reader_id': data['reader_id']
            }).first()

            if not result or not result.success:
                return jsonify({'error': 'Invalid loan request'}), 400

            return jsonify({
                'message': 'Loan created successfully',
                'loan_id': result.id
            }), 201

    except Exception as e:
        current_app.logger.error(f"Error creating loan: {str(e)}")
        return jsonify({'error': 'Failed to create loan'}), 500

@app.route('/api/loans/<int:loan_id>/return', methods=['POST'])
@jwt_required()
def return_book(loan_id):
    try:
        with db.session.begin():
            query = """
                WITH loan_update AS (
                UPDATE loans
                SET status = 'returned',
                    return_date = CURRENT_TIMESTAMP
                WHERE id = :loan_id
                    AND status = 'borrowed'
                    RETURNING book_id
                ),
                book_update AS (
                UPDATE books
                SET status = 'available'
                    FROM loan_update
                    WHERE books.id = loan_update.book_id
                    RETURNING 1
                )
                SELECT EXISTS (SELECT 1 FROM loan_update) as success
            """
            
            result = db.session.execute(query, {'loan_id': loan_id}).scalar()

            if not result:
                return jsonify({'error': 'Invalid return request'}), 400

            return jsonify({'message': 'Book returned successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error returning book: {str(e)}")
        return jsonify({'error': 'Failed to return book'}), 500

@app.route('/api/reservations/all', methods=['GET'])
@jwt_required()
def get_all_reservations():
    claims = get_jwt()
    current_app.logger.info(f"User accessing reservations endpoint. Role: {claims.get('role')}, ID: {get_jwt_identity()}")
    if claims.get('role') not in ['admin', 'worker']:
        current_app.logger.error(f"Unauthorized access attempt to reservations. User role: {claims.get('role')}")
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        offset = (page - 1) * per_page
        
        query = """
            SELECT 
                res.id, res.start_date, res.end_date, res.status,
                b.title,
                CONCAT(r.first_name, ' ', r.last_name) as reader,
                COUNT(*) OVER() as total_count
            FROM reservations res
            JOIN books b ON res.book_id = b.id
            JOIN readers r ON res.reader_id = r.id
            ORDER BY res.start_date DESC
            LIMIT :limit OFFSET :offset
        """
        
        params = {
            'limit': per_page,
            'offset': offset
        }
        current_app.logger.info(f"Executing query with params: {params}")
        
        result = db.session.execute(query, params)
        reservations = [dict(row) for row in result]
        total = reservations[0]['total_count'] if reservations else 0
        
        current_app.logger.info(f"Found {total} reservations")
        
        # Convert datetime objects to ISO format
        for res in reservations:
            res['start_date'] = res['start_date'].isoformat() if res['start_date'] else None
            res['end_date'] = res['end_date'].isoformat() if res['end_date'] else None
        
        return jsonify({
            'reservations': reservations,
            'total': total,
            'pages': (total + per_page - 1) // per_page if total > 0 else 0,
            'current_page': page
        })
        
    except Exception as e:
        current_app.logger.error(f"Error fetching reservations: {str(e)}")
        return jsonify({'error': 'Failed to fetch reservations'}), 500

@app.route('/api/reservations/admin/create', methods=['POST'])
@jwt_required()
def admin_create_reservation():
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    try:
        data = request.get_json()

        # Parse and validate dates
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            if end_date < start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        with db.session.begin():
            query = """
                WITH validation AS (
                    SELECT b.status
                    FROM books b
                    WHERE b.id = :book_id
                ),
                conflict_check AS (
                    SELECT 1
                    FROM reservations r
                    WHERE r.book_id = :book_id
                    AND r.status != 'cancelled'
                    AND r.start_date <= :end_date
                    AND r.end_date >= :start_date
                ),
                new_reservation AS (
                INSERT INTO reservations (
                        book_id, reader_id, start_date, end_date, status
                    )
                    SELECT :book_id, :reader_id, :start_date, :end_date, 'pending'
                    FROM validation
                    WHERE status = 'available'
                    AND NOT EXISTS (SELECT 1 FROM conflict_check)
                RETURNING id
                )
                SELECT id, 
                    CASE 
                        WHEN NOT EXISTS (SELECT 1 FROM validation) THEN 'Book not found'
                        WHEN (SELECT status FROM validation) != 'available' THEN 'Book not available'
                        WHEN EXISTS (SELECT 1 FROM conflict_check) THEN 'Date conflict'
                        ELSE NULL
                    END as error
                FROM new_reservation
            """
            
            result = db.session.execute(query, {
                'book_id': data['book_id'],
                'reader_id': data['reader_id'],
                'start_date': start_date,
                'end_date': end_date
            }).first()

            if not result or result.error:
                return jsonify({'error': result.error or 'Failed to create reservation'}), 400
            
            return jsonify({
                'message': 'Reservation created successfully',
                'reservation_id': result.id
            }), 201

    except Exception as e:
        current_app.logger.error(f"Error creating reservation: {str(e)}")
        return jsonify({'error': 'Failed to create reservation'}), 500

@app.route('/api/reservations/<int:reservation_id>', methods=['DELETE'])
@jwt_required()
def delete_reservation(reservation_id):
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        with db.session.begin():
            query = """
                UPDATE reservations 
                SET status = 'cancelled'
                WHERE id = :reservation_id
                AND status != 'completed'
                RETURNING id
            """
            
            result = db.session.execute(query, {
                'reservation_id': reservation_id
            }).scalar()

            if not result:
                return jsonify({'error': 'Reservation not found or cannot be cancelled'}), 400
            
            return jsonify({'message': 'Reservation cancelled successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error cancelling reservation: {str(e)}")
        return jsonify({'error': 'Failed to cancel reservation'}), 500

@app.route('/books/<int:book_id>', methods=['PUT'])
@jwt_required()
def update_book(book_id):
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'worker']:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        data = request.json
        with db.session.begin():
            # Use a single query to get or create author using a CTE
            author_query = """
                WITH existing_author AS (
                    SELECT id FROM authors 
                    WHERE first_name = :first_name AND last_name = :last_name
                ),
                new_author AS (
                    INSERT INTO authors (first_name, last_name)
                    SELECT :first_name, :last_name
                    WHERE NOT EXISTS (SELECT 1 FROM existing_author)
                    RETURNING id
                )
                SELECT id FROM existing_author
                UNION ALL
                SELECT id FROM new_author
            """
            author_id = db.session.execute(author_query, {
                'first_name': data['author_first_name'],
                'last_name': data['author_last_name']
            }).scalar()

            # Update book
            update_query = """
                UPDATE books 
                SET title = :title,
                    author_id = :author_id,
                    isbn = :isbn,
                    publication_year = :publication_year,
                    genre = :genre
                WHERE id = :book_id
                RETURNING id
            """
            result = db.session.execute(update_query, {
                'title': data['title'],
                'author_id': author_id,
                'isbn': data['isbn'],
                'publication_year': data['publication_year'],
                'genre': data['genre'],
                'book_id': book_id
            }).scalar()

            if not result:
                return jsonify({'error': 'Book not found'}), 404

            return jsonify({'message': 'Book updated successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating book: {str(e)}")
        return jsonify({'error': 'Failed to update book'}), 500

@app.route('/api/users/my-loans', methods=['GET'])
@jwt_required()
def get_my_loans():
    try:
        user_id = get_jwt_identity()
        
        query = """
            SELECT 
                l.id, b.title, CONCAT(a.first_name, ' ', a.last_name) as author,
                l.loan_date, l.return_date, l.status, res.end_date as due_date,
                (l.status = 'borrowed' AND res.end_date < CURRENT_DATE) as is_overdue
            FROM loans l
            JOIN books b ON l.book_id = b.id
            JOIN authors a ON b.author_id = a.id
            JOIN readers r ON l.reader_id = r.id
            LEFT JOIN reservations res ON l.book_id = res.book_id 
                AND l.reader_id = res.reader_id
                AND res.status = 'completed'
            WHERE r.user_id = :user_id
            ORDER BY l.loan_date DESC
        """
        
        result = db.session.execute(query, {'user_id': user_id})
        loans = [dict(row) for row in result]
        
        # Convert datetime objects to ISO format strings
        for loan in loans:
            loan['loan_date'] = loan['loan_date'].isoformat()
            loan['return_date'] = loan['return_date'].isoformat() if loan['return_date'] else None
            loan['due_date'] = loan['due_date'].isoformat() if loan['due_date'] else None
        
        return jsonify(loans)

    except Exception as e:
        current_app.logger.error(f"Error fetching user loans: {str(e)}")
        return jsonify({'error': 'Failed to fetch loans'}), 500

@app.route('/api/users/my-reservations', methods=['GET'])
@jwt_required()
def get_my_reservations():
    try:
        user_id = get_jwt_identity()
        
        query = """
            SELECT 
                res.id, b.title, CONCAT(a.first_name, ' ', a.last_name) as author,
                res.start_date, res.end_date, res.status, b.status as book_status
            FROM reservations res
            JOIN books b ON res.book_id = b.id
            JOIN authors a ON b.author_id = a.id
            JOIN readers r ON res.reader_id = r.id
            WHERE r.user_id = :user_id
            AND res.status != 'cancelled'
            ORDER BY res.start_date DESC
        """
        
        result = db.session.execute(query, {'user_id': user_id})
        reservations = [dict(row) for row in result]
        
        # Convert datetime objects to ISO format
        for res in reservations:
            res['start_date'] = res['start_date'].isoformat()
            res['end_date'] = res['end_date'].isoformat()
        
        return jsonify(reservations)

    except Exception as e:
        current_app.logger.error(f"Error fetching user reservations: {str(e)}")
        return jsonify({'error': 'Failed to fetch reservations'}), 500

@app.route('/api/health')
def health_check():
    try:
        # Test database connection
        db.session.execute('SELECT 1')
        return jsonify({
            'status': 'healthy',
            'database': 'connected'
        }), 200
    except Exception as e:
        current_app.logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/api/books/available', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required(optional=True)
def get_available_books_for_reservation():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        title = request.args.get('title', '').lower()
        author = request.args.get('author', '').lower()
        page = request.args.get('page', 1, type=int)
        per_page = 9
        offset = (page - 1) * per_page

        query = """
            SELECT 
                b.id, b.title, b.isbn, b.publication_year, 
                b.genre, b.status, b.description,
                CONCAT(a.first_name, ' ', a.last_name) as author,
                p.name as publisher,
                COUNT(*) OVER() as total_count
            FROM books b
            JOIN authors a ON b.author_id = a.id
            LEFT JOIN publishers p ON b.publisher_id = p.id
            WHERE b.status = 'available'
            AND (:title = '' OR LOWER(b.title) LIKE :title_pattern)
            AND (:author = '' OR LOWER(CONCAT(a.first_name, ' ', a.last_name)) LIKE :author_pattern)
            AND NOT EXISTS (
                SELECT 1 FROM loans l 
                WHERE l.book_id = b.id 
                AND l.status = 'borrowed'
            )
            ORDER BY b.title
            LIMIT :limit OFFSET :offset
        """
        
        result = db.session.execute(query, {
            'title': title,
            'author': author,
            'title_pattern': f'%{title}%',
            'author_pattern': f'%{author}%',
            'limit': per_page,
            'offset': offset
        })

        books = []
        total_count = 0
        
        for row in result:
            books.append({
                'id': row.id,
                'title': row.title,
                'isbn': row.isbn,
                'publication_year': row.publication_year,
                'genre': row.genre,
                'status': row.status,
                'description': row.description,
                'author': row.author,
                'publisher': row.publisher
            })
            if not total_count and hasattr(row, 'total_count'):
                total_count = row.total_count

        return jsonify({
            'books': books,
            'total': total_count,
            'pages': (total_count + per_page - 1) // per_page if total_count > 0 else 0,
            'current_page': page
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching available books: {str(e)}")
        return jsonify({'error': 'Failed to fetch books'}), 500