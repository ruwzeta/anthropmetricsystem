using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Configuration; // Added
using System.Globalization; // Added
using System.Diagnostics; // For Trace

namespace AnthropometricMeasure
{
    public class RatioAlgo
    {
        // W = (Y . X Tranpose ) (X . X Tranpose + Lamba - Identity Matrix)

        private static readonly double _lambdaConfig;
        private static readonly double[] _matrixXConfigValues;
        private static readonly double[] _matrixYConfigValues;

        MatrixCal matrixCal = new MatrixCal(); // Instance member

        static RatioAlgo()
        {
            string lambdaStr = ConfigurationManager.AppSettings["RatioAlgo.Lambda"];
            if (!double.TryParse(lambdaStr, NumberStyles.Any, CultureInfo.InvariantCulture, out _lambdaConfig))
            {
                Trace.TraceError("RatioAlgo.Lambda is missing or invalid in Web.config. Application may not function correctly.");
                throw new ConfigurationErrorsException("RatioAlgo.Lambda is missing or invalid in Web.config.");
            }

            string matrixXStr = ConfigurationManager.AppSettings["RatioAlgo.MatrixX"];
            _matrixXConfigValues = ParseVectorConfig(matrixXStr, "RatioAlgo.MatrixX", 7);

            string matrixYStr = ConfigurationManager.AppSettings["RatioAlgo.MatrixY"];
            _matrixYConfigValues = ParseVectorConfig(matrixYStr, "RatioAlgo.MatrixY", 7);
            
            Trace.TraceInformation("RatioAlgo calibration constants loaded from Web.config.");
        }

        private static double[] ParseVectorConfig(string configStr, string configKey, int expectedLength)
        {
            if (string.IsNullOrWhiteSpace(configStr))
            {
                Trace.TraceError($"{configKey} is missing or empty in Web.config. Application may not function correctly.");
                throw new ConfigurationErrorsException($"{configKey} is missing or empty in Web.config.");
            }

            string[] parts = configStr.Split(',');
            if (parts.Length != expectedLength)
            {
                Trace.TraceError($"{configKey} must have exactly {expectedLength} comma-separated values. Found {parts.Length}. Application may not function correctly.");
                throw new ConfigurationErrorsException($"{configKey} must have exactly {expectedLength} comma-separated values. Found {parts.Length}.");
            }

            double[] values = new double[expectedLength];
            for (int i = 0; i < expectedLength; i++)
            {
                if (!double.TryParse(parts[i].Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out values[i]))
                {
                    Trace.TraceError($"Invalid number format for value '{parts[i]}' in {configKey} in Web.config. Application may not function correctly.");
                    throw new ConfigurationErrorsException($"Invalid number format for value '{parts[i]}' in {configKey} in Web.config.");
                }
            }
            return values;
        }
        
        // Removed instance field: double lamba = 0.50;
        // Comment regarding hardcoded lambda is no longer accurate as it's from config.
        // The lambda used in matrixwcal is now from _lambdaConfig.

        /// <summary>
        /// Calculates the transformation matrix 'matrixw'.
        /// This matrix is likely used to calibrate or adjust raw measurements obtained from keypoints.
        /// The formula W = (Y * X_transpose) * Inverse(X * X_transpose + lambda * I) resembles
        /// a form of regularized least squares regression, where X and Y are calibration matrices
        /// loaded from Web.config.
        /// </summary>
        public double[][] matrixwcal() {

            double[][] matrixw, matrixx, matrixy, matrixxtrapose, matrixpart1val, matrixpart2val, matrixpart3val, matrixI;
            
            double lamba = _lambdaConfig; // Use configured lambda

            matrixx = matrixCal.MatrixCreate(7, 1);
            matrixy = matrixCal.MatrixCreate(7, 1);

            // Populate matrixx and matrixy from config values
            for (int i = 0; i < 7; i++)
            {
                matrixx[i + 1][1] = _matrixXConfigValues[i];
                matrixy[i + 1][1] = _matrixYConfigValues[i];
            }
            
            matrixxtrapose = matrixCal.MatrixCreate(1, 7);
            // Populate matrixxtrapose
            for (int i = 0; i < 7; i++)
            {
                matrixxtrapose[1][i + 1] = _matrixXConfigValues[i];
            }

            matrixw = matrixCal.MatrixCreate(7, 7);
            matrixpart1val= matrixCal.MatrixCreate(7, 7);
            matrixpart2val = matrixCal.MatrixCreate(7, 7);
            matrixpart3val= matrixCal.MatrixCreate(7, 7);
            matrixI = matrixCal.MatrixCreate(7, 7);

            matrixI = matrixCal.MatrixIdentity(7);

            matrixpart1val = matrixCal.MatrixProduct(matrixy, matrixxtrapose);
            matrixpart2val = matrixCal.MatrixProduct(matrixx, matrixxtrapose);

            for (int i = 0; i < 7; i++) { // Note: Matrix indices are 1-based in MatrixCal, loop should be 1 to 7 or 0 to 6 with i+1
                for (int j = 0; j < 7; j++)
                    matrixpart2val[i+1][j+1] = matrixpart2val[i+1][j+1] + (lamba * matrixI[i+1][j+1]);
            }

            matrixpart3val = matrixCal.MatrixInverse(matrixpart2val);

            matrixw = matrixCal.MatrixProduct(matrixpart1val, matrixpart3val);

            return matrixw;  
        }
    }
}