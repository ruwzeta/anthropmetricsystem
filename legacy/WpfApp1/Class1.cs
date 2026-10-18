using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Media;

namespace WpfApp1
{
    class Class1
    {

        private Matrix matrixConverterExample()
        {

            MatrixConverter mConverter = new MatrixConverter();
            Matrix matrixResult = new Matrix();
            string string2 = "10,20,30,40,50,60";

            matrixResult = (Matrix)mConverter.ConvertFromString(string2);
            // matrixResult is equal to (10, 20, 30, 40, 50, 60)

            return matrixResult;
        }
    }
}
