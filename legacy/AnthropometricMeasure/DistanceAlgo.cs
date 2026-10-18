using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace AnthropometricMeasure
{
    public class DistanceAlgo
    {

        public double distanceBetweenPoints(double x1 , double y1, double x2, double y2) {
            double distance;

            distance = Math.Sqrt(Math.Pow((x2 - x1), 2) + Math.Pow((y2 - y1), 2));

            return distance;
        }
    }
}