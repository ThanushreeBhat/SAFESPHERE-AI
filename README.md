SafeSphere AI is a real-time safety platform that monitors plant telemetry, active work permits, and spatial maps to prevent compound hazards before accidents occur.
⚡ Features
-Spatial Risk Heatmap: Interactive 2D plant blueprint displaying live zone statuses.Compound Hazard Engine: Fuses gas PPM, temperature, and active permit types to catch multi-variable risks.
-Automated Compliance: Attaches legal citations (OISD-STD-105, Factory Act 1948) and action steps to critical alerts.
-Sub-10ms Latency: Uses WebSockets for real-time updates without LLM API lag.

🏗️ Architecture Overview
-Next.js 14 Dashboard: Interactive UI connected via WebSockets.
-FastAPI Backend: Runs simulation loops and evaluates compound risk rules.
-REST API Layer: /status and /trigger-hazard endpoints for real-time simulation control.-Resilient WebSockets: Streams telemetry every 2 seconds with automatic 3-second reconnection.
-De-duplicated Feed: Filters stream noise to surface only actionable statutory directives.


🚀 Quick Start
```1. Start BackendBashcd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

2. Start FrontendBashcd frontend
npm install
npm run dev

Open http://localhost:3000 in your browser. Click ⚡ Inject Gas Hazard to test the live incident response!