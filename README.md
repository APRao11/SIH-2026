# 🚨 AVINYA

### Community-Assisted Emergency Response Platform

> **When every second matters, help should be closer than you think.**

AVINYA is a community-assisted emergency response platform designed to connect people facing emergencies with nearby **verified responders** who can provide immediate assistance while professional emergency services are on the way.

Built as a **Smart India Hackathon 2026 MVP**.

**Status:** 🚧 MVP / Hackathon Prototype

---

## 🎥 Demo

<!-- TODO: Add your demo video/GIF here -->

**[▶️ Watch the AVINYA Demo](YOUR_DEMO_VIDEO_LINK)**

---

## 📸 Screenshots

<!-- TODO: Replace these placeholders with actual screenshots -->

### 🚨 Emergency Alert

![Emergency Alert](./screenshots/emergency-alert.png)

Bystanders can quickly report an emergency and share their location with the response network.

### 🧑‍🚒 Responder Dashboard

![Responder Dashboard](./screenshots/responder-dashboard.png)

Verified responders can view nearby emergencies and choose incidents they are able to assist with.

### 🗺️ Live Emergency Tracking

![Live Map](./screenshots/live-map.png)

Location-based tracking helps responders and bystanders understand the current response status.

### 🩹 First-Aid Guidance

![First Aid](./screenshots/first-aid.png)

Emergency-specific first-aid guidance provides immediate assistance while professional help is being arranged.

---

# 🎯 The Problem

During an emergency, the first few minutes can be critical.

A bystander may report an incident to emergency services, but professional help may take time to arrive. At the same time, **capable people may already be nearby** but have no way to discover or respond to the situation.

AVINYA introduces a **community-response layer** between the emergency and professional services.

---

# 💡 Our Solution

AVINYA enables a bystander to:

1.  Report an emergency
2.  Share their current location
3.  Optionally provide additional information or media
4.  Find nearby verified responders
5.  Receive real-time response updates
6.  Access relevant first-aid guidance
7.  Continue relying on official emergency services when required

The platform is designed to **complement—not replace—official emergency response systems.**

---

# ✨ Key Features

### 🚨 One-Tap Emergency Reporting

Create an emergency request with the incident type and location.

### 📍 Location-Based Responder Matching

Find nearby responders using geographic distance calculations.

###  Verified Responders

Only verified responders can participate in the response network.

### ⚡ Real-Time Communication

Socket.IO enables real-time updates between participants.

### 🗺️ Interactive Maps

Leaflet-based maps provide visual location and response tracking.

###  Emergency-Specific First Aid

Provide immediate first-aid guidance based on the reported emergency.

### 🔄 Dynamic Search Radius

The responder search starts within **1 km** and can expand to **2 km** if an emergency remains unanswered.

### 📡 Location Freshness

Responder locations older than **15 minutes** are excluded from active matching.

---

# 🧠 Responder Matching

AVINYA uses a location-based matching mechanism to identify suitable responders.

```text
                 🚨 Emergency Created
                         │
                         ▼
              Find Verified Responders
                         │
                         ▼
             Check Location Freshness
                    (< 15 min)
                         │
                         ▼
                 Search within 1 km
                         │
                  ┌──────┴──────┐
                  │             │
               Accepted      No Response
                  │             │
                  ▼             ▼
             🚑 Respond      Wait 20 sec
                                │
                                ▼
                         Expand to 2 km
                                │
                                ▼
                       Find Available Help
```

The system uses geographic distance calculations to identify nearby responders and estimates straight-line distance/ETA for the MVP.

---

# 🏗️ System Architecture

```text
┌─────────────────────┐
│      BYSTANDER      │
│                     │
│  Report Emergency   │
│  Share Location     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│       React Frontend        │
│                             │
│  Emergency UI               │
│  Maps                       │
│  Responder Dashboard        │
└─────────────┬───────────────┘
              │
       REST API + Socket.IO
              │
              ▼
┌─────────────────────────────┐
│      Express Backend        │
│                             │
│  Emergency Management       │
│  Responder Matching         │
│  Verification               │
│  Real-Time Events           │
└─────────────┬───────────────┘
              │
              ▼
        ┌─────────────┐
        │   SQLite    │
        │  Database   │
        └─────────────┘
```

---

# 🛠️ Technology Stack

| Layer                   | Technology              |
| ----------------------- | ----------------------- |
| Frontend                | React 19                |
| Build Tool              | Vite                    |
| Backend                 | Node.js + Express 5     |
| Database                | SQLite                  |
| Database Driver         | better-sqlite3          |
| Real-Time Communication | Socket.IO               |
| Maps                    | Leaflet + React Leaflet |
| Styling                 | Tailwind CSS            |
| Icons                   | Lucide React            |

---

# 📂 Project Structure

```text
AVINYA-2026/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── ...
│
├── server/
│   ├── ...
│   └── ...
│
├── public/
│
├── package.json
├── vite.config.js
└── README.md
```

> The structure above represents the major application areas. Refer to the repository for the complete implementation.

---

# 🚀 Getting Started

## Prerequisites

Make sure you have installed:

* Node.js
* npm
* Git

Check your versions:

```bash
node --version
npm --version
git --version
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/samyakjain8431-cyber/AVINYA-2026.git
cd AVINYA-2026
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Start the Development Server

```bash
npm run dev
```

<!-- TODO: Verify whether the project requires a separate backend command -->

If the backend runs separately, start it according to the project's current scripts/configuration.

---

# 🔌 API

The backend exposes endpoints for emergency management, responder operations, and related functionality.

### Emergency

```text
POST   /api/emergencies
GET    /api/emergencies/:id
PATCH  /api/emergencies/:id/accept
```

### Responders

```text
GET    /api/responders
GET    /api/responders/:id
PATCH  /api/responders/:id/location
```

> Refer to the backend implementation for the complete and current API surface.

---

# 🔐 Security & Production Considerations

AVINYA is currently an **MVP intended for demonstration and hackathon evaluation**.

Before production deployment, the following areas require additional engineering:

*  Authentication and authorization
*  Role-based access control
*  Encryption of sensitive information
*  Audit logging
*  Secure file-upload validation
*  Location privacy controls
*  Rate limiting and abuse prevention
*  CAPTCHA / bot protection where appropriate
*  Stronger responder identity verification
*  Integration with official emergency services
*  Push notifications
*  Road-network routing and traffic-aware ETA
*  Production monitoring and observability
*  Privacy, safety, and regulatory review

---

# ⚠️ Important

AVINYA is **not a replacement for official emergency services, ambulances, doctors, or emergency dispatch systems.**

It is a prototype exploring how verified community responders could provide an additional layer of assistance while professional help is being arranged.

For real emergencies, contact the appropriate official emergency service.



---

# 🗺️ Future Improvements

*  Native mobile application
*  Push notifications
*  Official emergency-service integration
*  Traffic-aware route optimization
*  Stronger identity and responder verification
*  Emergency analytics dashboard
*  Multi-language support
*  Better handling of poor-connectivity environments
*  Enhanced privacy-preserving location sharing




<p align="center">

### 🚨 AVINYA

**Community-powered assistance when every second matters.**

Built for **Smart India Hackathon 2026**

</p>