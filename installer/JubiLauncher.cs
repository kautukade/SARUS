using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

// Small, reviewable launcher. No downloaded binary or embedded commands.
internal static class JubiLauncher
{
    [STAThread]
    private static int Main()
    {
        try
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string python = Path.Combine(root, @".sarus-venv\Scripts\pythonw.exe");
            string script = Path.Combine(root, "SARUS-script.pyw");
            if (!File.Exists(python) || !File.Exists(script))
                throw new IOException("Jubi runtime is missing. Run Jubi-Setup.exe to repair the installation.");
            var start = new ProcessStartInfo(python, "\"" + script + "\"");
            start.WorkingDirectory = root;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            Process.Start(start);
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Jubi could not start", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
