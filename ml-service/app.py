from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os

app = FastAPI(title="Sports Medicine AI Intelligence Service")

# Load models at startup
MODELS_PATH = 'ml-service/saved_models'
try:
    rf = joblib.load(f'{MODELS_PATH}/random_forest.joblib')
    iso_forest = joblib.load(f'{MODELS_PATH}/iso_forest.joblib')
    oc_svm = joblib.load(f'{MODELS_PATH}/oc_svm.joblib')
    scaler = joblib.load(f'{MODELS_PATH}/scaler.joblib')
    features_list = joblib.load(f'{MODELS_PATH}/features.joblib')
    MODELS_LOADED = True
except Exception as e:
    print(f"Error loading models: {e}")
    MODELS_LOADED = False

class AthleteData(BaseModel):
    hb: float
    hct: float
    te_ratio: float
    retic: float
    epo: float
    age: int
    stability_index: float

@app.get("/health")
def health_check():
    return {"status": "ok", "models_loaded": MODELS_LOADED}

@app.post("/predict-risk")
def predict_risk(data: AthleteData):
    if not MODELS_LOADED:
        raise HTTPException(status_code=500, detail="Models not loaded")
    
    # Preprocess
    input_df = pd.DataFrame([data.dict()])
    input_scaled = scaler.transform(input_df[features_list])
    
    # Risk Probabilities
    probs = rf.predict_proba(input_scaled)[0]
    risk_label = rf.predict(input_scaled)[0]
    
    # Anomaly Scores
    # Isolation Forest: -1 for outlier, 1 for inlier
    iso_score = iso_forest.score_samples(input_scaled)[0]
    is_anomaly = iso_forest.predict(input_scaled)[0] == -1
    
    # One-Class SVM
    svm_predict = oc_svm.predict(input_scaled)[0] == -1
    
    # Explainability: Feature Importance (Contribution to the prediction)
    # Simple heuristic for explanation: which features deviated most from scaled mean
    contributions = {}
    for i, feat in enumerate(features_list):
        # Weight prediction by normalized deviation
        contributions[feat] = float(abs(input_scaled[0][i]) * rf.feature_importances_[i])
    
    top_contributors = sorted(contributions.items(), key=lambda x: x[1], reverse=True)[:3]
    explanation = [f"Driven by {c[0].replace('_', ' ').capitalize()}" for c in top_contributors]

    return {
        "risk_classification": ["LOW", "MODERATE", "HIGH", "CRITICAL"][int(risk_label)],
        "probabilities": {
            "low": float(probs[0]),
            "moderate": float(probs[1] if len(probs) > 1 else 0),
            "high": float(probs[2] if len(probs) > 2 else 0),
            "critical": float(probs[3] if len(probs) > 3 else 0)
        },
        "anomaly_detection": {
            "is_outlier": bool(is_anomaly),
            "is_atypical_behavior": bool(svm_predict),
            "confidence_score": float(abs(iso_score))
        },
        "explanation": explanation,
        "feature_importance": contributions
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
