// REPLACE THESE WITH YOUR ACTUAL FIREBASE CONFIG FROM THE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDF_W0O45fsDO4MMj3lsThPUeSba48lj68",
  authDomain: "pywebsite-18291.firebaseapp.com",
  projectId: "pywebsite-18291",
  storageBucket: "pywebsite-18291.firebasestorage.app",
  messagingSenderId: "955551301242",
  appId: "1:955551301242:web:dca428c358c55992ba05c3",
  measurementId: "G-5MS5VTH0BX"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    if (e.code !== 'app/duplicate-app') console.error(e);
}
const auth = firebase.auth();

// UI Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginWrapper = document.getElementById('login-wrapper');
const appWrapper = document.getElementById('app-wrapper');
const userNameSpan = document.getElementById('user-name');

let currentUserToken = null;

// Modern Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if(type === 'success') icon = 'fa-circle-check';
    if(type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        // User logged in
        loginWrapper.style.display = 'none';
        appWrapper.style.display = 'flex';
        userNameSpan.textContent = user.displayName.split(' ')[0]; // Show first name
        
        user.getIdToken().then(token => {
            currentUserToken = token;
            loadRooms();
            showToast('Successfully logged in', 'success');
        });
    } else {
        // User logged out
        loginWrapper.style.display = 'flex';
        appWrapper.style.display = 'none';
        currentUserToken = null;
    }
});

loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        showToast("Login failed depending on configuration. Is Google Sign-in enabled?", "error");
        console.error("Login failed:", error);
    });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
    showToast('Logged out', 'info');
});

// Navigation Logic
function showSection(sectionId, btnElement) {
    document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    
    if (sectionId === 'my-bookings-section') {
        loadMyBookings();
    } else if (sectionId === 'rooms-section') {
        loadRooms();
    }
}

// Modal Logic
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';
    // tiny delay to allow display flex to apply before opacity/transform transition starts
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    // wait for transition to end
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

const addRoomBtn = document.getElementById('add-room-btn');
const newRoomNameInput = document.getElementById('new-room-name');

addRoomBtn.addEventListener('click', () => {
    const roomName = newRoomNameInput.value;
    if (!roomName || !currentUserToken) {
        showToast('Please enter a room name', 'error');
        return;
    }
    
    fetch('/api/rooms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentUserToken
        },
        body: JSON.stringify({ name: roomName })
    })
    .then(response => response.json().then(data => ({status: response.status, body: data})))
    .then(res => {
        if (res.status === 201) {
            showToast(res.body.message, 'success');
            newRoomNameInput.value = '';
            loadRooms();
        } else {
            showToast(res.body.error || "Failed to add room", 'error');
        }
    })
    .catch(err => {
        showToast("Error connecting to server", 'error');
        console.error(err);
    });
});

function loadRooms() {
    if (!currentUserToken) return;
    const roomsList = document.getElementById('rooms-list');
    roomsList.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Loading rooms...</p>';
    
    fetch('/api/rooms', {
        headers: {
            'Authorization': 'Bearer ' + currentUserToken
        }
    })
    .then(response => response.json())
    .then(data => {
        roomsList.innerHTML = '';
        if (data.rooms && data.rooms.length > 0) {
            data.rooms.forEach(room => {
                const card = document.createElement('div');
                card.className = 'room-card glass-panel';
                card.innerHTML = `
                    <div class="room-header">
                        <span class="room-title" onclick="viewRoomBookings('${room.id}', '${room.name}')"><i class="fa-solid fa-door-closed"></i> ${room.name}</span>
                        <span id="stats-${room.id}" class="room-stats"><i class="fa-solid fa-spinner fa-spin"></i></span>
                    </div>
                    <div id="avail-${room.id}" class="room-availability">Checking availability...</div>
                    <div class="room-actions">
                        <button class="btn-primary" style="flex:1" onclick="openBookingModal('${room.id}', '${room.name}')">Book</button>
                        <button class="btn-secondary" title="Calendar" onclick="viewCalendar('${room.id}', '${room.name}')"><i class="fa-solid fa-calendar"></i></button>
                        <button class="btn-danger" title="Delete Room" onclick="deleteRoom('${room.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                roomsList.appendChild(card);
                
                // Fetch Stats
                fetch('/api/stats/' + room.id, {
                    headers: {'Authorization': 'Bearer ' + currentUserToken}
                })
                .then(r => r.json())
                .then(s => {
                    const statSpan = document.getElementById('stats-' + room.id);
                    if (statSpan && s.occupancy_percentage !== undefined) {
                        statSpan.innerHTML = `<i class="fa-solid fa-chart-pie"></i> ${s.occupancy_percentage}% Full`;
                    }
                }).catch(e => console.error(e));

                // Fetch Earliest Slot
                fetch('/api/rooms/' + room.id + '/earliest_slot', {
                    headers: {'Authorization': 'Bearer ' + currentUserToken}
                })
                .then(r => r.json())
                .then(slot => {
                    const slotDiv = document.getElementById('avail-' + room.id);
                    if (slotDiv) {
                        if (slot.date) {
                            slotDiv.innerHTML = `<i class="fa-solid fa-clock"></i> Next free: ${slot.date} ${slot.available_from}`;
                        } else {
                            slotDiv.innerHTML = `<i class="fa-solid fa-ban"></i> Fully booked`;
                            slotDiv.style.color = 'var(--warning)';
                        }
                    }
                }).catch(e => console.error(e));
            });
        } else {
            roomsList.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No rooms exist yet. Create one above!</p>';
        }
    })
    .catch(err => {
        roomsList.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:red;">Error loading rooms.</p>';
        console.error("Error loading rooms:", err);
    });
}

function openBookingModal(roomId, roomName) {
    openModal('booking-modal');
    document.getElementById('booking-modal-title').textContent = `Book ${roomName}`;
    document.getElementById('book-room-id').value = roomId;
    document.getElementById('book-room-name').value = roomName;
}

const submitBookingBtn = document.getElementById('submit-booking-btn');
submitBookingBtn.addEventListener('click', () => {
    const roomId = document.getElementById('book-room-id').value;
    const roomName = document.getElementById('book-room-name').value;
    const date = document.getElementById('book-date').value;
    const startTime = document.getElementById('book-start-time').value;
    const endTime = document.getElementById('book-end-time').value;

    if (!roomId || !date || !startTime || !endTime) {
        showToast('Please fill all fields.', 'error');
        return;
    }
    
    const prevText = submitBookingBtn.textContent;
    submitBookingBtn.textContent = 'Submitting...';
    submitBookingBtn.disabled = true;

    fetch('/api/bookings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentUserToken
        },
        body: JSON.stringify({
            room_id: roomId,
            room_name: roomName,
            date: date,
            start_time: startTime,
            end_time: endTime
        })
    })
    .then(r => r.json().then(data => ({status: r.status, body: data})))
    .then(res => {
        submitBookingBtn.textContent = prevText;
        submitBookingBtn.disabled = false;
        
        if (res.status === 201) {
            closeModal('booking-modal');
            showToast('Booking successful!', 'success');
            if (document.getElementById('my-bookings-section').style.display !== 'none') {
                loadMyBookings();
            }
        } else {
            showToast(res.body.error || 'Failed to book room.', 'error');
        }
    })
    .catch(err => {
        submitBookingBtn.textContent = prevText;
        submitBookingBtn.disabled = false;
        console.error(err);
    });
});

function loadMyBookings() {
    if (!currentUserToken) return;
    const list = document.getElementById('my-bookings-list');
    list.innerHTML = '<li>Loading bookings...</li>';
    
    fetch('/api/bookings', {
        headers: {'Authorization': 'Bearer ' + currentUserToken}
    })
    .then(r => r.json())
    .then(data => {
        list.innerHTML = '';
        if (data.bookings && data.bookings.length > 0) {
            data.bookings.forEach(b => {
                const li = document.createElement('li');
                li.innerHTML = `
                <div class="booking-info">
                    <span class="booking-title">${b.room_name}</span>
                    <span class="booking-time"><i class="fa-regular fa-calendar"></i> ${b.date} | <i class="fa-regular fa-clock"></i> ${b.start_time} - ${b.end_time}</span>
                </div>
                <div class="booking-actions">
                    <button class="btn-secondary" onclick="openEditModal('${b.id}', '${b.room_id}', '${b.date}', '${b.start_time}', '${b.end_time}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-danger" onclick="deleteBooking('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>`;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li><p style="color:var(--text-muted)">You have no bookings yet.</p></li>';
        }
    })
    .catch(err => console.error(err));
}

function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    fetch('/api/bookings/' + bookingId, {
        method: 'DELETE',
        headers: {'Authorization': 'Bearer ' + currentUserToken}
    })
    .then(r => r.json().then(data => ({status: r.status, body: data})))
    .then(res => {
        if (res.status === 200) {
            showToast('Booking deleted', 'success');
            loadMyBookings();
        } else {
            showToast('Error deleting: ' + (res.body.error || 'Unknown error'), 'error');
        }
    })
    .catch(err => console.error(err));
}

function viewRoomBookings(roomId, roomName) {
    openModal('room-bookings-modal');
    document.getElementById('room-bookings-title').textContent = `Bookings for ${roomName}`;
    const list = document.getElementById('room-bookings-list');
    list.innerHTML = '<li>Loading...</li>';
    
    fetch('/api/rooms/' + roomId + '/bookings', {
        headers: {'Authorization': 'Bearer ' + currentUserToken}
    })
    .then(r => r.json())
    .then(data => {
        list.innerHTML = '';
        if (data.bookings && data.bookings.length > 0) {
            data.bookings.forEach(b => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="booking-info">
                        <span class="booking-title">${b.date}</span>
                        <span class="booking-time">${b.start_time} - ${b.end_time}</span>
                    </div>
                `;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li>No bookings found for this room.</li>';
        }
    })
    .catch(err => {
        console.error(err);
        list.innerHTML = '<li>Error loading bookings.</li>';
    });
}

function viewCalendar(roomId, roomName) {
    openModal('calendar-modal');
    document.getElementById('calendar-title').textContent = `Calendar for ${roomName}`;
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<p>Loading calendar...</p>';

    fetch('/api/rooms/' + roomId + '/bookings', {
        headers: { 'Authorization': 'Bearer ' + currentUserToken }
    })
    .then(r => r.json())
    .then(data => {
        const today = new Date();
        const dates = [];
        for(let i=0; i<5; i++){
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            dates.push(d.toISOString().split('T')[0]);
        }

        let tableHtml = '<table class="cal-table"><thead><tr><th>Time</th>';
        dates.forEach(d => { tableHtml += `<th>${d}</th>`; });
        tableHtml += '</tr></thead><tbody>';

        for (let hour = 9; hour < 18; hour++) {
            const timeStr = (hour < 10 ? '0'+hour : hour) + ':00';
            tableHtml += `<tr><td><strong>${timeStr}</strong></td>`;

            dates.forEach(dateStr => {
                const bookingsInHour = (data.bookings || []).filter(b => {
                    if (b.date !== dateStr) return false;
                    const bStartHour = parseInt(b.start_time.split(':')[0]);
                    const bEndHour = parseInt(b.end_time.split(':')[0]);
                    const bEndMin = parseInt(b.end_time.split(':')[1]);
                    
                    if (hour >= bStartHour && hour < bEndHour) return true;
                    if (hour === bEndHour && bEndMin > 0 && hour >= bStartHour) return true;
                    return false;
                });

                if (bookingsInHour.length > 0) {
                    tableHtml += '<td class="booked-slot">Booked</td>';
                } else {
                    tableHtml += '<td></td>';
                }
            });
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;
    })
    .catch(err => {
        console.error(err);
        container.innerHTML = '<p>Error loading calendar.</p>';
    });
}

const filterBtn = document.getElementById('filter-btn');
if (filterBtn) {
    filterBtn.addEventListener('click', () => {
        const date = document.getElementById('filter-date').value;
        if (!date) {
            showToast('Select a date first', 'warning');
            return;
        }
        
        const list = document.getElementById('filter-results-list');
        list.innerHTML = '<li>Loading...</li>';
        
        fetch('/api/bookings/filter?date=' + date, {
            headers: {'Authorization': 'Bearer ' + currentUserToken}
        })
        .then(r => r.json())
        .then(data => {
            list.innerHTML = '';
            if (data.bookings && data.bookings.length > 0) {
                data.bookings.forEach(b => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                    <div class="booking-info">
                        <span class="booking-title">${b.room_name}</span>
                        <span class="booking-time">${b.start_time} - ${b.end_time}</span>
                    </div>`;
                    list.appendChild(li);
                });
            } else {
                list.innerHTML = '<li>No bookings found for this date.</li>';
            }
        })
        .catch(err => console.error(err));
    });
}

function deleteRoom(roomId) {
    if (!confirm('Are you sure you want to delete this room? It will completely remove it from the database.')) return;
    
    fetch('/api/rooms/' + roomId, {
        method: 'DELETE',
        headers: {'Authorization': 'Bearer ' + currentUserToken}
    })
    .then(r => r.json().then(data => ({status: r.status, body: data})))
    .then(res => {
        if (res.status === 200) {
            showToast('Room successfully deleted.', 'success');
            loadRooms();
        } else {
            // Very clear error display handling the bug issue requested by user
            showToast(res.body.error || 'Unknown error occurred', 'error');
        }
    })
    .catch(err => console.error(err));
}

function openEditModal(bookingId, roomId, date, start, end) {
    openModal('edit-booking-modal');
    document.getElementById('edit-booking-id').value = bookingId;
    document.getElementById('edit-room-id').value = roomId;
    document.getElementById('edit-date').value = date;
    document.getElementById('edit-start-time').value = start;
    document.getElementById('edit-end-time').value = end;
}

const submitEditBtn = document.getElementById('submit-edit-btn');
if (submitEditBtn) {
    submitEditBtn.addEventListener('click', () => {
        const bookingId = document.getElementById('edit-booking-id').value;
        const roomId = document.getElementById('edit-room-id').value;
        const date = document.getElementById('edit-date').value;
        const startTime = document.getElementById('edit-start-time').value;
        const endTime = document.getElementById('edit-end-time').value;

        if (!date || !startTime || !endTime) {
            showToast('Please fill all fields.', 'error');
            return;
        }
        
        submitEditBtn.disabled = true;

        fetch('/api/bookings/' + bookingId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + currentUserToken
            },
            body: JSON.stringify({
                room_id: roomId,
                date: date,
                start_time: startTime,
                end_time: endTime
            })
        })
        .then(r => r.json().then(data => ({status: r.status, body: data})))
        .then(res => {
            submitEditBtn.disabled = false;
            if (res.status === 200) {
                closeModal('edit-booking-modal');
                showToast('Booking updated!', 'success');
                loadMyBookings();
            } else {
                showToast(res.body.error || 'Failed to update booking.', 'error');
            }
        })
        .catch(err => {
            submitEditBtn.disabled = false;
            console.error(err);
        });
    });
}
