import os
import logging
from flask import Flask, render_template, jsonify, send_from_directory, request, redirect, url_for, flash
import glob
import re

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
    'full_2024': 'full_2024_test'  # New directory for 2024 full tests
}

# Ensure all test directories exist
for directory in TESTS_DIRS.values():
    os.makedirs(directory, exist_ok=True)

# Function to sanitize and display filenames
def sanitize_filename(filename):
    """Convert filename to safe and readable format for frontend."""
    # Handle filenames like __________________________96_____.txt
    match = re.match(r'_+\d+_+\.txt$', filename)
    if match:
        number = re.search(r'\d+', filename).group()
        display_name = f"Тест {number}"
        safe_filename = f"test_{number}.txt"
    # Handle filenames like full_kaz_2025.txt
    elif filename.startswith('full_kaz_') and filename.endswith('.txt'):
        year = re.search(r'(\d{4})\.txt$', filename)
        if year:
            display_name = f"Тест Каз {year.group(1)}"
            safe_filename = f"test_kaz_{year.group(1)}.txt"
        else:
            display_name = "Тест Каз"
            safe_filename = "test_kaz.txt"
    else:
        # Fallback for other filenames
        safe_filename = ""
        for c in filename:
            if c.isalnum() or c == '.':
                safe_filename += c
            elif c.isspace():
                safe_filename += '_'
        safe_filename = re.sub(r'[^a-zA-Z0-9._]', '_', safe_filename)
        if not safe_filename.endswith('.txt'):
            safe_filename += '.txt'
        display_name = safe_filename.replace('_', ' ').replace('.txt', '')
    # Remove multiple consecutive underscores
    safe_filename = re.sub(r'_+', '_', safe_filename)
    return safe_filename, display_name

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/test_categories')
def get_test_categories():
    """Return the list of test categories."""
    categories = {
        'main': 'Основные тесты (в начале июня скинули)',
        'additional': 'Дополнительные тесты (русский прошлый год)',
        'uploaded': 'Загруженные тесты (прошлый месяц каз)',
        'full_2024': 'Полный Каз 2025'
    }
    return jsonify(categories)

@app.route('/tests/<category>')
def get_tests(category):
    """Return a list of available test files with display names for a specific category."""
    try:
        if category not in TESTS_DIRS:
            return jsonify({"error": "Категория не найдена"}), 404
        
        directory = TESTS_DIRS[category]
        # Get all .txt files in the specified directory
        test_files = [os.path.basename(f) for f in glob.glob(f"{directory}/*.txt")]
        # Create list of {safe_filename, display_name} for each file
        test_files_info = []
        for f in test_files:
            safe_filename, display_name = sanitize_filename(f)
            test_files_info.append({
                "filename": safe_filename,
                "display_name": display_name
            })
        # Sort by display_name
        test_files_info.sort(key=lambda x: x["display_name"])
        return jsonify(test_files_info)
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
        # Find the actual file that matches the sanitized filename
        test_files = [os.path.basename(f) for f in glob.glob(f"{directory}/*.txt")]
        for actual_filename in test_files:
            safe_filename, _ = sanitize_filename(actual_filename)
            if safe_filename == filename:
                return send_from_directory(directory, actual_filename)
        
        return "Файл не найден", 404
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
            # Sanitize filename
            safe_filename, _ = sanitize_filename(filename)
            
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
