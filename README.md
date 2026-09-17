# 🚑 AVINYA-2026

<p align="center">
  <strong>Community-Assisted Emergency Response Platform</strong>
</p>

<p align="center">
  <em>Bridging the gap between an emergency and the arrival of professional medical help.</em>
</p>

<p align="center">
  <a href="#-about-the-project">About</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-future-scope">Future Scope</a>
</p>

<p align="center">

![Status](https://img.shields.io/badge/Status-MVP-success?style=for-the-badge)

![Built For](https://img.shields.io/badge/Built%20For-SIH%202026-orange?style=for-the-badge)

![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge\&logo=node.js\&logoColor=white)

![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge\&logo=react\&logoColor=black)

![Express](https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge\&logo=express\&logoColor=white)

![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge\&logo=sqlite\&logoColor=white)

</p>

---

## 🚨 About the Project

During a medical emergency, **every minute matters**.

A bystander may not know how to provide first aid, while a qualified person such as a doctor, medical student, or trained volunteer may be nearby but unaware that an emergency is taking place.

Traditional emergency response mainly focuses on connecting the person to professional services. However, there can still be a critical time gap between the **incident** and the **arrival of professional help**.

### 💡 AVINYA-2026 addresses this gap.

AVINYA is a **community-assisted emergency response platform** that connects a person facing an emergency with **nearby verified responders** who can potentially reach the incident location sooner and provide appropriate assistance while professional medical help is on the way.

---

# ✨ Why AVINYA?

### 🚑 Faster Local Assistance

Professional emergency services may take time to reach an incident.

AVINYA creates an additional layer of support by identifying **nearby available responders** who can be alerted to the emergency.

---

### 👨‍⚕️ Trusted Responder Network

Anyone should not be able to respond to a medical emergency through the platform.

Doctors, medical students, and approved volunteers undergo a **registration and verification process** before becoming eligible to receive emergency requests.

---

### 📍 Location-Aware Response

The emergency location is a critical part of the response.

AVINYA uses the incident location to identify responders in the surrounding area and help them reach the emergency site.

---

### 🔔 Real-Time Alerts

Instead of relying on a person to discover an emergency manually, the platform sends emergency requests to suitable nearby responders.

This turns the responder network into an **active, location-aware support system**.

---

### 🧠 Assistance While Waiting

The platform can provide emergency-specific first-aid guidance to the bystander, helping them take appropriate immediate steps while assistance is being arranged.

> AVINYA is designed as an **assistance and coordination platform**, not a replacement for professional medical care.

---

#  Key Features

| Feature                       | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| 🆘 **One-Tap SOS**            | Initiate an emergency request without requiring bystander registration         |
| 📋 **Emergency Type**         | Select accident, cardiac emergency, burns, unconsciousness, or other emergency |
| 📍 **GPS Location**           | Capture the emergency location for responder matching                          |
| 👨‍⚕️ **Verified Responders** | Only approved responders can receive emergency requests                        |
| 📸 **Identity Verification**  | Camera-based verification supports responder registration                      |
| 🔔 **Real-Time Alerts**       | Notify suitable nearby responders about an emergency                           |
| 🗺️ **Location View**         | Responders can view the emergency location                                     |
| ⏱️ **Response Matching**      | Consider responder availability, proximity and estimated travel time           |
| 🔄 **Radius Expansion**       | Expand the search area when no responder accepts                               |
| 🤖 **First-Aid Assistance**   | Provide basic emergency-specific guidance                                      |
| 🚑 **Ambulance Assistance**   | Help the bystander contact emergency ambulance services                        |
| ✅ **Emergency Status**        | Update the status when ambulance assistance arrives                            |

---

# 🔄 How It Works

```text
                 ┌──────────────────────┐
                 │       BYSTANDER      │
                 │                      │
                 │        SOS           │
                 │   Emergency Type     │
                 │      Location        │
                 └──────────┬───────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │      RESPONSE ENGINE      │
              │                           │
              │  • Validate Request       │
              │  • Find Nearby Responders │
              │  • Match Availability     │
              │  • Send Emergency Alert   │
              │  • Expand Search Radius   │
              └─────────────┬─────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │       RESPONDER      │
                 │                      │
                 │      Alert Received  │
                 │      View Location   │
                 │      Accept Request  │
                 │      Reach Incident  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   PROFESSIONAL HELP  │
                 │                      │
                 │        Ambulance     │
                 └──────────────────────┘
```

---

# 🏗️ Architecture

```text
                         AVINYA-2026
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
     ┌───────────────┐                 ┌────────────────┐
     │   BYSTANDER   │                 │    RESPONDER   │
     │               │                 │                │
     │  React UI     │                 │   React UI     │
     │  SOS Flow     │                 │   Dashboard    │
     └───────┬───────┘                 └───────┬────────┘
             │                                 │
             └──────────────┬──────────────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │    REST API       │
                  │                   │
                  │ Node.js + Express │
                  └─────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
      ┌────────────┐  ┌────────────┐  ┌─────────────┐
      │ Emergency  │  │ Responder  │  │ Verification│
      │ Management │  │ Matching   │  │   System    │
      └─────┬──────┘  └─────┬──────┘  └──────┬──────┘
            │               │                │
            └───────────────┼────────────────┘
                            ▼
                    ┌───────────────┐
                    │    SQLite     │
                    │   Database    │
                    └───────────────┘
```

---

#  Response Engine

The response engine is the core of AVINYA.

When an emergency is created, the system:

```text
Emergency Created
       │
       ▼
Get Emergency Location
       │
       ▼
Find Available Verified Responders
       │
       ▼
Check Proximity / Estimated Travel Time
       │
       ▼
Send Alert
       │
       ├──────────────► Responder Accepts
       │                         │
       │                         ▼
       │                  Response Started
       │
       └──────────────► No Acceptance
                                 │
                                 ▼
                         Expand Search Radius
                                 │
                                 ▼
                         Alert More Responders
```

The system is designed so that **availability and estimated travel time** can be considered along with distance when selecting responders.

---

# 👨‍⚕️ Responder Verification

AVINYA separates **responder registration** from normal emergency usage.

### Registration Flow

```text
┌────────────────────┐
│ Responder Registers│
└──────────┬─────────┘
           ▼
┌────────────────────┐
│ Identity /         │
│ Credential Details │
└──────────┬─────────┘
           ▼
┌────────────────────┐
│ Verification       │
│ Process            │
└──────────┬─────────┘
           ▼
┌────────────────────┐
│ Admin Review       │
└──────────┬─────────┘
           ▼
┌────────────────────┐
│ Approved Responder │
└──────────┬─────────┘
           ▼
┌────────────────────┐
│ Eligible for       │
│ Emergency Alerts   │
└────────────────────┘
```

This helps create a responder network based on **verified participation rather than unrestricted access**.

---

# 📱 Screenshots / Demo

> Replace the placeholders below with screenshots from the running application.

##  Bystander Emergency Flow

<p align="center">
  <img src="docs/screenshots/emergency-flow.png" width="800">
</p>

**Emergency request → Emergency type → Location → Alert sent**

---

## 👨‍⚕️ Responder Dashboard

<p align="center">
  <img src="docs/screenshots/responder-dashboard.png" width="800">
</p>

Responders can view incoming emergency requests and relevant incident information.

---

## 📍 Emergency Location

<p align="center">
  <img src="docs/screenshots/emergency-map.png" width="800">
</p>

The emergency location helps responders understand where assistance is required.

---

## 📸 Responder Registration & Verification

<p align="center">
  <img src="docs/screenshots/responder-registration.png" width="800">
</p>

Responder registration includes identity and credential verification.

---

# 🎬 Demo

### Complete Emergency Flow

```text
1. Bystander opens AVINYA
             ↓
2. Selects emergency type
             ↓
3. Emergency location is captured
             ↓
4. SOS request is created
             ↓
5. Nearby verified responders are identified
             ↓
6. Responders receive emergency alerts
             ↓
7. A responder accepts the request
             ↓
8. Responder views the emergency location
             ↓
9. Responder travels to the incident
             ↓
10. Ambulance / professional help is contacted
```

> 🎥 A short demonstration video can be added here for the SIH presentation and repository showcase.

---

# 🛠️ Tech Stack

### Frontend

*  **React**
*  **Vite**
* HTML5
* CSS3
* JavaScript

### Backend

*  **Node.js**
*  **Express.js**

### Database

*  **SQLite**
* `better-sqlite3`

### Supporting Technologies

*  Geolocation APIs
*  Browser Camera API
*  Multer
*  REST APIs

---

# 📁 Project Structure

```text
AVINYA-2026/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   └── ...
│
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── database/
│   └── ...
│
├── data/
│   └── emergency-response.db
│
├── uploads/
│   └── ...
│
├── docs/
│   └── screenshots/
│
├── package.json
├── README.md
└── ...
```

---

# ⚙️ Getting Started

## Prerequisites

Make sure you have installed:

* Node.js
* npm
* Git

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/thushara-bajimar/AVINYA-2026.git
cd AVINYA-2026
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

If the frontend and backend have separate package files, install dependencies in their respective directories as configured in the project.

---

## 3️⃣ Start the Application

```bash
npm run dev
```

The terminal will display the local development URL.

---

# 🔐 Security & Privacy

AVINYA handles emergency and responder-related information carefully.

The system is designed around:

*  Verified responder access
*  Controlled responder registration
*  Restricted emergency information
*  Camera-based identity verification
*  Separation of responder and bystander workflows

### Development Storage

The current MVP is designed for **local development and demonstration**.

Uploaded verification files and development database data are stored in the configured local application environment and should not be treated as production-grade cloud storage.

For production deployment, secure cloud storage, encryption, authentication, access control, auditing, and appropriate data-retention policies would be required.

---

# 🌱 Future Scope

AVINYA can evolve into a larger emergency-response ecosystem.

### ☁️ Cloud Deployment

Move from local MVP infrastructure to scalable cloud services.

### 🗺️ Road-Based Routing

Use actual road networks instead of relying only on straight-line geographical distance.

### 🚦 Traffic-Aware ETA

Consider real-time traffic conditions when estimating responder arrival time.

### 📱 Mobile Application

Provide dedicated Android and iOS applications for faster emergency access.

### 🔴 Live Location Sharing

Allow responders and relevant emergency participants to share live movement during an active response.

### 🚑 Emergency Service Integration

Future versions could integrate directly with ambulance and emergency service systems.

### 🏥 Healthcare Integration

Potential integration with hospitals and healthcare providers can be explored in future versions.

### 🌐 Multi-Language Support

Support multiple Indian languages to improve accessibility.

### 📶 Low-Connectivity Support

Optimize emergency communication for areas with unreliable network connectivity.

---

# 🎯 Vision

> **"When an emergency happens, help should not depend only on how quickly an ambulance can arrive."**

AVINYA envisions a connected community where **verified people with relevant training can become an additional layer of emergency support**.

The goal is not to replace ambulances, doctors, or hospitals.

The goal is to **bridge the critical gap before professional help arrives.**

---

# 🏆 Built for Smart India Hackathon 2026

**Project:** AVINYA-2026
**Theme:** Community-Assisted Emergency Response
**Event:** Smart India Hackathon 2026

---

# 👥 Team AVINYA-2026

Built with ❤️ by our team for **Smart India Hackathon 2026**.

---

## 📜 License

This project is currently developed as an educational and hackathon prototype.

See the repository for licensing information and project contributions.

---

<p align="center">
  <strong>🚑 AVINYA-2026</strong><br>
  <em>Connecting emergencies with nearby verified help.</em>
</p>
