import asyncio
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI application
app = FastAPI(title="SafeSphere AI Backend")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory simulation state
hazard_injected = False
active_connections: list[WebSocket] = []

def evaluate_compound_risk(zone_id: str, gas_ppm: float, temp_c: float, permit_type: str) -> dict:
    has_hot_work = (permit_type == "Hot Work")
    
    # Critical Rule: Gas > 15 PPM and Hot Work active
    if gas_ppm > 15.0 and has_hot_work:
        return {
            "risk_score": round(0.85 + (gas_ppm - 15.0) * 0.01, 2),  # Dynamic risk above 0.75
            "risk_level": "CRITICAL",
            "citation": "OISD-STD-105 Sec 4.2: Mandatory hot-work shutdown when gas exceeds 15 PPM threshold.",
            "recommendations": [
                "IMMEDIATE: Halt all Hot Work/welding in Zone B",
                "TRIGGER: Activate local dry-chemical fire suppression standby",
                "EVACUATE: Clear non-essential personnel from Zone B storage tank perimeter"
            ]
        }
    
    # General Rules
    # Base risk is a combination of gas level (relative to 15 PPM) and temperature (relative to 60C)
    gas_factor = min(gas_ppm / 15.0, 1.0)
    temp_factor = min(max(temp_c - 20.0, 0.0) / 60.0, 1.0)
    
    base_score = (gas_factor * 0.5) + (temp_factor * 0.3)
    if has_hot_work:
        base_score += 0.15  # Hot work incurs baseline risk
        
    score = min(max(base_score, 0.05), 1.0)
    score = round(score, 2)
    
    if score >= 0.70:
        level = "HIGH"
        citation = "Factory Act 1948 Sec 36: Precautionary monitoring required for elevated ambient parameters."
        recs = [
            "Alert safety supervisor immediately",
            "Increase ventilation rate in the local zone",
            "Re-evaluate active hot/cold work permits"
        ]
    elif score >= 0.40:
        level = "MODERATE"
        citation = ""
        recs = [
            "Continuous telemetry logging active",
            "Ensure functional fire extinguishers are standby within 10 meters"
        ]
    else:
        level = "LOW"
        citation = ""
        recs = [
            "Normal operations continue",
            "Standard PPE compliance mandatory"
        ]
        
    return {
        "risk_score": score,
        "risk_level": level,
        "citation": citation,
        "recommendations": recs
    }

@app.get("/trigger-hazard")
async def trigger_hazard():
    global hazard_injected
    hazard_injected = not hazard_injected
    return {"hazard_injected": hazard_injected}

@app.get("/status")
async def get_status():
    return {"hazard_injected": hazard_injected}

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Simulate Zone A (Compressor Area)
            gas_a = round(random.uniform(1.2, 3.5), 2)
            temp_a = round(random.uniform(38.0, 42.5), 2)
            risk_a_info = evaluate_compound_risk("zone_a", gas_a, temp_a, "Cold Work")
            
            # Simulate Zone B (Storage Tanks)
            if hazard_injected:
                gas_b = round(random.uniform(18.0, 22.0), 2)
                temp_b = round(random.uniform(30.0, 34.0), 2)
            else:
                gas_b = round(random.uniform(2.0, 4.5), 2)
                temp_b = round(random.uniform(28.0, 31.0), 2)
            risk_b_info = evaluate_compound_risk("zone_b", gas_b, temp_b, "Hot Work")
            
            # Simulate Zone C (Boiler Room)
            gas_c = round(random.uniform(0.4, 1.1), 2)
            temp_c = round(random.uniform(46.0, 52.0), 2)
            risk_c_info = evaluate_compound_risk("zone_c", gas_c, temp_c, "Confined Space")
            
            telemetry_data = {
                "hazard_injected": hazard_injected,
                "zones": [
                    {
                        "zone_id": "zone_a",
                        "name": "Zone A (Compressor Area)",
                        "permit_type": "Cold Work",
                        "gas_ppm": gas_a,
                        "temperature": temp_a,
                        **risk_a_info
                    },
                    {
                        "zone_id": "zone_b",
                        "name": "Zone B (Storage Tanks)",
                        "permit_type": "Hot Work",
                        "gas_ppm": gas_b,
                        "temperature": temp_b,
                        **risk_b_info
                    },
                    {
                        "zone_id": "zone_c",
                        "name": "Zone C (Boiler Room)",
                        "permit_type": "Confined Space",
                        "gas_ppm": gas_c,
                        "temperature": temp_c,
                        **risk_c_info
                    }
                ]
            }
            
            await websocket.send_json(telemetry_data)
            await asyncio.sleep(2.0)
            
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
