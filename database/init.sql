BEGIN;

DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS reader_registration_requests CASCADE;
DROP TABLE IF EXISTS readers CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;
DROP TABLE IF EXISTS publishers CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS reader_summary;
DROP MATERIALIZED VIEW IF EXISTS book_genres;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS authors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (first_name, last_name)
);

CREATE TABLE IF NOT EXISTS publishers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author_id INTEGER REFERENCES authors(id),
    isbn VARCHAR(20) UNIQUE,
    publisher_id INTEGER REFERENCES publishers(id),
    publication_year INTEGER,
    genre VARCHAR(100),
    status VARCHAR(20) DEFAULT 'available',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_publication_year CHECK (publication_year >= 1000 AND publication_year <= EXTRACT(YEAR FROM CURRENT_DATE))
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    email VARCHAR(100) UNIQUE,
    card_number VARCHAR(50) UNIQUE,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phone_number VARCHAR(20),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    reader_id INTEGER REFERENCES readers(id),
    reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    reader_id INTEGER REFERENCES readers(id),
    loan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    return_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'borrowed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reader_registration_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    address VARCHAR(200) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_by INTEGER REFERENCES users(id),
    processed_at TIMESTAMP,
    rejection_reason TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_books_updated_at
    BEFORE UPDATE ON books
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_authors_updated_at
    BEFORE UPDATE ON authors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_publishers_updated_at
    BEFORE UPDATE ON publishers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_readers_updated_at
    BEFORE UPDATE ON readers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registration_requests_updated_at
    BEFORE UPDATE ON reader_registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_books_title ON books (title);
CREATE INDEX idx_books_status ON books (status);
CREATE INDEX idx_books_title_lower ON books (LOWER(title));
CREATE INDEX idx_authors_names ON authors (first_name, last_name);
CREATE INDEX idx_readers_user_id ON readers (user_id);
CREATE INDEX idx_reader_requests_user_status ON reader_registration_requests (user_id, status);
CREATE INDEX idx_reader_requests_status ON reader_registration_requests (status);
CREATE INDEX idx_reader_requests_created_at ON reader_registration_requests (created_at DESC);
CREATE INDEX idx_reservations_book_status ON reservations (book_id, status);
CREATE INDEX idx_loans_book_status ON loans (book_id, status);
CREATE INDEX idx_loans_reader_status ON loans (reader_id, status);
CREATE INDEX idx_reservations_dates ON reservations (book_id, status, start_date, end_date)
WHERE status != 'cancelled';

CREATE MATERIALIZED VIEW reader_summary AS
SELECT 
    r.id,
    r.first_name,
    r.last_name,
    r.email,
    u.username,
    COUNT(l.id) as total_loans,
    COUNT(CASE WHEN l.status = 'borrowed' THEN 1 END) as active_loans
FROM readers r
JOIN users u ON r.user_id = u.id
LEFT JOIN loans l ON r.id = l.reader_id
GROUP BY r.id, r.first_name, r.last_name, r.email, u.username;

CREATE UNIQUE INDEX idx_reader_summary_id ON reader_summary (id);

CREATE OR REPLACE FUNCTION refresh_reader_summary()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY reader_summary;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_reader_summary_after_loan
AFTER INSERT OR UPDATE OR DELETE ON loans
FOR EACH STATEMENT EXECUTE FUNCTION refresh_reader_summary();

CREATE TRIGGER refresh_reader_summary_after_reader
AFTER INSERT OR UPDATE OR DELETE ON readers
FOR EACH STATEMENT EXECUTE FUNCTION refresh_reader_summary();

CREATE MATERIALIZED VIEW book_genres AS
SELECT DISTINCT genre 
FROM books 
WHERE genre IS NOT NULL 
ORDER BY genre;

CREATE OR REPLACE FUNCTION refresh_book_genres()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW book_genres;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_book_genres_trigger
AFTER INSERT OR UPDATE OR DELETE ON books
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_book_genres();

CREATE OR REPLACE FUNCTION check_book_availability(
    p_book_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    book_exists BOOLEAN,
    book_status VARCHAR(20),
    has_conflict BOOLEAN,
    current_holder VARCHAR(200)
) AS $$
BEGIN
    RETURN QUERY
    WITH book_check AS (
        SELECT b.id, b.status
        FROM books b
        WHERE b.id = p_book_id
    ),
    conflict_check AS (
        SELECT 
            r.id,
            CAST(CONCAT(rd.first_name, ' ', rd.last_name) AS VARCHAR(200)) as holder_name
        FROM reservations r
        JOIN readers rd ON r.reader_id = rd.id
        WHERE r.book_id = p_book_id
        AND r.status != 'cancelled'
        AND r.start_date <= p_end_date
        AND r.end_date >= p_start_date
        LIMIT 1
    )
    SELECT 
        EXISTS (SELECT 1 FROM book_check) as book_exists,
        COALESCE((SELECT status FROM book_check), 'not_found')::VARCHAR(20) as book_status,
        EXISTS (SELECT 1 FROM conflict_check) as has_conflict,
        COALESCE((SELECT holder_name FROM conflict_check), NULL)::VARCHAR(200) as current_holder;
END;
$$ LANGUAGE plpgsql;

INSERT INTO publishers (name) VALUES 
('Penguin Random House'),
('HarperCollins'),
('Simon & Schuster'),
('Macmillan Publishers'),
('Hachette Book Group'),
('Oxford University Press'),
('Cambridge University Press'),
('Scholastic'),
('Bloomsbury'),
('Wiley'),
('MIT Press'),
('Pearson Education'),
('Tor Books'),
('Del Rey Books'),
('Vintage Books'),
('Orbit Books'),
('Ace Books'),
('Baen Books'),
('DAW Books'),
('Night Shade Books'),
('Gollancz'),
('Angry Robot Books'),
('Dark Horse Comics'),
('Vertigo'),
('Subterranean Press'),
('Quirk Books'),
('Chronicle Books'),
('Hay House'),
('Titan Books'),
('Europa Editions'),
('Seven Seas'),
('Viz Media'),
('Yen Press'),
('Kodansha Comics'),
('Routledge'),
('SAGE Publications'),
('Springer Nature'),
('Elsevier'),
('Academic Press'),
('Thames & Hudson'),
('Phaidon Press'),
('Taschen'),
('Fantagraphics'),
('Image Comics'),
('First Second Books'),
('Drawn & Quarterly'),
('OReilly Media'),
('Apress'),
('Manning Publications'),
('No Starch Press'),
('Packt Publishing'),
('Addison-Wesley'),
('McGraw-Hill Education'),
('Sybex'),
('For Dummies'),
('Wrox Press'),
('Prentice Hall'),
('Microsoft Press'),
('Harvest Books'),
('Harper & Row'),
('Bantam Books'),
('Crown Publishing'),
('Houghton Mifflin Harcourt'),
('Charles Scribner''s Sons'),
('American Publishing Company'),
('Chapman & Hall'),
('William Morrow'),
('Doubleday'),
('HarperOne'),
('Allen & Unwin'),
('Scribner'),
('Penguin Classics'),
('Little, Brown and Company'),
('Grand Central Publishing'),
('Signet Classics'),
('Ballantine Books'),
('Bantam Spectra'),
('Random House'),
('Viking'),
('Celadon Books'),
('Riverhead Books'),
('Faber & Faber'),
('Harriman House'),
('Dutton Books')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authors (first_name, last_name) VALUES 
('Robert C.', 'Martin'),
('Haruki', 'Murakami'),
('Frank', 'Herbert'),
('Umberto', 'Eco'),
('Yuval Noah', 'Harari'),
('J.R.R.', 'Tolkien'),
('Jane', 'Austen'),
('J.D.', 'Salinger'),
('Harper', 'Lee'),
('George', 'Orwell'),
('F. Scott', 'Fitzgerald'),
('Isaac', 'Asimov'),
('Cormac', 'McCarthy'),
('Paulo', 'Coelho'),
('Douglas', 'Adams'),
('Margaret', 'Atwood'),
('Brandon', 'Sanderson'),
('William', 'Gibson'),
('Suzanne', 'Collins'),
('Andy', 'Weir'),
('Erin', 'Morgenstern'),
('Carlos Ruiz', 'Zafón'),
('Cixin', 'Liu'),
('Terry', 'Pratchett'),
('Donna', 'Tartt'),
('Joe', 'Abercrombie'),
('N.K.', 'Jemisin'),
('Neal', 'Stephenson'),
('Scott', 'Lynch'),
('Ursula K.', 'Le Guin'),
('Patrick', 'Rothfuss'),
('M. Scott', 'Peck'),
('Charles', 'Duhigg'),
('Rebecca', 'Skloot'),
('V.E.', 'Schwab'),
('Taylor Jenkins', 'Reid'),
('James', 'Clear'),
('Matt', 'Haig'),
('Silvia', 'Moreno-Garcia'),
('TJ', 'Klune'),
('Madeline', 'Miller'),
('Alex', 'Michaelides'),
('Tara', 'Westover'),
('Samantha', 'Shannon'),
('Adrian', 'Tchaikovsky'),
('Richard', 'Osman'),
('Amor', 'Towles'),
('Brit', 'Bennett'),
('Pierce', 'Brown'),
('Morgan', 'Housel'),
('Sarah J.', 'Maas'),
('John', 'Green'),
('Kazuo', 'Ishiguro')
ON CONFLICT (first_name, last_name) DO NOTHING;

INSERT INTO users (username, email, password_hash, role) VALUES
('worker_1', 'worker1@library.com', 'pbkdf2:sha256:600000$jkl345$hashedpassword345', 'worker'),
('worker_2', 'worker2@library.com', 'pbkdf2:sha256:600000$mno678$hashedpassword678', 'worker'),
('worker_3', 'worker3@library.com', 'pbkdf2:sha256:600000$abc890$hashedpassword123', 'worker'),
('john_doe', 'john@example.com', 'pbkdf2:sha256:600000$abc123$hashedpassword123', 'user'),
('jane_smith', 'jane@example.com', 'pbkdf2:sha256:600000$def456$hashedpassword456', 'user'),
('prof_smith', 'prof.smith@university.edu', 'pbkdf2:sha256:600000$uvw456$hashedpassword456', 'user'),
('dr_jones', 'dr.jones@research.org', 'pbkdf2:sha256:600000$xyz789$hashedpassword789', 'user'),
('tech_lead', 'techlead@company.com', 'pbkdf2:sha256:600000$klm901$hashedpassword901', 'user'),
('developer1', 'dev1@startup.com', 'pbkdf2:sha256:600000$nop234$hashedpassword234', 'user'),
('carlos_garcia', 'carlos@example.com', 'pbkdf2:sha256:600000$hij123$hashedpassword123', 'user'),
('yuki_tanaka', 'yuki@example.com', 'pbkdf2:sha256:600000$klm456$hashedpassword456', 'user');

INSERT INTO readers (first_name, last_name, address, email, phone_number, user_id) VALUES
('John', 'Doe', '123 Main St', 'john@example.com', '555-0101', (SELECT id FROM users WHERE username = 'john_doe')),
('Jane', 'Smith', '456 Oak Ave', 'jane@example.com', '555-0102', (SELECT id FROM users WHERE username = 'jane_smith')),
('Professor', 'Smith', '123 University Ave', 'prof.smith@university.edu', '555-0122', (SELECT id FROM users WHERE username = 'prof_smith')),
('Dr.', 'Jones', '456 Research Blvd', 'dr.jones@research.org', '555-0123', (SELECT id FROM users WHERE username = 'dr_jones')),
('Alex', 'Tech', '789 Silicon Valley', 'techlead@company.com', '555-0125', (SELECT id FROM users WHERE username = 'tech_lead')),
('Sam', 'Developer', '456 Startup Ave', 'dev1@startup.com', '555-0126', (SELECT id FROM users WHERE username = 'developer1')),
('Carlos', 'Garcia', 'Calle Principal 123, Madrid', 'carlos@example.com', '555-0117', (SELECT id FROM users WHERE username = 'carlos_garcia')),
('Yuki', 'Tanaka', '1-2-3 Shibuya, Tokyo', 'yuki@example.com', '555-0118', (SELECT id FROM users WHERE username = 'yuki_tanaka'));

INSERT INTO books (title, author_id, isbn, publisher_id, publication_year, genre, status, description) VALUES
('Clean Code',
 (SELECT id FROM authors WHERE first_name = 'Robert C.' AND last_name = 'Martin'),
 '9780132350884',
 (SELECT id FROM publishers WHERE name = 'Prentice Hall'),
 2008, 'Computer Science', 'available',
 'A handbook of agile software craftsmanship'),

('1Q84',
 (SELECT id FROM authors WHERE first_name = 'Haruki' AND last_name = 'Murakami'),
 '9780307593313',
 (SELECT id FROM publishers WHERE name = 'Vintage Books'),
 2011, 'Magical Realism', 'available',
 'A love story, a mystery, a fantasy, a novel of self-discovery, a dystopia to rival George Orwells'),

('Dune',
 (SELECT id FROM authors WHERE first_name = 'Frank' AND last_name = 'Herbert'),
 '9780441172719',
 (SELECT id FROM publishers WHERE name = 'Ace Books'),
 1965, 'Science Fiction', 'available',
 'The epic saga of a desert planet and its messianic hero'),

('The Name of the Rose',
 (SELECT id FROM authors WHERE first_name = 'Umberto' AND last_name = 'Eco'),
 '9780156001311',
 (SELECT id FROM publishers WHERE name = 'Harvest Books'),
 1980, 'Historical Mystery', 'available',
 'A historical murder mystery set in an Italian monastery'),

('The Hobbit',
 (SELECT id FROM authors WHERE first_name = 'J.R.R.' AND last_name = 'Tolkien'),
 '9780547928227',
 (SELECT id FROM publishers WHERE name = 'Houghton Mifflin'),
 1937, 'Fantasy', 'available',
 'A fantasy novel about the adventures of Bilbo Baggins'),

('Pride and Prejudice',
 (SELECT id FROM authors WHERE first_name = 'Jane' AND last_name = 'Austen'),
 '9780141439518',
 (SELECT id FROM publishers WHERE name = 'Penguin Classics'),
 1813, 'Romance', 'available',
 'A romantic novel about the Bennet sisters'),

('The Foundation',
 (SELECT id FROM authors WHERE first_name = 'Isaac' AND last_name = 'Asimov'),
 '9780553293357',
 (SELECT id FROM publishers WHERE name = 'Bantam Books'),
 1951, 'Science Fiction', 'available',
 'The story of the decline and rebirth of a galactic empire'),

('Neuromancer',
 (SELECT id FROM authors WHERE first_name = 'William' AND last_name = 'Gibson'),
 '9780441569595',
 (SELECT id FROM publishers WHERE name = 'Ace Books'),
 1984, 'Cyberpunk', 'available',
 'The defining novel of the cyberpunk movement'),

('The Hunger Games',
 (SELECT id FROM authors WHERE first_name = 'Suzanne' AND last_name = 'Collins'),
 '9780439023481',
 (SELECT id FROM publishers WHERE name = 'Scholastic'),
 2008, 'Young Adult', 'available',
 'A dystopian novel about survival and rebellion'),

('The Martian',
 (SELECT id FROM authors WHERE first_name = 'Andy' AND last_name = 'Weir'),
 '9780553418026',
 (SELECT id FROM publishers WHERE name = 'Crown Publishing'),
 2011, 'Science Fiction', 'available',
 'An astronaut''s fight for survival on Mars'),

('The Night Circus',
 (SELECT id FROM authors WHERE first_name = 'Erin' AND last_name = 'Morgenstern'),
 '9780385534635',
 (SELECT id FROM publishers WHERE name = 'Doubleday'),
 2011, 'Fantasy', 'available',
 'A magical competition between two illusionists'),

('The Shadow of the Wind',
 (SELECT id FROM authors WHERE first_name = 'Carlos Ruiz' AND last_name = 'Zafón'),
 '9780143034902',
 (SELECT id FROM publishers WHERE name = 'Penguin Books'),
 2001, 'Mystery', 'available',
 'A mystery set in post-war Barcelona'),

('The Three-Body Problem',
 (SELECT id FROM authors WHERE first_name = 'Cixin' AND last_name = 'Liu'),
 '9780765382030',
 (SELECT id FROM publishers WHERE name = 'Tor Books'),
 2008, 'Science Fiction', 'available',
 'First contact with an alien civilization'),

('Good Omens',
 (SELECT id FROM authors WHERE first_name = 'Terry' AND last_name = 'Pratchett'),
 '9780060853976',
 (SELECT id FROM publishers WHERE name = 'William Morrow'),
 1990, 'Fantasy Comedy', 'available',
 'The hilarious apocalypse story'),

('The Fifth Season',
 (SELECT id FROM authors WHERE first_name = 'N.K.' AND last_name = 'Jemisin'),
 '9780316229296',
 (SELECT id FROM publishers WHERE name = 'Orbit Books'),
 2015, 'Fantasy', 'available',
 'A tale of survival in a world constantly experiencing apocalyptic events'),

('Project Hail Mary',
 (SELECT id FROM authors WHERE first_name = 'Andy' AND last_name = 'Weir'),
 '9780593135204',
 (SELECT id FROM publishers WHERE name = 'Ballantine Books'),
 2021, 'Science Fiction', 'available',
 'An astronaut''s mission to save humanity'),

('Klara and the Sun',
 (SELECT id FROM authors WHERE first_name = 'Kazuo' AND last_name = 'Ishiguro'),
 '9780571364879',
 (SELECT id FROM publishers WHERE name = 'Faber & Faber'),
 2021, 'Science Fiction', 'available',
 'An AI observes human nature'),

('The Psychology of Money',
 (SELECT id FROM authors WHERE first_name = 'Morgan' AND last_name = 'Housel'),
 '9780857197689',
 (SELECT id FROM publishers WHERE name = 'Harriman House'),
 2020, 'Finance', 'available',
 'Timeless lessons on wealth, greed, and happiness'),

('Mexican Gothic',
 (SELECT id FROM authors WHERE first_name = 'Silvia' AND last_name = 'Moreno-Garcia'),
 '9780525620785',
 (SELECT id FROM publishers WHERE name = 'Del Rey Books'),
 2020, 'Horror', 'available',
 'A reimagining of the Gothic horror genre'),

('Circe',
 (SELECT id FROM authors WHERE first_name = 'Madeline' AND last_name = 'Miller'),
 '9780316556347',
 (SELECT id FROM publishers WHERE name = 'Little, Brown and Company'),
 2018, 'Mythology', 'available',
 'A retelling of the goddess Circe''s story');

INSERT INTO reader_registration_requests (user_id, first_name, last_name, address, phone_number, status, created_at) VALUES
((SELECT id FROM users WHERE username = 'tech_lead'), 'Alex', 'Tech', '789 Silicon Valley', '555-0125', 'pending', CURRENT_TIMESTAMP),
((SELECT id FROM users WHERE username = 'developer1'), 'Sam', 'Developer', '456 Startup Ave', '555-0126', 'pending', CURRENT_TIMESTAMP - INTERVAL '1 day'),
((SELECT id FROM users WHERE username = 'carlos_garcia'), 'Carlos', 'Garcia', 'Calle Principal 123, Madrid', '555-0117', 'pending', CURRENT_TIMESTAMP - INTERVAL '2 days');

INSERT INTO reservations (book_id, reader_id, start_date, end_date, status) VALUES
(1, (SELECT id FROM readers WHERE email = 'john@example.com'), CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'pending'),
(2, (SELECT id FROM readers WHERE email = 'prof.smith@university.edu'), CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '19 days', 'pending'),
(3, (SELECT id FROM readers WHERE email = 'techlead@company.com'), CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '4 days', 'completed'),
(4, (SELECT id FROM readers WHERE email = 'carlos@example.com'), CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '29 days', 'cancelled'),
(5, (SELECT id FROM readers WHERE email = 'yuki@example.com'), CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '9 days', 'pending');

INSERT INTO loans (book_id, reader_id, loan_date, return_date, status) VALUES
(3, (SELECT id FROM readers WHERE email = 'techlead@company.com'), CURRENT_DATE - INTERVAL '30 days', NULL, 'borrowed'),
(2, (SELECT id FROM readers WHERE email = 'prof.smith@university.edu'), CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '30 days', 'returned'),
(1, (SELECT id FROM readers WHERE email = 'john@example.com'), CURRENT_DATE - INTERVAL '20 days', NULL, 'borrowed'),
(5, (SELECT id FROM readers WHERE email = 'yuki@example.com'), CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '45 days', 'returned');

UPDATE books SET status = 'borrowed' WHERE id IN (
    SELECT book_id FROM loans WHERE status = 'borrowed'
);

COMMIT;