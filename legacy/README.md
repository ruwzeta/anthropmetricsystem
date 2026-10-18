# Anthropometric System (2019, legacy)

> This is the original 2019 implementation, kept for reference. The current app is in the repository root; see the [main README](../README.md).
>
> Known issue: `JsonRead.cs` and `RatioAlgo.cs` index the 7×1 matrices from `MatrixCal.MatrixCreate` as `[1..7][1]`, but the arrays are zero-based (`[0..6][0]`), so measurement throws `IndexOutOfRangeException` before returning a result. It is left unfixed here; the new calibration in `src/lib/calibration.ts` replaces it.
Body measurement extraction using Open Pose

## WPF Application (WpfApp1)

The solution includes a WPF project named `WpfApp1`. Its specific purpose and interaction with the main `AnthropometricMeasure` web application are not clear from the existing codebase. It does not appear to be directly involved in the image processing or measurement calculation workflow.

**Recommendation:** Review the `WpfApp1` project. If it is no longer needed or is an unfinished component, consider removing it to simplify the solution. If it serves a purpose (e.g., as a utility, for testing, or a separate tool), its functionality and any relationship with the web application should be documented.

## Testing Recommendations

To improve the robustness and maintainability of this project, adding automated tests is highly recommended. Consider the following areas for unit and integration testing:

### Unit Tests

*   **`DistanceAlgo.cs`**:
    *   Test `distanceBetweenPoints()` with various inputs (zero distance, positive/negative coordinates, points on axes).
*   **`MatrixCal.cs`**:
    *   Thoroughly test all matrix operations: `MatrixCreate`, `MatrixProduct`, `MatrixInverse`, `MatrixIdentity`. Include tests for valid inputs, edge cases, and invalid inputs (e.g., incompatible dimensions, singular matrices for inversion).
*   **`JsonRead.cs` (`LoadJson` method)**:
    *   Test with valid sample JSON (confirming correct `MeasurementModel` population).
    *   Test with malformed/invalid JSON.
    *   Test with JSON files missing expected keypoints or data.
    *   Test with non-existent JSON file paths.
*   **`RatioAlgo.cs` (`matrixwcal` method)**:
    *   Verify that `matrixwcal()` produces the expected `matrixw` output given its hardcoded input matrices. This acts as a regression test for the calibration logic.

### Integration Tests

*   **`ImageUploadController.cs` (`PostFormData` method)**:
    *   Test successful image upload and (simulated) OpenPose processing, verifying the correct HTTP response and that the dummy JSON output is created as expected.
    *   Test with invalid file types (e.g., `.txt`, `.exe`).
    *   Test with files exceeding the defined size limits.
    *   Test behavior when no file is uploaded.
*   **`MeasurementController.cs` (`GetMeasurement` method)**:
    *   Test with a valid `jsonPath` query parameter, ensuring correct `MeasurementModel` retrieval.
    *   Test with a missing or empty `jsonPath`.
    *   Test with `jsonPath` values that are invalid (e.g., outside the allowed directory, non-existent file).

Consider using a testing framework like MSTest, NUnit, or xUnit for implementing these tests.

## Configuration

The application uses settings in the `Web.config` file's `<appSettings>` section for key configurations:

### Image Processing and Upload (`ImageUploadController`)

*   **`OpenPoseExePath`**:
    *   **Purpose**: Specifies the full path to the OpenPose executable (e.g., `OpenPoseDemo.exe` or similar). This is used to process the uploaded images.
    *   **Example**: `<add key="OpenPoseExePath" value="C:\Program Files\OpenPose\bin\OpenPoseDemo.exe" />`
    *   **Note**: The application will return a server error if this path is not configured or is invalid. The actual OpenPose execution is currently simulated in the code.

*   **`AllowedUploadExtensions`**:
    *   **Purpose**: A comma-separated list of allowed file extensions for image uploads.
    *   **Example**: `<add key="AllowedUploadExtensions" value=".jpg,.jpeg,.png,.bmp,.gif" />`
    *   **Default (if not set or invalid)**: `.jpg,.jpeg,.png`

*   **`MaxUploadFileSizeInBytes`**:
    *   **Purpose**: The maximum allowed file size for uploads, specified in bytes.
    *   **Example**: `<add key="MaxUploadFileSizeInBytes" value="10485760" />` (for 10 MB)
    *   **Default (if not set or invalid)**: `10485760` (10 MB)

### Measurement Calibration (`RatioAlgo`)

These settings are critical for the `RatioAlgo` to calculate final measurements. The application will throw a configuration error on startup if these are missing or malformed.

*   **`RatioAlgo.Lambda`**:
    *   **Purpose**: The regularization parameter (lambda) used in the matrix calculations.
    *   **Example**: `<add key="RatioAlgo.Lambda" value="0.50" />`

*   **`RatioAlgo.MatrixX`**:
    *   **Purpose**: A comma-separated string of 7 double values representing the 'matrixx' calibration vector.
    *   **Example**: `<add key="RatioAlgo.MatrixX" value="72.597,61.504,56.222,115.277,45.382,89.17,72.683" />`

*   **`RatioAlgo.MatrixY`**:
    *   **Purpose**: A comma-separated string of 7 double values representing the 'matrixy' calibration vector.
    *   **Example**: `<add key="RatioAlgo.MatrixY" value="44,33,27,63,23,51,45" />`
