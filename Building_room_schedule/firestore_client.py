import requests
import datetime
import uuid

def _get_json(base_url, path):
    resp = requests.get(f"{base_url}/{path}.json")
    if resp.status_code == 200 and resp.json():
        return resp.json()
    return {}

def _post_json(base_url, path, data):
    resp = requests.post(f"{base_url}/{path}.json", json=data)
    return resp

def _put_json(base_url, path, data):
    resp = requests.put(f"{base_url}/{path}.json", json=data)
    return resp

def _delete_json(base_url, path):
    resp = requests.delete(f"{base_url}/{path}.json")
    return resp

def _patch_json(base_url, path, data):
    resp = requests.patch(f"{base_url}/{path}.json", json=data)
    return resp

def create_room(base_url, room_name, user_uid):
    if not room_name or not room_name.strip():
        return False, "Room name cannot be empty."
    room_name = room_name.strip()

    rooms = _get_json(base_url, 'rooms')
    if rooms:
        for key, val in rooms.items():
            if val.get('name') == room_name:
                return False, "A room with this name already exists."

    new_room = {
        'name': room_name,
        'creator_uid': user_uid,
        'created_at': datetime.datetime.utcnow().isoformat()
    }
    
    try:
        _post_json(base_url, 'rooms', new_room)
        return True, f"Room '{room_name}' added successfully."
    except Exception as e:
        return False, str(e)

def get_rooms(base_url):
    try:
        docs = _get_json(base_url, 'rooms')
        rooms = []
        if docs:
            for key, val in docs.items():
                r = val.copy()
                r['id'] = key
                rooms.append(r)
        
        rooms.sort(key=lambda x: x.get('name', '').lower())
        return rooms
    except Exception as e:
        print(f"Error fetching rooms: {e}")
        return []

def create_booking_transaction(base_url, room_id, room_name, user_uid, date_str, start_time, end_time):
    if start_time >= end_time:
        return False, "Start time must be before end time."

    try:
        all_bookings = _get_json(base_url, 'bookings')
        if all_bookings:
            for key, b_data in all_bookings.items():
                if b_data.get('room_id') == room_id and b_data.get('date') == date_str:
                    ex_start = b_data.get('start_time')
                    ex_end = b_data.get('end_time')
                    
                    if not (end_time <= ex_start or start_time >= ex_end):
                        return False, f"Time overlaps with an existing booking ({ex_start} - {ex_end})."

        new_booking = {
            'room_id': room_id,
            'room_name': room_name,
            'user_uid': user_uid,
            'date': date_str,
            'start_time': start_time,
            'end_time': end_time,
            'created_at': datetime.datetime.utcnow().isoformat()
        }
        _post_json(base_url, 'bookings', new_booking)
        return True, "Booking successful."
    except Exception as e:
        print(f"Transaction failed: {e}")
        return False, "An error occurred during booking. Please try again."

def get_user_bookings(base_url, user_uid):
    try:
        docs = _get_json(base_url, 'bookings')
        bookings = []
        if docs:
            for key, b in docs.items():
                if b.get('user_uid') == user_uid:
                    b_copy = b.copy()
                    b_copy['id'] = key
                    bookings.append(b_copy)
        
        bookings.sort(key=lambda x: (x.get('date', ''), x.get('start_time', '')))
        return bookings
    except Exception as e:
        print(f"Error fetching user bookings: {e}")
        return []

def get_room_bookings(base_url, room_id):
    try:
        docs = _get_json(base_url, 'bookings')
        bookings = []
        if docs:
            for key, b in docs.items():
                if b.get('room_id') == room_id:
                    b_copy = b.copy()
                    b_copy['id'] = key
                    bookings.append(b_copy)
        
        bookings.sort(key=lambda x: (x.get('date', ''), x.get('start_time', '')))
        return bookings
    except Exception as e:
        print(f"Error fetching room bookings: {e}")
        return []

def delete_booking(base_url, booking_id, user_uid):
    try:
        b_data = _get_json(base_url, f'bookings/{booking_id}')
        if not b_data:
            return False, "Booking not found."
            
        if b_data.get('user_uid') != user_uid:
            return False, "Not authorized to delete this booking."
            
        _delete_json(base_url, f'bookings/{booking_id}')
        return True, "Booking deleted."
    except Exception as e:
        return False, str(e)

def edit_booking_transaction(base_url, booking_id, room_id, user_uid, date_str, start_time, end_time):
    if start_time >= end_time:
        return False, "Start time must be before end time."

    try:
        b_data = _get_json(base_url, f'bookings/{booking_id}')
        if not b_data:
            return False, "Booking not found."
        if b_data.get('user_uid') != user_uid:
            return False, "Not authorized to edit this booking."

        # Check overlaps
        all_bookings = _get_json(base_url, 'bookings')
        if all_bookings:
            for key, b in all_bookings.items():
                if key == booking_id:
                    continue
                if b.get('room_id') == room_id and b.get('date') == date_str:
                    ex_start = b.get('start_time')
                    ex_end = b.get('end_time')
                    if not(end_time <= ex_start or start_time >= ex_end):
                        return False, f"Time overlaps with an existing booking ({ex_start} - {ex_end})."

        _patch_json(base_url, f'bookings/{booking_id}', {
            'date': date_str,
            'start_time': start_time,
            'end_time': end_time
        })
        return True, "Booking updated successfully."
    except Exception as e:
        print(f"Transaction failed: {e}")
        return False, "An error occurred during edit. Please try again."

def delete_room(base_url, room_id, user_uid):
    try:
        r_data = _get_json(base_url, f'rooms/{room_id}')
        if not r_data:
            return False, "Room not found."
            
        if r_data.get('creator_uid') != user_uid:
            return False, "Only the creator can delete this room."
            
        all_bookings = _get_json(base_url, 'bookings')
        if all_bookings:
            for key, b in all_bookings.items():
                if b.get('room_id') == room_id:
                    return False, "Cannot delete room: bookings exist."
            
        _delete_json(base_url, f'rooms/{room_id}')
        return True, "Room deleted successfully."
    except Exception as e:
        return False, str(e)

def calculate_occupancy(base_url, room_id):
    try:
        today = datetime.date.today()
        dates = [(today + datetime.timedelta(days=i)).isoformat() for i in range(5)]
        
        total_booked_minutes = 0
        all_bookings = _get_json(base_url, 'bookings')
        
        if all_bookings:
            for key, b in all_bookings.items():
                if b.get('room_id') == room_id and b.get('date') in dates:
                    start = b.get('start_time', '09:00')
                    end = b.get('end_time', '09:00')
                    
                    def to_mins(t_str):
                        h, m = map(int, t_str.split(':'))
                        return h * 60 + m
                        
                    s_m = max(to_mins("09:00"), to_mins(start))
                    e_m = min(to_mins("18:00"), to_mins(end))
                    
                    if e_m > s_m:
                        total_booked_minutes += (e_m - s_m)
                
        # 5 days * 9 hours * 60 minutes = 2700 minutes total
        pct = (total_booked_minutes / 2700.0) * 100
        return round(pct, 1)
    except Exception as e:
        print(f"Error calculating occupancy: {e}")
        return 0.0

def get_all_bookings_by_date(base_url, date_str):
    try:
        all_bookings = _get_json(base_url, 'bookings')
        bookings = []
        if all_bookings:
            for key, b in all_bookings.items():
                if b.get('date') == date_str:
                    b_copy = b.copy()
                    b_copy['id'] = key
                    bookings.append(b_copy)
        
        bookings.sort(key=lambda x: x.get('start_time', ''))
        return bookings
    except Exception as e:
        print(f"Error filtering bookings: {e}")
        return []

def find_earliest_slot(base_url, room_id):
    try:
        today = datetime.date.today()
        dates = [(today + datetime.timedelta(days=i)).isoformat() for i in range(5)]
        
        all_bookings = _get_json(base_url, 'bookings')
        
        from collections import defaultdict
        daily_bookings = defaultdict(list)
        
        if all_bookings:
            for key, b in all_bookings.items():
                if b.get('room_id') == room_id and b.get('date') in dates:
                    daily_bookings[b['date']].append(b)
            
        def to_mins(t_str):
            h, m = map(int, t_str.split(':'))
            return h * 60 + m
            
        def to_str(mins):
            h = mins // 60
            m = mins % 60
            return f"{h:02d}:{m:02d}"
            
        open_start = to_mins("09:00")
        open_end = to_mins("18:00")
        
        for date_str in dates:
            day_b = daily_bookings[date_str]
            day_b.sort(key=lambda x: to_mins(x.get('start_time', '09:00')))
            
            current_time = open_start
            
            for b in day_b:
                b_start = to_mins(b.get('start_time', '09:00'))
                b_end = to_mins(b.get('end_time', '09:00'))
                
                # Find gap before this booking
                if current_time < b_start:
                    gap_end = min(b_start, open_end)
                    if gap_end > current_time:
                        return {"date": date_str, "available_from": to_str(current_time), "available_to": to_str(gap_end)}
                
                current_time = max(current_time, b_end)
                
            if current_time < open_end:
                return {"date": date_str, "available_from": to_str(current_time), "available_to": "18:00"}
                
        return {"date": None, "message": "No available slots in the next 5 days."}

    except Exception as e:
        print(f"Error finding slot: {e}")
        return {"error": "Failed to find slot"}

