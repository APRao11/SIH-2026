# AVINYA

## Community-assisted emergency response

AVINYA is a Smart India Hackathon 2026 MVP that helps a bystander share a structured emergency alert with nearby, verified community responders after contacting emergency services.

The prototype connects three roles in one workflow:

- **Bystander:** calls 108, describes the incident, optionally shares a scene photo, and confirms GPS location.
- **Responder:** registers with identity and qualification details, goes online, receives nearby alerts, and accepts or rejects them.
- **Admin:** reviews responder submissions and verifies or rejects uploaded documents.

AVINYA is a community coordination layer. It does not replace 108, an ambulance, a doctor, or an official emergency dispatch system.

## MVP workflow

1. The bystander selects **Send Emergency Alert** and is prompted to call 108.
2. They choose an emergency type: accident, cardiac emergency, burns, unconscious person, or other.
3. They capture an optional scene photo using the device camera.
4. The browser detects the bystander's GPS location and submits the alert.
5. The server matches the alert with verified responders who are available and have a recent location.
6. Matching starts within 1 km and expands to 2 km after 20 seconds if nobody has accepted.
7. Responders receive real-time updates, review the alert, and accept or reject it.
8. The accepted responder with the best estimated arrival time becomes primary; other accepted responders remain available as secondary support.
9. The bystander can view the alert status, responder details, map location, first-aid guidance, and ambulance arrival status.

## Key capabilities

- Structured emergency reporting with GPS coordinates and optional JPEG/PNG scene photo.
- Leaflet map views for emergency and responder locations.
- Fresh-location matching: responder locations older than 15 minutes are excluded.
- Haversine distance and straight-line ETA estimates for prototype dispatch logic.
- Real-time emergency updates using Socket.IO.
- Responder registration with document upload and pending verification status.
- Availability toggle and periodic responder location synchronisation.
- Deterministic first-aid guidance for each supported emergency category, with safety messaging.
- SQLite persistence with automatic database/table-column initialisation.
- Session/local storage recovery for an active bystander alert and selected responder.

## Technology

- React 19 and Vite
- Express 5 on Node.js
- SQLite through `better-sqlite3`
- Socket.IO and `socket.io-client`
- Leaflet and React Leaflet
- Tailwind CSS with the Vite plugin
- `lucide-react` for interface icons

## Getting started

### Requirements

- Node.js 18 or newer
- npm
- A browser that supports camera and geolocation access

### Install and run

```bash
npm install
npm run dev
```

The Vite client is available at [http://localhost:5173](http://localhost:5173). The Express API runs at `http://localhost:3001` and is proxied by Vite for `/api` and `/socket.io` requests.

For camera and geolocation features, use `localhost` or an HTTPS deployment and allow the required browser permissions.

### Production build

```bash
npm run build
npm run preview
```

## Configuration

The server loads optional values from a `.env` file:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Express server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Socket.IO CORS origin |
| `DATABASE_PATH` | `./data/emergency-response.db` | SQLite database path |
| `UPLOAD_DIR` | `./data/uploads` | Verification and scene photo storage |
| `PASSWORD_SALT` | development fallback | Salt used for prototype password hashing |

The `data/` directory is created automatically and should not be committed. Uploaded identity documents and scene photos contain potentially sensitive information and require suitable access controls in a real deployment.

## Validation

Run the available server-side workflow checks:

```bash
npm run test:step4
npm run test:step6
npm run test:step7
```

These checks cover responder selection and radius expansion, ambulance arrival persistence, responder visibility, emergency categories, first-aid guidance, and the accept/reject workflow.

Run linting with:

```bash
npm run lint
```

## Project structure

```text
src/
	App.jsx                 Client routing and shared page shell
	components/             Bystander, responder, admin, and map screens
	lib/                    Socket.IO client and first-aid guidance
	App.css, index.css      Interface styling
server/
	index.js                Express API, matching logic, uploads, and Socket.IO
	db.js                   SQLite setup and schema migrations
	test-step*.js           End-to-end server workflow checks
```

## API surface

The client uses the following main endpoints:

- `POST /api/emergencies` - create an emergency alert
- `GET /api/emergencies/:id` - retrieve current alert status
- `PATCH /api/emergencies/:id/accept` - accept an alert
- `PATCH /api/emergencies/:id/reject` - reject an alert
- `PATCH /api/emergencies/:id/ambulance-status` - record ambulance arrival status
- `POST /api/responders` - register a responder and upload verification document
- `GET /api/responders` - list responder records for the prototype consoles
- `PATCH /api/responders/:id/verification` - verify or reject a registration
- `PATCH /api/responders/:id/availability` - set responder availability
- `PATCH /api/responders/:id/location` - update responder location
- `GET /api/responder/emergencies` - retrieve matching alerts for a responder

## Prototype boundaries

This repository is intended for demonstration and evaluation, not direct production emergency use. Before deployment, the system would need authenticated role-based access, protected admin routes, secure secret management, encrypted sensitive data, audit logging, stronger input and upload controls, official emergency-service integration, reliable routing/traffic ETAs, push notifications, monitoring, and a formal privacy and safety review.

The current admin console is a prototype UI without authentication. Responder selection can also be switched in the dashboard to support local demonstrations. ETA values are estimates based on straight-line distance and an assumed average urban speed; they are not live navigation times.

## License

No license has been specified for this project yet.
