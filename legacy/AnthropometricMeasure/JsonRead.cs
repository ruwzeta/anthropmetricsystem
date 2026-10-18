using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics; // Added for Trace
using System.IO; 
using System.Linq;
using System.Web;

namespace AnthropometricMeasure
{
    public class JsonRead
    {
        
      

        public MeasurementModel LoadJson(string jsonFilePath) 
        {
            // Check for file existence
            if (string.IsNullOrEmpty(jsonFilePath) || !File.Exists(jsonFilePath))
            {
                // No TraceError here as it's handled by the controller with a specific response.
                // Or, if we want to log it here: Trace.TraceError($"File not found at path: {jsonFilePath}");
                throw new FileNotFoundException("JSON file not found at the specified path.", jsonFilePath);
            }
            Trace.TraceInformation($"Attempting to load and parse JSON from: {jsonFilePath}");

            double[][] matrixX;
            double[][] matrixW,matrixY;
            

            MatrixCal matrixCal = new MatrixCal();

            DistanceAlgo distanceAlgo = new DistanceAlgo();

            MeasurementModel realmeasurements = new MeasurementModel();
            
            // Using the provided jsonFilePath
            using (StreamReader r = new StreamReader(jsonFilePath))
            {
                string json = r.ReadToEnd();
                List<BodyPoints> items;
                try
                {
                    items = JsonConvert.DeserializeObject<List<BodyPoints>>(json);
                    if (items != null)
                    {
                        Trace.TraceInformation($"Successfully deserialized JSON from {jsonFilePath}. Found {items.Count} 'people' entries (expected 1 for this workflow).");
                    }
                    else
                    {
                        // This case might indicate empty array or null, which could be an issue.
                        Trace.TraceWarning($"JSON deserialized to null or empty list from {jsonFilePath}.");
                        // Depending on requirements, might need to throw here or handle as no people found.
                        // For now, let it proceed and potentially fail later if items.Count is critical.
                    }
                }
                catch (JsonException ex)
                {
                    Trace.TraceError($"Error deserializing JSON from {jsonFilePath}: {ex.ToString()}");
                    throw; // Re-throw to be caught by the controller
                }


                BodyDistances bodyDistances = new BodyDistances();

                RatioAlgo ratioAlgo = new RatioAlgo();


                for (var i = 0; i < items.Count; i++)
                {


                    // Pythagoras used to caluate distance between 2 coordinates 
                    

                        bodyDistances.d1 = distanceAlgo.distanceBetweenPoints(items[i].x6, items[i].y6, items[i].x3, items[i].y3);

                        bodyDistances.d2 = distanceAlgo.distanceBetweenPoints(items[i].x4, items[i].y4, items[i].x3, items[i].y3);

                        bodyDistances.d3 = distanceAlgo.distanceBetweenPoints(items[i].x4, items[i].y4, items[i].x5, items[i].y5);

                        bodyDistances.d4 = distanceAlgo.distanceBetweenPoints(items[i].x9, items[i].y9, items[i].x3, items[i].y3);

                        bodyDistances.d5 = distanceAlgo.distanceBetweenPoints(items[i].x9, items[i].y9, items[i].x12, items[i].y12);

                        bodyDistances.d6 = distanceAlgo.distanceBetweenPoints(items[i].x9, items[i].y9, items[i].x10, items[i].y10);

                        bodyDistances.d7 = distanceAlgo.distanceBetweenPoints(items[i].x10, items[i].y10, items[i].x11, items[i].y11);



                    matrixX = matrixCal.MatrixCreate(7, 1);


                    matrixX[1][1] = bodyDistances.d1;
                    matrixX[2][1] = bodyDistances.d2;
                    matrixX[3][1] = bodyDistances.d3;
                    matrixX[4][1] = bodyDistances.d4;
                    matrixX[5][1] = bodyDistances.d5;
                    matrixX[6][1] = bodyDistances.d6;
                    matrixX[7][1] = bodyDistances.d7;


                    matrixW = matrixCal.MatrixCreate(7, 7);

                    matrixW = ratioAlgo.matrixwcal();

                    matrixY = matrixCal.MatrixCreate(7, 1);

                    matrixY = matrixCal.MatrixProduct(matrixW, matrixX);



                    realmeasurements.shoulderlength = matrixY[1][1];
                    realmeasurements.upperArmLegth = matrixY[2][1];
                    realmeasurements.lowerArmLegth = matrixY[3][1];
                    realmeasurements.shouldertoHip = matrixY[4][1];
                    realmeasurements.hipCrossLength = matrixY[5][1];
                    realmeasurements.kneelegth = matrixY[6][1];
                    realmeasurements.kneetoToeLength = matrixY[7][1];

                }
                Trace.TraceInformation($"Successfully processed measurements from JSON file: {jsonFilePath}");
                return realmeasurements;

            }
        }
    }
}