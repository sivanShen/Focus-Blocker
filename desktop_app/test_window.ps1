Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  }
"@

$handle = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
if ([Win32]::GetWindowText($handle, $sb, 256) -gt 0) {
    Write-Host $sb.ToString()
}
