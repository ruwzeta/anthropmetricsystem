using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Web;

namespace AnthropometricMeasure
{

    public class DllImport
    {
        [DllImport("03_keypoints_from_image.dll", ExactSpelling =true)]
        public static extern int MessageBox(IntPtr hWnd, String text, String caption, uint type);
    }
}