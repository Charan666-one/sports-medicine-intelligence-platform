import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
import joblib
import os

# Create directories if they don't exist
os.makedirs('ml-service/saved_models', exist_ok=True)

def generate_synthetic_data(n_samples=1000):
    # Normal athlete biomarkers (Hb, Hct, T/E, Retic, EPO)
    # Mean values based on typical physiological ranges
    data = {
        'hb': np.random.normal(15, 1.0, n_samples),
        'hct': np.random.normal(45, 2.5, n_samples),
        'te_ratio': np.random.lognormal(0.5, 0.4, n_samples), # Usually low
        'retic': np.random.normal(1.2, 0.3, n_samples),
        'epo': np.random.normal(5, 1.5, n_samples),
        'age': np.random.randint(18, 40, n_samples),
        'stability_index': np.random.normal(90, 5, n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Simple risk labels for Random Forest (Heuristic-based for initial training)
    # 0: Low, 1: Moderate, 2: High, 3: Critical
    risk = np.zeros(n_samples)
    risk[(df['hb'] > 17) | (df['te_ratio'] > 4)] = 2
    risk[(df['hb'] > 18) | (df['te_ratio'] > 6) | (df['epo'] > 12)] = 3
    risk[(df['hb'] < 17.5) & (df['hb'] > 16.5) & (df['te_ratio'] > 3)] = 1
    
    df['risk_label'] = risk
    return df

def train_models():
    print("Generating training data...")
    df = generate_synthetic_data(2000)
    
    features = ['hb', 'hct', 'te_ratio', 'retic', 'epo', 'age', 'stability_index']
    X = df[features]
    y = df['risk_label']
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print("Training Random Forest Classifier...")
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_scaled, y)
    
    print("Training Isolation Forest Anomaly Detector...")
    iso_forest = IsolationForest(contamination=0.05, random_state=42)
    iso_forest.fit(X_scaled)
    
    print("Training One-Class SVM...")
    oc_svm = OneClassSVM(kernel='rbf', gamma=0.1, nu=0.05)
    oc_svm.fit(X_scaled)
    
    # Save models and scaler
    joblib.dump(rf, 'ml-service/saved_models/random_forest.joblib')
    joblib.dump(iso_forest, 'ml-service/saved_models/iso_forest.joblib')
    joblib.dump(oc_svm, 'ml-service/saved_models/oc_svm.joblib')
    joblib.dump(scaler, 'ml-service/saved_models/scaler.joblib')
    joblib.dump(features, 'ml-service/saved_models/features.joblib')
    
    print("Models saved successfully to ml-service/saved_models/")

if __name__ == "__main__":
    train_models()
