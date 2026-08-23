# Sample data

Ready-to-upload sample lab reports for the platform. Each CSV is one athlete's
blood panel in the format the ingestion pipeline expects:

```
parameter,value,unit
Hemoglobin,15.1,g/dL
...
```

## How to use

1. Start the app (`npm run setup && npm run dev`) and log in.
2. Go to **Reports → Upload** and drop one of these CSV files.
3. The athlete is auto-detected from the file name, the biomarkers are parsed
   and validated, and a real risk/anomaly score is computed and displayed.

Recognized parameters include: Hemoglobin, Hematocrit, EPO, Reticulocytes,
Testosterone Ratio (T/E), Red/White Blood Cells, Platelets, Ferritin, Sodium,
and Oxygen Saturation.

## What each file demonstrates

| File | Profile | Expected outcome |
|------|---------|------------------|
| `Liam-Anderson-blood-panel.csv` | Healthy male | LOW risk, VALID |
| `Amara-Okafor-blood-panel.csv` | Healthy female | LOW risk, VALID |
| `Marco-Bianchi-blood-panel.csv` | Borderline elevated markers | MODERATE risk |
| `Viktor-Sorokin-blood-panel.csv` | Doping-like pattern (high Hb/HCT/EPO/T-E, low ferritin) | HIGH/CRITICAL risk, FLAGGED |
| `Kenji-Tanaka-full-panel.csv` | Broad panel, normal | LOW risk, VALID |

## Image (OCR) sample

| File | Purpose |
|------|---------|
| `Grace-Miller-lab-scan.png` | A rendered lab report image — tests the real image→OCR→biomarker path (~93% confidence). |

## Longitudinal series — `longitudinal-sofia-marchetti/`

Six reports for the **same** athlete (Sofia Marchetti). Upload them in order
(`panel-1` → `panel-6-SPIKE`) to build a biological-passport history: five stable
baselines followed by a blood-doping-style spike. This populates the Anti-Doping
longitudinal chart and drives the risk from LOW to **CRITICAL** on the final
report.

## Edge cases — `edge-cases/`

| File | Tests |
|------|-------|
| `Noah-Petit-panel.csv` | Headerless CSV using aliases (`Hb`, `HCT`, `Retic`, `T/E Ratio`) — normalization still resolves them → VALID |
| `Incomplete-Panel.csv` | Missing core markers (no Hemoglobin/EPO) → **INCOMPLETE** with validation notes |
| `Corrupt-Report.csv` | No recognizable biomarkers → ingests but is flagged **INCOMPLETE** (graceful, no crash) |

> These are synthetic values for demonstration only — not real medical data.
