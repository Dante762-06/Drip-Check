// 1. Firebase Module Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 2. Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDCmVI_P3RCb5d07GmbY2Gy_QfLg5-1Kms",
    authDomain: "drip-check-d01fa.firebaseapp.com",
    databaseURL: "https://drip-check-d01fa-default-rtdb.firebaseio.com",
    projectId: "drip-check-d01fa",
    storageBucket: "drip-check-d01fa.firebasestorage.app",
    messagingSenderId: "1074361514778",
    appId: "1:1074361514778:web:b0df05275daf535ad20aa3",
    measurementId: "G-CELZ0D84JH"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Set persistence to SESSION (Force login on tab close/new window)
setPersistence(auth, browserSessionPersistence)
    .catch((error) => {
        console.error("Auth Persistence Error:", error);
    });

// Global State
let patients = [];
let monitorData = {}; // Store raw monitor data
let mockDataCache = {}; // Cache for stable mock data
let myChart = null;
let isLoginMode = true;
let sortState = { column: 'dripLeft', direction: 'asc' }; // storage for sort state
const MAX_PATIENTS = 50;

// --- Helper: Get Color State ---
function getStatusColor(level) {
    if (level < 50) return { text: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-500', hex: '#eab308', label: 'CRITICAL', zone: 'yellow' };
    if (level < 150) return { text: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-500', hex: '#f97316', label: 'LOW', zone: 'orange' };
    if (level < 300) return { text: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-500', hex: '#eab308', label: 'WARNING', zone: 'yellow' };
    return { text: 'text-green-600', bg: 'bg-green-600', border: 'border-green-600', hex: '#16a34a', label: 'GOOD', zone: 'green' };
}

// --- 4. DATA SYNC LOGIC (The "Fix") ---
// This function is only called once the Doctor is authenticated
// --- 4. DATA SYNC LOGIC (The "Fix") ---
// This function is only called once the Doctor is authenticated
function startDataSync() {
    const patientsRef = ref(db, 'patients');
    const monitorRef = ref(db, 'saline_monitor');

    // Fetch Monitor Data Realtime
    onValue(monitorRef, (snapshot) => {
        monitorData = snapshot.val() || {};
        refreshApp(); // Trigger UI update when monitor data changes
    });

    // Fetch Patient Data Realtime
    onValue(patientsRef, (snapshot) => {
        const data = snapshot.val();
        rawPatientData = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        refreshApp();
    });
}

let rawPatientData = [];

function refreshApp() {
    // Merge Logic (Real + Mock)
    // Merge Logic (Real + Mock)
    // DEBUG: Log monitor data structure
    console.log('=== MONITOR DATA DEBUG ===');
    console.log('Monitor Data Keys:', Object.keys(monitorData));
    console.log('Full Monitor Data:', monitorData);

    patients = rawPatientData.map(p => {
        console.log(`\n--- Processing Patient: ${p.name}, Room: ${p.roomNo} ---`);

        // Match Strategy:
        // 1. Check if any monitor object has 'roomNo' property matching p.roomNo
        // 2. Fallback to Key matching (monitorData[p.roomNo])
        // 3. Fallback to Name matching (monitorData[p.name]) for specific test cases

        let monitor = Object.values(monitorData).find(m => {
            if (!m) return false;

            // PRIORITY: Check 'class' property (saline_monitor uses this for room number)
            if (m.class !== undefined) {
                const match = String(m.class) === String(p.roomNo);
                console.log(`  Checking monitor.class ${m.class} against patient room ${p.roomNo}: ${match}`);
                return match;
            }

            // FALLBACK: Check 'roomNo' property
            if (m.roomNo !== undefined) {
                const match = String(m.roomNo) === String(p.roomNo);
                console.log(`  Checking monitor.roomNo ${m.roomNo} against patient room ${p.roomNo}: ${match}`);
                return match;
            }

            return false;
        });

        if (!monitor) {
            console.log(`  Property match failed, trying key match: monitorData["${String(p.roomNo)}"]`);
            monitor = monitorData[String(p.roomNo)];
        }

        if (!monitor) {
            console.log(`  Key match failed, trying name match: monitorData["${p.name}"]`);
            monitor = monitorData[p.name];
        }

        console.log(`  Final monitor found:`, monitor ? 'YES' : 'NO');
        if (monitor) {
            console.log(`  Monitor data:`, monitor);
        }

        // Only use real monitor data - no mock data generation
        let rate = 'N/A';
        let time = 'N/A';

        if (monitor) {
            rate = monitor.rate || 'N/A';
            time = monitor.time_left || 'N/A';
        }

        // Use volume from monitor only - no patient DB fallback
        let vol = 0;
        if (monitor && monitor.volume !== undefined) {
            vol = monitor.volume;
        }

        return {
            ...p,
            dripRate: rate,
            timeLeft: time,
            dripLeft: vol
        };
    });


    renderDropdown();
    checkAlerts();

    // Refresh active views
    if (!document.getElementById('page-database').classList.contains('hidden')) {
        renderDatabase();
    }

    // Refresh patient card if it's currently displayed
    if (!document.getElementById('page-patients').classList.contains('hidden')) {
        const container = document.getElementById('active-card-container');
        if (container && container.children.length > 0) {
            // Extract current patient ID from the displayed card
            const currentCard = container.querySelector('[onclick*="deletePatient"]');
            if (currentCard) {
                const match = currentCard.getAttribute('onclick').match(/'([^']+)'/);
                if (match) {
                    window.showPatientCard(match[1]); // Refresh the card with updated data
                }
            }
        }
    }
}

// --- 5. AUTHENTICATION LOGIC ---
onAuthStateChanged(auth, (user) => {
    const header = document.getElementById('main-header');
    const alertBox = document.getElementById('urgent-alert-container');

    if (user) {
        // Logged In: Show App
        header.classList.remove('hidden');
        startDataSync(); // Start listening to data now that we have permission
        loadUserProfile(); // Load User Profile Data

        if (!document.getElementById('page-login').classList.contains('hidden')) {
            window.showPage('home');
        }
    } else {
        // Logged Out: Show Login Only
        header.classList.add('hidden');
        alertBox.classList.add('hidden'); // Fix: Ensure alerts don't show on login
        document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
        document.getElementById('page-login').classList.remove('hidden');
        patients = []; // Clear local data
    }
});

document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('txtEmail').value;
    const pass = document.getElementById('txtPassword').value;

    if (isLoginMode) {
        signInWithEmailAndPassword(auth, email, pass)
            .catch((error) => {
                alert("Login Failed: " + error.message);
            });
    } else {
        const role = document.getElementById('txtRole').value;
        const name = document.getElementById('txtSignupName').value;
        const dob = document.getElementById('txtSignupDob').value;

        createUserWithEmailAndPassword(auth, email, pass)
            .then((userCredential) => {
                // Save Profile to DB
                set(ref(db, `users/${userCredential.user.uid}`), {
                    role: role,
                    email: email,
                    name: name,
                    dob: dob,
                    photoBase64: '' // Placeholder
                }).then(() => {
                    alert("Account Created! Signing you in...");
                });
            })
            .catch((error) => {
                alert("Registration Failed: " + error.message);
            });
    }
};

window.toggleAuthMode = function () {
    isLoginMode = !isLoginMode;
    const title = document.querySelector('#page-login h1');
    const subtitle = document.querySelector('#page-login p.text-blue-200');
    const btn = document.getElementById('btnLogin');
    const toggleText = document.getElementById('authToggleText');
    const toggleBtn = document.getElementById('authToggleBtn');

    const signupFields = document.getElementById('signupFields');
    const nameInput = document.getElementById('txtSignupName');
    const dobInput = document.getElementById('txtSignupDob');

    if (isLoginMode) {
        title.textContent = "Drip-Sync Login";
        subtitle.textContent = "Please authenticate to continue";
        btn.textContent = "Login via Firebase";
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = "Sign Up";

        signupFields.classList.add('hidden');
        nameInput.required = false;
        dobInput.required = false;
    } else {
        title.textContent = "Create Account";
        subtitle.textContent = "Register a new account";
        btn.textContent = "Sign Up & Login";
        toggleText.textContent = "Already have an account?";
        toggleBtn.textContent = "Login";

        signupFields.classList.remove('hidden');
        nameInput.required = true; // Ensure these are filled for signup
        dobInput.required = true;
    }
};

window.logout = function () {
    const uid = auth.currentUser?.uid;
    if (uid) {
        update(ref(db, `users/${uid}`), { lastLogin: Date.now() })
            .then(() => signOut(auth))
            .then(() => alert("Logged out successfully"))
            .catch((e) => console.error(e));
    } else {
        signOut(auth).then(() => alert("Logged out successfully"));
    }
};

// --- 6. NAVIGATION & UI ---
window.showPage = function (pageId) {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');
    if (pageId === 'database') renderDatabase();
    if (pageId === 'profile') cancelEditMode();
    if (pageId === 'admin') loadAdminUsers();
};

window.toggleDropdown = function (e) {
    e.stopPropagation();
    document.getElementById('patientDropdown').classList.toggle('hidden');
};

window.renderDatabase = function () {
    updateChart();
    const tbody = document.getElementById('dbBody');
    if (!tbody) return;

    const searchRoom = document.getElementById('searchRoom')?.value || '';
    const searchName = document.getElementById('searchName')?.value.toLowerCase() || '';

    // Filter patients
    const filteredPatients = patients.filter(p =>
        p.roomNo.toString().includes(searchRoom) &&
        p.name.toLowerCase().includes(searchName)
    );

    // Sort: Using sortState
    const sortedPatients = filteredPatients.sort((a, b) => {
        let valA = a[sortState.column];
        let valB = b[sortState.column];

        // Handle string comparison (case-insensitive) for Name
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        // Handle numeric comparison for Room/Drip
        if (sortState.column === 'roomNo' || sortState.column === 'dripLeft') {
            valA = Number(valA);
            valB = Number(valB);
        }

        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Update Sort Icons
    ['roomNo', 'name', 'dripLeft'].forEach(col => {
        const icon = document.getElementById(`sort-icon-${col}`);
        if (icon) {
            if (sortState.column === col) {
                icon.textContent = sortState.direction === 'asc' ? '↑' : '↓';
            } else {
                icon.textContent = '';
            }
        }
    });

    tbody.innerHTML = sortedPatients.length ? sortedPatients.map(p => `
        <tr class="border-b border-gray-100 hover:bg-blue-50 transition">
            <td class="p-4 font-medium">${p.roomNo}</td>
            <td class="p-4">${p.name}</td>
            <td class="p-4 ${getStatusColor(p.dripLeft).text} font-bold">${p.dripLeft} mL</td>
            <td class="p-4 text-blue-600 font-mono text-sm">${p.dripRate} mL/hr</td>
            <td class="p-4 text-gray-600 font-mono text-sm">${p.timeLeft}</td>
            <td class="p-4 text-center">
                <button onclick="window.deletePatient('${p.id}')" class="text-red-500">🗑️</button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="4" class="p-4 text-center text-gray-500">No matching records found</td></tr>`;
};

window.sortDatabase = function (column) {
    // Toggle direction if same column, otherwise reset to ascending
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }
    renderDatabase();
};

window.onclick = () => document.getElementById('patientDropdown')?.classList.add('hidden');

function checkAlerts() {
    // Safety check: Don't show alerts if no one is logged in
    if (!auth.currentUser) return;

    const criticalPatients = patients.filter(p => p.dripLeft < 50);
    const alertBox = document.getElementById('urgent-alert-container');
    const alertMsg = document.getElementById('alert-message');

    if (criticalPatients.length > 0) {
        const rooms = criticalPatients.map(p => `Room ${p.roomNo}`).join(', ');
        alertMsg.textContent = `Urgent saline needed in: ${rooms} (Below 10ml!)`;
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }
}

function renderDropdown() {
    const list = document.getElementById('dropdown-list');
    if (!list) return;
    list.innerHTML = `<div class="font-bold text-xs uppercase text-gray-400 border-b pb-1">Room</div>
                      <div class="font-bold text-xs uppercase text-gray-400 border-b pb-1">Level</div>`;

    patients.forEach(p => {
        const roomDiv = document.createElement('div');
        roomDiv.className = "text-blue-500 cursor-pointer font-medium hover:underline py-1";
        roomDiv.textContent = `Room ${p.roomNo}`;
        roomDiv.onclick = () => window.showPatientCard(p.id);

        const status = getStatusColor(p.dripLeft);
        const volDiv = document.createElement('div');
        volDiv.className = `${status.text} font-bold py-1 ${status.zone === 'red' ? 'animate-pulse font-black' : ''}`;
        volDiv.textContent = `${p.dripLeft} mL`;

        list.appendChild(roomDiv);
        list.appendChild(volDiv);
    });
}

window.showPatientCard = function (id) {
    const p = patients.find(p => p.id === id);
    if (!p) return;

    const container = document.getElementById('active-card-container');
    window.showPage('patients');

    const status = getStatusColor(p.dripLeft);

    // Determine connection status
    const isOnline = monitorData[p.roomNo] || monitorData[p.name];
    const connectionStatus = isOnline
        ? { text: 'Online', color: 'text-green-600', dot: 'bg-green-600', bg: 'bg-green-50' }
        : { text: 'Offline', color: 'text-gray-400', dot: 'bg-gray-400', bg: 'bg-gray-100' };

    container.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl p-8 border-l-8 ${status.border} w-full max-w-md">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h3 class="text-2xl font-bold">Room ${p.roomNo}</h3>
                    <p class="text-gray-500">${p.name}</p>
                </div>
                <button onclick="window.deletePatient('${p.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-full">🗑️</button>
            </div>
            <div class="text-center py-6">
                <span class="text-6xl font-black ${status.text}">${p.dripLeft}</span>
                <span class="text-gray-400 font-bold ml-2">mL</span>
            </div>
            
            <div class="flex justify-between items-center text-sm text-gray-600 mb-4 px-4 bg-gray-50 py-2 rounded-lg">
                <div class="flex items-center space-x-2">
                    <span class="text-xl">💧</span>
                    <div>
                        <span class="block text-xs font-bold text-gray-400">RATE</span>
                        <span class="font-mono font-bold text-blue-600 text-lg">${p.dripRate} <small class="text-xs text-gray-400">mL/hr</small></span>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="text-right">
                        <span class="block text-xs font-bold text-gray-400">TIME LEFT</span>
                        <span class="font-mono font-bold text-blue-600 text-lg">${p.timeLeft}</span>
                    </div>
                    <span class="text-xl">⏳</span>
                </div>
            </div>

            <div class="w-full bg-gray-200 h-4 rounded-full overflow-hidden">
                <div class="${status.bg} h-full transition-all duration-1000" style="width: ${(p.dripLeft / 500) * 100}%"></div>
            </div>
            
            ${status.zone === 'red' ? '<p class="text-red-600 text-center mt-4 font-black animate-bounce uppercase tracking-tighter text-sm">⚠️ Critical: Replace Bottle</p>' : ''}

            <!-- Live Monitoring Status -->
            <div class="mt-6 pt-4 border-t flex justify-center items-center space-x-2 ${connectionStatus.color}">
                <span class="h-3 w-3 rounded-full ${connectionStatus.dot} ${isOnline ? 'animate-pulse' : ''}"></span>
                <span class="text-xs font-bold uppercase tracking-wider">Live Monitoring: ${connectionStatus.text}</span>
            </div>
        </div>`;
};

// --- 8. CRUD ---

function updateChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: patients.map(p => `Room ${p.roomNo}`),
            datasets: [{
                label: 'Drip Level (mL)',
                data: patients.map(p => p.dripLeft),
                backgroundColor: patients.map(p => getStatusColor(p.dripLeft).hex),
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 500 } }
        }
    });
}

// --- 8. CRUD ---
document.getElementById('regForm').onsubmit = (e) => {
    e.preventDefault();
    const newPatient = {
        name: document.getElementById('pName').value,
        roomNo: document.getElementById('pRoom').value,
        contactNo: document.getElementById('pContact').value,
        dripLeft: 500 // Default full bottle
    };
    push(ref(db, 'patients'), newPatient);
    e.target.reset();
    alert("Patient Registered!");
    window.showPage('database');
};

// --- 9. USER PROFILE FUNCTIONS ---

window.loadUserProfile = function () {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = ref(db, `users/${uid}`);

    onValue(userRef, (snapshot) => {
        const data = snapshot.val() || {};

        // Populate Inputs
        document.getElementById('profName').value = data.name || "Doctor";
        document.getElementById('profDob').value = data.dob || "";

        // Update Display
        const role = data.role || "Doctor";
        if (document.getElementById('displayRoleBadge')) {
            document.getElementById('displayRoleBadge').textContent = role;
        }

        // Admin Check (Navigation Button)
        if (role === 'Admin') {
            document.getElementById('navAdmin').classList.remove('hidden');
        } else {
            document.getElementById('navAdmin').classList.add('hidden');
        }

        // Update Images (Main + Nav)
        const imgSrc = data.photoBase64 || `https://ui-avatars.com/api/?name=${data.name || 'User'}`;
        document.getElementById('profileImageDisplay').src = imgSrc;
        document.getElementById('navProfileImg').src = imgSrc;
    });
};

window.enableEditMode = function () {
    document.getElementById('btnEditProfile').classList.add('hidden');
    document.getElementById('editActions').classList.remove('hidden');
    document.getElementById('imgOverlay').classList.remove('hidden');

    ['profName', 'profRole', 'profDob'].forEach(id => {
        const el = document.getElementById(id);
        el.disabled = false;
        el.classList.remove('bg-gray-50', 'text-gray-500');
        el.classList.add('bg-white', 'text-gray-900', 'ring-2', 'ring-blue-100');
    });
};

window.cancelEditMode = function () {
    document.getElementById('btnEditProfile').classList.remove('hidden');
    document.getElementById('editActions').classList.add('hidden');
    document.getElementById('imgOverlay').classList.add('hidden');

    ['profName', 'profRole', 'profDob'].forEach(id => {
        const el = document.getElementById(id);
        el.disabled = true;
        el.classList.add('bg-gray-50', 'text-gray-500');
        el.classList.remove('bg-white', 'text-gray-900', 'ring-2', 'ring-blue-100');
    });

    // Reload to reset unsaved changes
    loadUserProfile();
};

window.saveProfile = function (e) {
    e.preventDefault();
    if (!auth.currentUser) return;

    const updates = {
        name: document.getElementById('profName').value,
        role: document.getElementById('profRole').value,
        dob: document.getElementById('profDob').value,
        photoBase64: document.getElementById('profileImageDisplay').src
    };

    set(ref(db, `users/${auth.currentUser.uid}`), updates)
        .then(() => {
            alert("Profile Updated Successfully!");
            cancelEditMode();
        })
        .catch(err => alert("Error saving profile: " + err.message));
};

window.previewImage = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('profileImageDisplay').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]); // Convert to Base64
    }
};

window.deletePatient = function (id) {
    if (confirm("Delete this record?")) {
        remove(ref(db, `patients/${id}`))
            .then(() => window.showPage('database'))
            .catch(console.error);
    }
};

// --- 10. ADMIN FUNCTIONS ---

window.loadAdminUsers = function () {
    const tableBody = document.getElementById('adminUserTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Loading...</td></tr>';

    onValue(ref(db, 'users'), (snapshot) => {
        tableBody.innerHTML = '';
        const users = snapshot.val();

        if (!users) {
            tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">No users found.</td></tr>';
            return;
        }

        Object.keys(users).forEach(uid => {
            const user = users[uid];

            // Skip users with 'Patient' role - they shouldn't appear in admin dashboard
            if (user.role === 'Patient') return;

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-purple-50 transition';

            // Format Last Login
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';

            row.innerHTML = `
                <td class="p-4 flex items-center space-x-3">
                    <img src="${user.photoBase64 || 'https://ui-avatars.com/api/?name=' + (user.name || 'User')}" class="w-10 h-10 rounded-full border">
                    <div>
                        <p class="font-bold text-gray-900">${user.name || 'Unknown'}</p>
                        <p class="text-xs text-gray-400">${uid}</p>
                    </div>
                </td>
                <td class="p-4">
                    <select onchange="updateUserRole('${uid}', this.value)" class="p-1 border rounded text-sm ${user.role === 'Admin' ? 'text-purple-600 font-bold' : 'text-gray-600'}">
                        <option value="Doctor" ${user.role === 'Doctor' ? 'selected' : ''}>Doctor</option>
                        <option value="Helper/Nurse" ${user.role === 'Helper/Nurse' ? 'selected' : ''}>Helper/Nurse</option>
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="p-4 text-sm">${lastLogin}</td>
                <td class="p-4">
                    <button onclick="deleteUser('${uid}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition" title="Delete User">
                        🗑️
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });
};

window.updateUserRole = function (uid, newRole) {
    update(ref(db, `users/${uid}`), { role: newRole })
        .then(() => alert(`Role updated to ${newRole}`))
        .catch(err => alert("Error updating role: " + err.message));
};

window.deleteUser = function (uid) {
    if (confirm("Are you sure you want to delete this user? This cannot be undone.")) {
        remove(ref(db, `users/${uid}`))
            .then(() => alert("User deleted (Database record removed)"))
            .catch(err => alert("Error deleting user: " + err.message));
    }
};

// --- Admin Dashboard Tab Switching and Patient Management ---

window.switchAdminTab = function (tab) {
    const tabUsers = document.getElementById('tabUsers');
    const tabPatients = document.getElementById('tabPatients');
    const usersView = document.getElementById('adminUsersView');
    const patientsView = document.getElementById('adminPatientsView');

    if (tab === 'users') {
        tabUsers.className = 'px-4 py-2 bg-white text-purple-800 rounded-t-lg font-bold';
        tabPatients.className = 'px-4 py-2 bg-purple-700 text-white rounded-t-lg';
        usersView.classList.remove('hidden');
        patientsView.classList.add('hidden');
    } else {
        tabUsers.className = 'px-4 py-2 bg-purple-700 text-white rounded-t-lg';
        tabPatients.className = 'px-4 py-2 bg-white text-purple-800 rounded-t-lg font-bold';
        usersView.classList.add('hidden');
        patientsView.classList.remove('hidden');
        loadAdminPatients();
    }
};

window.loadAdminData = function () {
    loadAdminUsers();
    loadAdminPatients();
};

window.loadAdminPatients = function () {
    const tableBody = document.getElementById('adminPatientTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>';

    onValue(ref(db, 'patients'), (snapshot) => {
        tableBody.innerHTML = '';
        const patientsData = snapshot.val();

        if (!patientsData) {
            tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">No patients found.</td></tr>';
            return;
        }

        Object.keys(patientsData).forEach(id => {
            const patient = patientsData[id];
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-purple-50 transition';
            row.id = `patient-row-${id}`;

            // Find current volume from synced data
            const syncedPatient = patients.find(p => p.id === id);
            const currentVolume = syncedPatient ? `${syncedPatient.dripLeft} mL` : 'N/A';

            row.innerHTML = `
                <td class="p-4">
                    <span class="font-bold text-purple-600">${patient.roomNo || 'N/A'}</span>
                </td>
                <td class="p-4">
                    <span id="name-${id}">${patient.name || 'N/A'}</span>
                    <input type="text" id="edit-name-${id}" value="${patient.name || ''}" class="hidden w-full p-1 border rounded">
                </td>
                <td class="p-4">
                    <span id="contact-${id}">${patient.contactNo || 'N/A'}</span>
                    <input type="text" id="edit-contact-${id}" value="${patient.contactNo || ''}" class="hidden w-full p-1 border rounded">
                </td>
                <td class="p-4 text-sm text-gray-600">${currentVolume}</td>
                <td class="p-4 flex space-x-2">
                    <button id="btn-edit-${id}" onclick="editPatient('${id}')" class="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition" title="Edit Patient">
                        ✏️
                    </button>
                    <button id="btn-save-${id}" onclick="savePatientEdit('${id}')" class="hidden text-green-500 hover:text-green-700 hover:bg-green-50 p-2 rounded transition" title="Save">
                        ✓
                    </button>
                    <button id="btn-cancel-${id}" onclick="cancelPatientEdit('${id}')" class="hidden text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-2 rounded transition" title="Cancel">
                        ✕
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });
};

window.editPatient = function (id) {
    // Hide display, show edit inputs
    document.getElementById(`name-${id}`).classList.add('hidden');
    document.getElementById(`contact-${id}`).classList.add('hidden');
    document.getElementById(`edit-name-${id}`).classList.remove('hidden');
    document.getElementById(`edit-contact-${id}`).classList.remove('hidden');

    // Toggle buttons
    document.getElementById(`btn-edit-${id}`).classList.add('hidden');
    document.getElementById(`btn-save-${id}`).classList.remove('hidden');
    document.getElementById(`btn-cancel-${id}`).classList.remove('hidden');
};

window.cancelPatientEdit = function (id) {
    // Show display, hide edit inputs
    document.getElementById(`name-${id}`).classList.remove('hidden');
    document.getElementById(`contact-${id}`).classList.remove('hidden');
    document.getElementById(`edit-name-${id}`).classList.add('hidden');
    document.getElementById(`edit-contact-${id}`).classList.add('hidden');

    // Toggle buttons
    document.getElementById(`btn-edit-${id}`).classList.remove('hidden');
    document.getElementById(`btn-save-${id}`).classList.add('hidden');
    document.getElementById(`btn-cancel-${id}`).classList.add('hidden');
};

window.savePatientEdit = function (id) {
    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newContact = document.getElementById(`edit-contact-${id}`).value.trim();

    if (!newName) {
        alert('Patient name cannot be empty');
        return;
    }

    update(ref(db, `patients/${id}`), {
        name: newName,
        contactNo: newContact
    })
        .then(() => {
            alert('Patient updated successfully');
            loadAdminPatients();
        })
        .catch(err => alert('Error updating patient: ' + err.message));
};