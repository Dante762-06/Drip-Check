# Drip-Check
# Drip-Sync 💉

A real-time hospital saline drip monitoring system that helps medical staff track and manage IV drip levels across multiple patient rooms.

## 🌟 Features

### Real-Time Monitoring
- **Live Data Sync**: Automatic updates from IoT saline monitors via Firebase
- **Multi-Patient Dashboard**: Monitor all patients from a single interface
- **Color-Coded Alerts**: Visual indicators for drip levels (Green, Yellow, Orange, Red)
- **Volume Analytics**: Chart visualization of drip levels across rooms

### Patient Management
- **Patient Registration**: Quick registration with room assignment
- **Patient Profiles**: Detailed view with current rate, time left, and volume
- **Search & Sort**: Filter by room number or patient name
- **Delete Functionality**: Remove patient records when discharged

### Admin Dashboard
- **User Management**: Add/remove system users (Doctors, Nurses, Admins)
- **Role-Based Access**: Different permissions for Admin, Doctor, Helper/Nurse
- **Patient Editing**: Modify patient information (name, contact)
- **Activity Tracking**: Monitor user login/logout times

### Authentication & Security
- **Firebase Authentication**: Secure email/password login
- **Session Management**: Automatic logout on tab close
- **Password Reset**: Forgot password functionality
- **Role Verification**: Access control based on user roles

### Monitor Integration
- **IoT Device Sync**: Connects to saline monitors via Firebase Realtime Database
- **Room Matching**: Automatic pairing using room numbers
- **Live Status**: Online/Offline indicators for monitor connectivity
- **Data Fallback**: Handles offline monitors gracefully

## 🛠️ Technologies

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Auth
- **Charts**: Chart.js
- **Real-time Sync**: Firebase onValue listeners

## 📋 Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase account (free tier works)
- Text editor or IDE
- Basic understanding of HTML/CSS/JavaScript

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/drip-sync.git
   cd drip-sync
   ```

2. **Firebase Setup**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Realtime Database and Authentication (Email/Password)
   - Copy your Firebase configuration

3. **Configure Firebase**
   - Open `index.js`
   - Replace the `firebaseConfig` object with your credentials:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_AUTH_DOMAIN",
       databaseURL: "YOUR_DATABASE_URL",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_STORAGE_BUCKET",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```

4. **Database Structure**
   Initialize your Firebase Realtime Database with this structure:
   ```json
   {
     "patients": {
       "patient_id": {
         "name": "John Doe",
         "roomNo": "101",
         "contactNo": "1234567890"
       }
     },
     "saline_monitor": {
       "monitor_id": {
         "class": "101",
         "rate": 60,
         "time_left": "2h 30m",
         "volume": 350
       }
     },
     "users": {
       "user_id": {
         "name": "Dr. Smith",
         "email": "doctor@hospital.com",
         "role": "Doctor",
         "dob": "1980-01-01"
       }
     }
   }
   ```

5. **Run the Application**
   - Open `index.html` in a web browser
   - Or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```

## 📖 Usage

### First Time Setup
1. Open the application and click "Sign Up"
2. Create an account with your email and password
3. Choose your role (Doctor or Helper/Nurse)
4. Login with your credentials

### Registering Patients
1. Navigate to "New Patient" from the main menu
2. Enter patient name, room number, and contact
3. Submit to register

### Monitoring Patients
- **Dashboard View**: See all patients and their drip levels
- **Patient Card**: Click on a room to view detailed information
- **Search**: Use the search bar to filter by room or name
- **Sort**: Click column headers to sort the table

### Admin Functions (Admin Role Required)
1. Navigate to "Admin Panel"
2. **System Users Tab**: Manage staff accounts and roles
3. **Patients Tab**: Edit patient information
4. Use edit (✏️) button to modify records

## 🎨 Color-Coded Alerts

- 🟢 **Green (≥300ml)**: Good - No action needed
- 🟡 **Yellow (150-299ml / <50ml)**: Warning - Monitor closely
- 🟠 **Orange (50-149ml)**: Low - Prepare replacement
- 🔴 **Red (N/A - removed)**: ~~Critical - Immediate action~~

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🔒 Security Features

- Session-based authentication (logout on browser close)
- Role-based access control
- Firebase security rules (recommended for production)
- Input validation on all forms

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Your Name** - *Initial work*

## 🙏 Acknowledgments

- Firebase for real-time database and authentication
- Chart.js for data visualization
- Tailwind CSS for styling utilities
- Medical professionals for domain expertise

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Email: support@dripsync.com

## 🔮 Future Enhancements

- [ ] Mobile app (React Native/Flutter)
- [ ] SMS/Email alerts for critical levels
- [ ] Historical data analytics
- [ ] Multi-hospital support
- [ ] Barcode/QR room scanning
- [ ] Export reports (PDF/Excel)

---

**Made with ❤️ for healthcare professionals**
