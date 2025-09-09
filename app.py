import os
import logging
from flask import Flask, render_template, jsonify, send_from_directory, request, redirect, url_for, flash
import glob

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default_secret_key")

# Define the tests directories
TESTS_DIRS = {
    'main': 'attached_assets',   # Original tests directory
    'additional': 'additional_tests',  # New directory for additional tests
    'uploaded': 'tests',  # Directory for user-uploaded tests
    'full_2024': 'full_2024_test'  # Directory for full 2024 tests
}

# Ensure all test directories exist
for directory in TESTS_DIRS.values():
    os.makedirs(directory, exist_ok=True)

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/test_categories')
def get_test_categories():
    """Return the list of test categories."""
    categories = {
        'main': 'Каз 2024)',
        'additional': 'Русс 2023',
        'uploaded': 'Каз 2024 версия 2',
        'full_2024': 'Полный Каз 2025'
    }
    return jsonify(categories)

@app.route('/tests/<category>')
def get_tests(category):
    """Return a list of available test files for a specific category."""
    try:
        if category not in TESTS_DIRS:
            return jsonify({"error": "Категория не найдена"}), 404
        
        directory = TESTS_DIRS[category]
        # Get all .txt files in the specified directory
        test_files = [os.path.basename(f) for f in glob.glob(f"{directory}/*.txt")]
        # Sort alphabetically
        test_files.sort()
        return jsonify(test_files)
    except Exception as e:
        logging.error(f"Error getting test files for category {category}: {e}")
        return jsonify([]), 500

@app.route('/tests/<category>/<filename>')
def get_test_file(category, filename):
    """Return the content of a specific test file from a category."""
    try:
        if category not in TESTS_DIRS:
            return "Категория не найдена", 404
            
        # Validate filename to prevent directory traversal
        if '..' in filename or '/' in filename:
            return "Invalid filename", 400
        
        directory = TESTS_DIRS[category]
        # Serve the file
        return send_from_directory(directory, filename)
    except Exception as e:
        logging.error(f"Error serving test file {category}/{filename}: {e}")
        return "Файл не найден", 404

@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """Handle test file uploads."""
    if request.method == 'POST':
        # Check if a file was uploaded
        if 'file' not in request.files:
            flash('Не выбран файл', 'danger')
            return redirect(request.url)
        
        file = request.files['file']
        
        # If user doesn't select a file, browser submits an empty part
        if not file or file.filename == '':
            flash('Не выбран файл', 'danger')
            return redirect(request.url)
        
        # Valid file upload
        if file and file.filename and file.filename.endswith('.txt'):
            # Ensure valid filename
            filename = os.path.basename(str(file.filename))
            # Transliterate Cyrillic characters and remove spaces and special characters
            safe_filename = ""
            for c in filename:
                if c.isalnum() or c == '.':
                    safe_filename += c
                elif c.isspace():
                    safe_filename += '_'
                # Skip other special characters
            
            # Make sure we have a valid filename after cleaning
            if not safe_filename or safe_filename == '.txt':
                safe_filename = 'test_file.txt'
            elif not safe_filename.endswith('.txt'):
                safe_filename += '.txt'
                
            if '..' in safe_filename or '/' in safe_filename:
                flash('Недопустимое имя файла', 'danger')
                return redirect(request.url)
            
            # Save the file
            uploads_dir = TESTS_DIRS['uploaded']
            filepath = os.path.join(uploads_dir, safe_filename)
            file.save(filepath)
            
            flash(f'Файл {safe_filename} успешно загружен', 'success')
            return redirect(url_for('index'))
        else:
            flash('Разрешены только файлы .txt', 'danger')
            return redirect(request.url)
            
    # GET request - render upload form
    return render_template('upload.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
