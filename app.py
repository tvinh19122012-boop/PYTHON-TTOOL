import os
import subprocess
import shlex
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Giới hạn 50MB mỗi file, mày muốn hơn thì sửa
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Danh sách whitelist extension (thêm bớt tùy mày)
ALLOWED_EXTENSIONS = {
    'txt', 'py', 'js', 'json', 'csv', 'sh', 'zip',
    'tar', 'gz', 'log', 'md', 'html', 'css', 'xml', 'yaml', 'yml'
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def home():
    return render_template('index.html')


# ============ UPLOAD FILE ============
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "Không có file trong request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "Chưa chọn file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Định dạng file không được phép"}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(save_path)

    size = os.path.getsize(save_path)
    return jsonify({
        "success": True,
        "filename": filename,
        "size": size,
        "message": f"Đã upload {filename}"
    })


# ============ LIST FILE ĐÃ UPLOAD ============
@app.route('/files', methods=['GET'])
def list_files():
    files = []
    for f in os.listdir(UPLOAD_FOLDER):
        if f == '.gitkeep':
            continue
        path = os.path.join(UPLOAD_FOLDER, f)
        if os.path.isfile(path):
            files.append({
                "name": f,
                "size": os.path.getsize(path)
            })
    return jsonify({"success": True, "files": files})


# ============ XÓA FILE ============
@app.route('/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    filename = secure_filename(filename)
    path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"success": True, "message": f"Đã xóa {filename}"})
    return jsonify({"success": False, "error": "File không tồn tại"}), 404


# ============ CHẠY LỆNH TERMINAL ============
@app.route('/exec', methods=['POST'])
def exec_command():
    data = request.get_json()
    if not data or 'cmd' not in data:
        return jsonify({"success": False, "error": "Thiếu cmd"}), 400

    cmd = data['cmd'].strip()
    if not cmd:
        return jsonify({"success": False, "error": "Lệnh rỗng"}), 400

    try:
        # Chạy trong thư mục uploads, timeout 30s
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=UPLOAD_FOLDER,
            capture_output=True,
            text=True,
            timeout=30
        )
        return jsonify({
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        })
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Lệnh chạy quá 30 giây, bị kill"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============ DOWNLOAD FILE ============
@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    filename = secure_filename(filename)
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)