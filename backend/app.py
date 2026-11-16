from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import subprocess
import sys

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Sample / plugin library folders
LIBRARY_DIRS = {
    'samples': os.path.join(BASE_DIR, 'samples'),
    'effects': os.path.join(BASE_DIR, 'plugins', 'effects'),
    'instruments': os.path.join(BASE_DIR, 'plugins', 'instruments')
}
for folder in LIBRARY_DIRS.values():
    os.makedirs(folder, exist_ok=True)


def scan_tree(path, root):
    entries = []
    try:
        items = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
    except OSError:
        return entries
    for entry in items:
        rel = os.path.relpath(entry.path, root).replace('\\', '/')
        node = {
            'name': entry.name,
            'path': rel,
            'type': 'folder' if entry.is_dir() else 'file'
        }
        if entry.is_dir():
            node['children'] = scan_tree(entry.path, root)
        else:
            try:
                node['size'] = entry.stat().st_size
            except OSError:
                node['size'] = 0
        entries.append(node)
    return entries

# Configure static file serving
app.config['STATIC_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../frontend/build')
app.config['CORS_ORIGINS'] = ['http://localhost:4200']

# Song data store (in-memory for demo)
songs = {}
current_song_id = 0

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Backend is running'})

@app.route('/api/library', methods=['GET'])
def get_library():
    return jsonify({
        'root': BASE_DIR,
        'folders': {
            name: scan_tree(path, BASE_DIR)
            for name, path in LIBRARY_DIRS.items()
        }
    })


@app.route('/api/library/open', methods=['POST'])
def open_library_folder():
    data = request.json or {}
    name = data.get('folder', 'samples')
    path = LIBRARY_DIRS.get(name)
    if not path:
        return jsonify({'error': 'Unknown folder', 'folders': list(LIBRARY_DIRS.keys())}), 400
    os.makedirs(path, exist_ok=True)
    try:
        if sys.platform.startswith('win'):
            os.startfile(path)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', path])
        else:
            subprocess.Popen(['xdg-open', path])
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500
    return jsonify({'opened': path})


@app.route('/api/library/file/<path:rel_path>', methods=['GET'])
def get_library_file(rel_path):
    return send_from_directory(BASE_DIR, rel_path)


@app.route('/api/songs', methods=['GET'])
def get_songs():
    return jsonify({'songs': list(songs.values())})


@app.route('/api/songs', methods=['POST'])
def create_song():
    global current_song_id
    data = request.json or {}
    song_id = str(current_song_id)
    current_song_id += 1
    song = {
        'id': song_id,
        'name': data.get('name', 'Untitled'),
        'patterns': data.get('patterns', []),
        'bpm': data.get('bpm', 120),
        'status': 'stopped'
    }
    songs[song_id] = song
    return jsonify(song), 201

@app.route('/api/songs/<song_id>', methods=['GET'])
def get_song(song_id):
    song = songs.get(song_id)
    if song:
        return jsonify(song)
    return jsonify({'error': 'Song not found'}), 404

@app.route('/api/songs/<song_id>', methods=['PUT'])
def update_song(song_id):
    song = songs.get(song_id)
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    data = request.json or {}
    song['name'] = data.get('name', song['name'])
    song['bpm'] = data.get('bpm', song['bpm'])
    song['patterns'] = data.get('patterns', song['patterns'])
    return jsonify(song)

@app.route('/api/songs/<song_id>', methods=['DELETE'])
def delete_song(song_id):
    if song_id in songs:
        del songs[song_id]
        return jsonify({'result': 'deleted'})
    return jsonify({'error': 'Song not found'}), 404

# Serve Angular app
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_angular(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(app.config['STATIC_FOLDER'], 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)