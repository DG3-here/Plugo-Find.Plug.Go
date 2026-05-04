from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "ml_dataset.csv"
MODELS_DIR = BASE_DIR / "models"


def train_model():
    data = pd.read_csv(DATA_PATH)

    charger_encoder = LabelEncoder()
    status_encoder = LabelEncoder()
    demand_encoder = LabelEncoder()

    data["charger_type"] = charger_encoder.fit_transform(data["charger_type"])
    data["status"] = status_encoder.fit_transform(data["status"])
    data["demand_level"] = demand_encoder.fit_transform(data["demand_level"])

    features = data[["hour", "day_of_week", "charger_type", "status"]]
    target = data["demand_level"]

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target,
    )

    model = RandomForestClassifier(n_estimators=180, random_state=42)
    model.fit(x_train, y_train)

    accuracy = accuracy_score(y_test, model.predict(x_test))
    print(f"Model Accuracy: {accuracy:.2%}")

    MODELS_DIR.mkdir(exist_ok=True)
    joblib.dump(model, MODELS_DIR / "plugo_model.pkl")
    joblib.dump(charger_encoder, MODELS_DIR / "charger_encoder.pkl")
    joblib.dump(status_encoder, MODELS_DIR / "status_encoder.pkl")
    joblib.dump(demand_encoder, MODELS_DIR / "demand_encoder.pkl")
    print("Model and encoders saved")


if __name__ == "__main__":
    train_model()
