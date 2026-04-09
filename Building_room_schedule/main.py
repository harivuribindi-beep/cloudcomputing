import os
from flask import Flask, render_template, request, jsonify
from google.auth.transport import requests as google_requests
import google.oauth2.id_token
import firestore_client

app = Flask(__name__)

# Base URL for the public Realtime Database
RTDB_BASE_URL = 'https://pywebsite-18291-default-rtdb.firebaseio.com'

# Initialize Firebase Request object for verifying frontend Auth tokens
PROJECT_ID = "pywebsite-18291"
firebase_request_adapter = google_requests.Request()

def verify_token(id_token):
    if not id_token:
        return None
    try:
        claims = google.oauth2.id_token.verify_firebase_token(
            id_token, firebase_request_adapter, PROJECT_ID)
        return claims
    except Exception as exc:
        print(f"Token verification failed: {exc}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/rooms', methods=['GET', 'POST'])
def handle_rooms():
    # Verify user token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized: Missing or invalid token'}), 401
    
    token = auth_header.split('Bearer ')[1]
    user_claims = verify_token(token)
    if not user_claims:
        return jsonify({'error': 'Unauthorized: Token verification failed'}), 401
    
    user_uid = user_claims.get('uid')
    
    if request.method == 'GET':
        rooms = firestore_client.get_rooms(RTDB_BASE_URL)
        return jsonify({'rooms': rooms})
    
    if request.method == 'POST':
        data = request.get_json()
        room_name = data.get('name', '')
        success, message = firestore_client.create_room(RTDB_BASE_URL, room_name, user_uid)
        
        if success:
            return jsonify({'message': message}), 201
        else:
            return jsonify({'error': message}), 400

@app.route('/api/bookings', methods=['GET', 'POST'])
def handle_bookings():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    token = auth_header.split('Bearer ')[1]
    user_claims = verify_token(token)
    if not user_claims:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_uid = user_claims.get('uid')
    
    if request.method == 'GET':
        bookings = firestore_client.get_user_bookings(RTDB_BASE_URL, user_uid)
        return jsonify({'bookings': bookings})
        
    if request.method == 'POST':
        data = request.get_json()
        room_id = data.get('room_id')
        room_name = data.get('room_name')
        date_str = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        if not all([room_id, room_name, date_str, start_time, end_time]):
            return jsonify({'error': 'Missing required fields'}), 400
            
        success, message = firestore_client.create_booking_transaction(
            RTDB_BASE_URL, room_id, room_name, user_uid, date_str, start_time, end_time)
            
        if success:
            return jsonify({'message': message}), 201
        else:
            return jsonify({'error': message}), 400

@app.route('/api/rooms/<room_id>/bookings', methods=['GET'])
def get_room_bookings(room_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    token = auth_header.split('Bearer ')[1]
    if not verify_token(token):
        return jsonify({'error': 'Unauthorized'}), 401
        
    bookings = firestore_client.get_room_bookings(RTDB_BASE_URL, room_id)
    return jsonify({'bookings': bookings})

@app.route('/api/bookings/<booking_id>', methods=['PUT', 'DELETE'])
def handle_booking(booking_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    token = auth_header.split('Bearer ')[1]
    user_claims = verify_token(token)
    if not user_claims:
        return jsonify({'error': 'Unauthorized'}), 401
        
    user_uid = user_claims.get('uid')
    
    if request.method == 'DELETE':
        success, message = firestore_client.delete_booking(RTDB_BASE_URL, booking_id, user_uid)
        if success:
            return jsonify({'message': message}), 200
        else:
            return jsonify({'error': message}), 400
            
    if request.method == 'PUT':
        data = request.get_json()
        room_id = data.get('room_id')
        date_str = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        if not all([room_id, date_str, start_time, end_time]):
            return jsonify({'error': 'Missing required fields'}), 400
            
        success, message = firestore_client.edit_booking_transaction(
            RTDB_BASE_URL, booking_id, room_id, user_uid, date_str, start_time, end_time)
            
        if success:
            return jsonify({'message': message}), 200
        else:
            return jsonify({'error': message}), 400

@app.route('/api/rooms/<room_id>', methods=['DELETE'])
def handle_room(room_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    token = auth_header.split('Bearer ')[1]
    user_claims = verify_token(token)
    if not user_claims:
        return jsonify({'error': 'Unauthorized'}), 401
        
    user_uid = user_claims.get('uid')
    
    success, message = firestore_client.delete_room(RTDB_BASE_URL, room_id, user_uid)
    if success:
        return jsonify({'message': message}), 200
    else:
        return jsonify({'error': message}), 400

@app.route('/api/stats/<room_id>', methods=['GET'])
def get_room_stats(room_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    pct = firestore_client.calculate_occupancy(RTDB_BASE_URL, room_id)
    return jsonify({'occupancy_percentage': pct})

@app.route('/api/bookings/filter', methods=['GET'])
def filter_bookings():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
        
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Date parameter is required'}), 400
        
    bookings = firestore_client.get_all_bookings_by_date(RTDB_BASE_URL, date_str)
    return jsonify({'bookings': bookings})

@app.route('/api/rooms/<room_id>/earliest_slot', methods=['GET'])
def get_earliest_slot(room_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    slot = firestore_client.find_earliest_slot(RTDB_BASE_URL, room_id)
    return jsonify(slot)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
