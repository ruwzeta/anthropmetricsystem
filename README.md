# BodyMeasure

Tailoring measurements from two phone photos. Enter the customer's height, take a front photo and a side photo, and get a measurement card a tailor can use: neck, chest, waist, hip, thigh, shoulder width, sleeve length, arm length, sleeve inseam, back length, inseam and outseam, in cm or inches.

Everything runs in the browser. Photos are processed on the device and never uploaded.

This is a rebuild of the 2019 BEng project *Body Measurement Extraction using OpenPose* (H.D.R.D. Chandraratne, Staffordshire University / APIIT). The original code is kept in [`legacy/`](legacy/).

## Using it

1. **Customer.** Enter a name and the height without shoes. Height sets the scale for everything else.
2. **Front photo.** Face the camera, arms about 30° away from the body, feet shoulder-width apart, whole body in frame. Use the built-in camera with a 5-second timer, or choose a photo.
3. **Side photo.** Turn 90°, arms down. You can skip this, but girths are then estimated from typical proportions.
4. **Measurements.** Check and edit the values, then save the customer, print or save as PDF, or export CSV or JSON.

Each value has a quality badge. "Check" means the body was not seen clearly, the pose was off, or the value is unusual for a human body, so confirm it with a tape.

### Calibration

Tick **"I checked these values with a tape"** on a saved customer after correcting the values with a tape. The app then learns a per-measurement correction (`tape ≈ scale × photo + offset`) from all checked customers and applies it to new measurements. This is the 2019 translation formula `w = yxᵀ(xxᵀ + λI)⁻¹` (λ = 0.5), regularised towards "no correction" so that a few samples do not overfit.

### Testing with volunteers

The **Testing** tab is for an accuracy study: testers sign in with their email, agree to the study terms, measure themselves with the app, enter their own tape measurements and rate the app. Admins see the error for each measurement against tape and can export the results as CSV. Photos are still never uploaded.

Results are shared through a free [Supabase](https://supabase.com) project. Until one is connected, the tab works on the device only. Setup takes about ten minutes: see [docs/TESTING.md](docs/TESTING.md).

## How it measures

| Step | 2019 version | Now |
|---|---|---|
| Capture | Android app (Camera2) | Any phone or computer browser, with a self-timer camera |
| Body points | OpenPose C++ DLL on a Windows .NET 4.x server | MediaPipe Pose Landmarker (33 points and a person mask) in the browser |
| Scale | Camera fixed at 250 cm | The person's height, measured from head top to floor in each photo |
| Measurements | 7 limb segment lengths | 12 tailoring measurements, including girths |
| Girths | none | Ellipse model: width from the front silhouette, depth from the side silhouette at the same height |
| Output | Text views | Editable card, print/PDF, CSV, JSON, saved customers |

The measurement code is in [`src/lib/measure.ts`](src/lib/measure.ts) and is tested against a synthetic body with known dimensions ([`src/lib/testing/syntheticBody.ts`](src/lib/testing/syntheticBody.ts)).

### Accuracy

Photo-based measurement is an estimate. Expect a few centimetres of error on girths. Loose clothing, a tilted camera, or a pose that differs from the guide all make it worse. The accuracy on real people has not been measured yet; calibration with tape-checked customers is the way to tighten it for a given tailor and phone.

## Development

Requires Node 22.12+ (npm 11 recommended).

```sh
npm install
npm run dev      # http://localhost:5173 (use `--host` to open it on a phone on the same Wi-Fi)
npm test         # unit tests
npm run build    # static site in dist/
```

The camera needs HTTPS or localhost. The pose model (~30 MB) downloads from Google's model storage the first time it is used and is then cached by the browser.

### Deploying

`.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to `master`. Turn it on under **Settings → Pages → Source: GitHub Actions**. Any static host (Vercel, Netlify, Cloudflare Pages) also works.

## Repository layout

```
src/lib/        measurement engine, calibration, photo checks, export (no UI)
src/components/ React screens
supabase/       database schema for tester accounts and study results
docs/           setup guides
legacy/         the 2019 ASP.NET Web API, OpenPose DLLs and WPF project
```
