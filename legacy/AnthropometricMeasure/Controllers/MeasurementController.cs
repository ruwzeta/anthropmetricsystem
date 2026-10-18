using System;
using System.Collections.Generic;
using System.IO; // Added for Path operations
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web; // Added for HttpContext and HttpUtility
using System.Web.Http;
using Newtonsoft.Json; // For JsonException

namespace AnthropometricMeasure.Controllers
{
    public class MeasurementController : ApiController
    {

        // MeasurementModel measurementModel = new MeasurementModel(); // Instance created per request is better
        JsonRead jsonread = new JsonRead(); // Can be kept if JsonRead is stateless
        
        public IHttpActionResult GetMeasurement(string jsonPath) // Modified signature
        {
            if (string.IsNullOrEmpty(jsonPath))
            {
                return BadRequest("jsonPath parameter is required.");
            }

            string decodedJsonPath = HttpUtility.UrlDecode(jsonPath); // Decode URL-encoded path

            // Security check: Ensure the path is within the allowed directory
            try
            {
                string serverPath = HttpContext.Current.Server.MapPath("~/App_Data/json_output");
                string fullDecodedPath = Path.GetFullPath(decodedJsonPath);

                if (!fullDecodedPath.StartsWith(Path.GetFullPath(serverPath), StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Invalid jsonPath. Access is restricted to the json_output directory.");
                }
            }
            catch (Exception ex) // Catches potential errors from Path.GetFullPath (e.g., invalid characters)
            {
                // Log the exception ex
                return BadRequest("Invalid jsonPath format.");
            }


            MeasurementModel measurementModel; // Declare here
            try
            {
                measurementModel = jsonread.LoadJson(decodedJsonPath);
                if (measurementModel == null) // JsonRead might return null if it handles errors internally that way
                {
                    // This case might not be hit if JsonRead throws exceptions for all failure modes
                    return NotFound(); 
                }
                return Ok(measurementModel);
            }
            catch (FileNotFoundException)
            {
                return NotFound(); // Or BadRequest("Specified JSON file not found.")
            }
            catch (JsonException jsonEx)
            {
                // Log jsonEx for more details
                return BadRequest($"Error parsing JSON file: {jsonEx.Message}");
            }
            catch (Exception ex) // Catch other potential exceptions from LoadJson
            {
                // Log ex for more details
                return InternalServerError(ex);
            }
        }
    }
}
