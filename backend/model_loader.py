from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"


class ModelBundle:
    def __init__(self):
        self.model = joblib.load(MODELS_DIR / "plugo_model.pkl")
        self.charger_encoder = joblib.load(MODELS_DIR / "charger_encoder.pkl")
        self.status_encoder = joblib.load(MODELS_DIR / "status_encoder.pkl")
        self.demand_encoder = joblib.load(MODELS_DIR / "demand_encoder.pkl")

    def _safe_label(self, encoder, value):
        classes = list(getattr(encoder, "classes_", []))
        if value in classes:
            return value
        if classes:
            return classes[0]
        return value

    def predict(self, hour, day_of_week, charger_type, status):
        charger_type = self._safe_label(self.charger_encoder, charger_type)
        status = self._safe_label(self.status_encoder, status)

        charger_encoded = self.charger_encoder.transform([charger_type])[0]
        status_encoded = self.status_encoder.transform([status])[0]
        features = pd.DataFrame(
            [
                {
                    "hour": int(hour),
                    "day_of_week": int(day_of_week),
                    "charger_type": charger_encoded,
                    "status": status_encoded,
                }
            ]
        )

        prediction = self.model.predict(features)
        demand = self.demand_encoder.inverse_transform(prediction)[0]

        confidence = 1.0
        if hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(features)[0]
            confidence = float(max(probabilities))

        return {
            "predicted_demand": str(demand),
            "confidence": round(confidence, 3),
            "normalized_charger_type": charger_type,
            "normalized_status": status,
        }


model_bundle = ModelBundle()
