from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class Author(db.Model):
    __tablename__ = 'authors'
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    books = db.relationship('Book', backref='author')

class Publisher(db.Model):
    __tablename__ = 'publishers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    books = db.relationship('Book', backref='publisher')

class Book(db.Model):
    __tablename__ = 'books'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    isbn = db.Column(db.String(20), unique=True)
    publication_year = db.Column(db.Integer)
    genre = db.Column(db.String(100))
    status = db.Column(db.String(20), default='available')
    
    author_id = db.Column(db.Integer, db.ForeignKey('authors.id'))
    publisher_id = db.Column(db.Integer, db.ForeignKey('publishers.id'))
    
    loans = db.relationship('Loan', backref='book')
    reservations = db.relationship('Reservation', backref='book')

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='user')  # 'user', 'worker', 'admin'
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Reader(db.Model):
    __tablename__ = 'readers'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    email = db.Column(db.String(100), unique=True)
    card_number = db.Column(db.String(50), unique=True)
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    phone_number = db.Column(db.String(20))
    
    user = db.relationship('User', backref='reader_profile')
    loans = db.relationship('Loan', backref='reader', lazy='dynamic')
    reservations = db.relationship('Reservation', backref='reader', lazy='dynamic')

class Loan(db.Model):
    __tablename__ = 'loans'
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('books.id'))
    reader_id = db.Column(db.Integer, db.ForeignKey('readers.id'))
    loan_date = db.Column(db.DateTime, default=datetime.utcnow)
    return_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='borrowed')

class Reservation(db.Model):
    __tablename__ = 'reservations'
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('books.id'))
    reader_id = db.Column(db.Integer, db.ForeignKey('readers.id'))
    reservation_date = db.Column(db.DateTime, default=datetime.utcnow)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='pending')

class ReaderRegistrationRequest(db.Model):
    __tablename__ = 'reader_registration_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    processed_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='registration_requests')
    processor = db.relationship('User', foreign_keys=[processed_by], backref='processed_requests')