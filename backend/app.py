from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

# Configure static file serving
app.config['STATIC_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../frontend/build')
app.config['CORS_ORIGINS'] = ['http://localhost:4200']

# Song data store (in-memory for demo)
songs = {}
current_song_id = 0

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Backend is running'})

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