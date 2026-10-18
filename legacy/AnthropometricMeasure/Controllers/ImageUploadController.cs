using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO; // Added for file operations
using System.Configuration; // Added for potential future config
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using System.Web.Http;

namespace AnthropometricMeasure.Controllers
{
    public class ImageUploadController : ApiController
    {
        // Removed hardcoded _allowedExtensions and MaxFileSize

        public async Task<HttpResponseMessage> PostFormData()
        {
            // Read configuration values
            string openPoseExePath = ConfigurationManager.AppSettings["OpenPoseExePath"];
            if (string.IsNullOrWhiteSpace(openPoseExePath))
            {
                Trace.TraceError("OpenPoseExePath is not configured in Web.config.");
                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, "Server configuration error: OpenPose path not set.");
            }

            string extensionsString = ConfigurationManager.AppSettings["AllowedUploadExtensions"];
            string[] allowedExtensions;
            if (string.IsNullOrWhiteSpace(extensionsString))
            {
                allowedExtensions = new[] { ".jpg", ".jpeg", ".png" }; // Default values
                Trace.TraceWarning("AllowedUploadExtensions not configured in Web.config or is empty. Using default extensions: " + string.Join(",", allowedExtensions));
            }
            else
            {
                allowedExtensions = extensionsString.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                                                  .Select(ext => ext.Trim().ToLowerInvariant()) // Ensure trimmed and lower case
                                                  .ToArray();
            }
            
            string maxFileSizeString = ConfigurationManager.AppSettings["MaxUploadFileSizeInBytes"];
            long maxFileSize; // Renamed from MaxFileSize to avoid conflict if it were a const
            if (string.IsNullOrWhiteSpace(maxFileSizeString) || !long.TryParse(maxFileSizeString, out maxFileSize))
            {
                maxFileSize = 10 * 1024 * 1024; // Default to 10MB
                Trace.TraceWarning($"MaxUploadFileSizeInBytes not configured correctly in Web.config or is invalid. Using default value: {maxFileSize} bytes.");
            }

            // Check if the request contains multipart/form-data.
            if (!Request.Content.IsMimeMultipartContent())
            {
                // This is a client error, so no server-side file to clean up.
                Trace.TraceWarning("Request does not contain multipart/form-data.");
                throw new HttpResponseException(HttpStatusCode.UnsupportedMediaType);
            }

            string root = HttpContext.Current.Server.MapPath("~/App_Data");
            var provider = new MultipartFormDataStreamProvider(root);

            try
            {
                // Read the form data.
                await Request.Content.ReadAsMultipartAsync(provider);

                // Process only the first file for simplicity.
                if (provider.FileData.Any())
                {
                    MultipartFileData file = provider.FileData.First();
                    string originalFileName = file.Headers.ContentDisposition.FileName.Trim('"');
                    Trace.TraceInformation($"Processing file: {originalFileName}"); 
                    string uploadedFilePath = file.LocalFileName;
                    Trace.TraceInformation($"Uploaded file saved to temporary path: {uploadedFilePath} for original file {originalFileName}");

                    // File Type Validation
                    var extension = Path.GetExtension(originalFileName)?.ToLowerInvariant();
                    if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
                    {
                        Trace.TraceWarning($"File upload blocked for {originalFileName} due to invalid extension: {extension}. Allowed: {string.Join(", ", allowedExtensions)}. Temporary file: {uploadedFilePath}");
                        File.Delete(uploadedFilePath); // Clean up the invalid file
                        return Request.CreateErrorResponse(HttpStatusCode.BadRequest, $"Invalid file type. Allowed extensions are: {string.Join(", ", allowedExtensions)}");
                    }

                    // File Size Validation
                    var fileInfo = new FileInfo(uploadedFilePath);
                    if (fileInfo.Length > maxFileSize)
                    {
                        Trace.TraceWarning($"File upload blocked for {originalFileName} due to excessive size: {fileInfo.Length} bytes. Max allowed: {maxFileSize} bytes. Temporary file: {uploadedFilePath}");
                        File.Delete(uploadedFilePath); // Clean up the large file
                        return Request.CreateErrorResponse(HttpStatusCode.BadRequest, $"File size exceeds the limit of {maxFileSize / (1024 * 1024)} MB.");
                    }
                    Trace.TraceInformation($"File {originalFileName} passed type and size validation.");

                    // Define output directory for JSON files (OpenPoseExePath is already read and validated)
                    string jsonOutputDir = HttpContext.Current.Server.MapPath("~/App_Data/json_output");
                    Directory.CreateDirectory(jsonOutputDir); // Ensure directory exists

                    // Define expected output JSON file path
                    string outputJsonPath = Path.Combine(jsonOutputDir, Path.GetFileNameWithoutExtension(uploadedFilePath) + "_keypoints.json");

                    // Construct command-line arguments (placeholder)
                    // Note: --write_json typically takes a directory. OpenPose names the file itself based on the input image.
                    string arguments = $"--image_path \"{uploadedFilePath}\" --write_json \"{jsonOutputDir}\" --display 0 --render_pose 0";
                    
                    // Simulate Process Execution (Placeholder)
                    try
                    {
                        Trace.TraceInformation($"Simulating OpenPose execution. Command: {openPoseExePath} {arguments}");
                        // // Actual Process Execution (commented out for now)
                        // ProcessStartInfo startInfo = new ProcessStartInfo
                        // {
                        //     FileName = openPoseExePath,
                        //     Arguments = arguments,
                        //     UseShellExecute = false,
                        //     RedirectStandardOutput = true,
                        //     RedirectStandardError = true,
                        //     CreateNoWindow = true
                        // };
                        //
                        // using (Process process = Process.Start(startInfo))
                        // {
                        //     // string output = process.StandardOutput.ReadToEnd(); // Optional: Capture output
                        //     // string error = process.StandardError.ReadToEnd();   // Optional: Capture error
                        //     process.WaitForExit();
                        //
                        //     // if (process.ExitCode == 0)
                        //     // {
                        //     //    Trace.WriteLine("OpenPose executed successfully.");
                        //     //    // Verify outputJsonPath exists
                        //     //    if (!File.Exists(outputJsonPath))
                        //     //    {
                        //     //        Trace.WriteLine($"Error: Output JSON file not found at {outputJsonPath} after supposed successful execution.");
                        //     //        // Attempt to list files in jsonOutputDir to debug
                        //     //        var filesInDir = Directory.GetFiles(jsonOutputDir);
                        //     //        Trace.WriteLine($"Files in output directory: {string.Join(", ", filesInDir)}");
                        //     //        throw new FileNotFoundException("OpenPose output JSON not found.", outputJsonPath);
                        //     //    }
                        //     // }
                        //     // else
                        //     // {
                        //     //    Trace.WriteLine($"OpenPose execution failed with exit code {process.ExitCode}. Error: {error}");
                        //     //    throw new Exception($"OpenPose execution failed. Error: {error}");
                        //     // }
                        // }

                        // Simulate successful OpenPose execution by creating a dummy JSON file.
                        string dummyJsonContent = "{\"version\":1.3,\"people\":[{\"person_id\":[-1],\"pose_keypoints_2d\":[364.005,151.485,0.880751,364.009,199.718,0.889564,322.632,199.722,0.794884,292.005,254.883,0.700066,277.738,306.453,0.688492,399.673,198.506,0.854924,431.528,253.688,0.768114,445.794,305.202,0.757661,352.004,305.24,0.470065,340.963,391.616,0.552941,332.002,471.058,0.530958,365.208,305.243,0.453268,373.768,390.37,0.518924,370.184,472.298,0.507981,359.425,136.073,0.910695,367.591,136.08,0.893404,348.288,137.281,0.840045,378.634,137.266,0.870784],\"face_keypoints_2d\":[],\"hand_left_keypoints_2d\":[],\"hand_right_keypoints_2d\":[],\"pose_keypoints_3d\":[],\"face_keypoints_3d\":[],\"hand_left_keypoints_3d\":[],\"hand_right_keypoints_3d\":[]}]}";
                        File.WriteAllText(outputJsonPath, dummyJsonContent);
                        Trace.TraceInformation($"OpenPose simulation successful. Dummy JSON created at: {outputJsonPath}");

                        return Request.CreateResponse(HttpStatusCode.OK, new { message = "File uploaded and processed (simulated).", jsonPath = outputJsonPath });
                    }
                    catch (FileNotFoundException fnfEx) // This catch block might be less relevant for simulation but kept for structure
                    {
                        Trace.TraceError($"Error during OpenPose simulation for {uploadedFilePath}: {fnfEx.ToString()}");
                        return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, $"File not found during processing: {fnfEx.Message}");
                    }
                    catch (Exception ex)
                    {
                        Trace.TraceError($"Error during OpenPose simulation for {uploadedFilePath}: {ex.ToString()}");
                        return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, $"An error occurred during processing: {ex.Message}");
                    }
                }
                else
                {
                    Trace.TraceWarning("No file was uploaded in the request."); // Added warning for no file
                    return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "No file was uploaded.");
                }
            }
            catch (System.Exception e)
            {
                Trace.TraceError($"Error reading multipart form data: {e.ToString()}"); // Changed to TraceError
                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, e);
            }
        }

    }
}
