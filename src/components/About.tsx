export function About() {
  return (
    <section className="card prose">
      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Height sets the scale.</strong> You enter the customer’s real height. The app finds the top of the head and the floor in each photo, so it knows how many pixels make a
          centimetre, whatever the camera distance.
        </li>
        <li>
          <strong>Body points and silhouette.</strong> Google’s MediaPipe pose model finds 33 body points (shoulders, elbows, wrists, hips, knees, ankles…) and separates the person from the
          background. It runs inside the browser; photos never leave the device.
        </li>
        <li>
          <strong>Lengths</strong> such as sleeve, arm, inseam and outseam are measured along the body points and silhouette in the front photo.
        </li>
        <li>
          <strong>Girths</strong> (neck, chest, waist, hip, thigh) use the ellipse model: the body’s width at that level comes from the front photo, its depth at the same height from the side
          photo, and the girth is the perimeter of that ellipse.
        </li>
        <li>
          <strong>Calibration</strong> learns from your tape checks to correct small systematic differences for your camera and measuring style.
        </li>
      </ol>
      <h3>For best results</h3>
      <ul>
        <li>Fitted clothing, plain background, good light.</li>
        <li>Camera at waist height, held level, 2–3 m away, whole body in frame.</li>
        <li>Same camera position for the front and side photos.</li>
      </ul>
      <h3>Background</h3>
      <p className="muted">
        This is the 2019 BEng project “Body Measurement Extraction using OpenPose” (H.D.R.D. Chandraratne, Staffordshire University / APIIT), rebuilt. The original used an Android app, a .NET
        Web API and OpenPose, and needed the camera exactly 250 cm away. This version runs entirely in the browser, works at any distance and measures girths.
      </p>
    </section>
  );
}
